-- ═══════════════════════════════════════════════════════════════════════
--  ESMUN · 0002 · Funciones
--  redeem_qr es la ÚNICA vía de escritura de canjes. Nadie —ni el admin—
--  hace insert directo sobre redemptions.
-- ═══════════════════════════════════════════════════════════════════════

-- ── Helpers ────────────────────────────────────────────────────────────

create or replace function current_profile_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from profiles where id = auth.uid() and is_active;
$$;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
     where id = auth.uid() and is_active and role = 'admin'
  );
$$;

create or replace function is_dispatcher() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
     where id = auth.uid() and is_active and role in ('dispatcher', 'admin')
  );
$$;

create or replace function active_event_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from events where is_active limit 1;
$$;

-- 'Consejo de Seguridad · Francia' para un delegado,
-- 'ECOSOC · Presidente' para la mesa, 'Prensa' para el resto.
create or replace function participant_label(p_id uuid) returns text
language sql stable security definer set search_path = public as $$
  select case
    when p.role = 'delegado' then f.name || ' · ' || d.country
    when p.role = 'mesa'     then f.name || coalesce(' · ' || p.position, '')
    else initcap(p.role::text)
  end
  from participants p
  left join forums f      on f.id = p.forum_id
  left join delegations d on d.id = p.delegation_id
  where p.id = p_id;
$$;

create or replace function log_attempt(
  p_session uuid, p_participant uuid, p_token text,
  p_result scan_result, p_station text, p_device text
) returns void
language sql security definer set search_path = public as $$
  insert into scan_attempts
    (session_id, participant_id, scanned_token, result, operator_id, station_label, device_id)
  values
    (p_session, p_participant, p_token, p_result, auth.uid(), p_station, p_device);
$$;

create or replace function log_audit(
  p_action text, p_entity text, p_entity_id uuid, p_detail jsonb default '{}'::jsonb
) returns void
language sql security definer set search_path = public as $$
  insert into audit_log (event_id, actor_id, action, entity, entity_id, detail)
  values (active_event_id(), auth.uid(), p_action, p_entity, p_entity_id, p_detail);
$$;

-- ═══════════════════════════════════════════════════════════════════════
--  redeem_qr — el canje
--
--  p_redeemed_at solo lo manda la cola offline al reenviar. Se recorta al
--  rango [opened_at, now()]: un despachador no puede antedatar un canje.
-- ═══════════════════════════════════════════════════════════════════════

create or replace function redeem_qr(
  p_token       text,
  p_station     text default null,
  p_device      text default null,
  p_redeemed_at timestamptz default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_ses    dispatch_sessions;
  v_par    participants;
  v_prev   redemptions;
  v_new    uuid;
  v_when   timestamptz;
  v_off    boolean := p_redeemed_at is not null;
begin
  if current_profile_id() is null then
    raise exception 'Sin sesión válida' using errcode = '42501';
  end if;

  -- 1 · ¿Hay una ventana de entrega abierta?
  select * into v_ses
    from dispatch_sessions
   where state = 'open' and event_id = active_event_id()
   limit 1;

  if not found then
    perform log_attempt(null, null, p_token, 'session_closed', p_station, p_device);
    return jsonb_build_object(
      'status', 'session_closed',
      'closed_at', (select max(closed_at) from dispatch_sessions where event_id = active_event_id())
    );
  end if;

  -- 2 · ¿El token existe en este evento?
  select * into v_par
    from participants
   where qr_token = p_token and event_id = v_ses.event_id;

  if not found then
    perform log_attempt(v_ses.id, null, p_token, 'unknown_token', p_station, p_device);
    return jsonb_build_object('status', 'unknown_token');
  end if;

  if not v_par.is_active then
    perform log_attempt(v_ses.id, v_par.id, p_token, 'inactive', p_station, p_device);
    return jsonb_build_object('status', 'not_eligible', 'name', v_par.full_name,
                              'reason', 'inactivo');
  end if;

  -- 3 · ¿Su rol aplica a esta sesión?
  if not (v_par.role = any (v_ses.eligible_roles)) then
    perform log_attempt(v_ses.id, v_par.id, p_token, 'not_eligible', p_station, p_device);
    return jsonb_build_object(
      'status', 'not_eligible',
      'name',   v_par.full_name,
      'role',   v_par.role,
      'eligible_roles', v_ses.eligible_roles
    );
  end if;

  v_when := greatest(
              coalesce(v_ses.opened_at, now()),
              least(coalesce(p_redeemed_at, now()), now())
            );

  -- 4 · El canje. Una sola sentencia: aquí no cabe una condición de carrera.
  insert into redemptions
    (session_id, participant_id, dispatched_by, station_label, device_id,
     redeemed_at, was_offline, synced_at)
  values
    (v_ses.id, v_par.id, auth.uid(), p_station, p_device,
     v_when, v_off, case when v_off then now() end)
  on conflict (session_id, participant_id) where voided_at is null
  do nothing
  returning id into v_new;

  -- 5 · Vino vacío = ya había canjeado. Devolvemos hora y responsable.
  if v_new is null then
    select * into v_prev
      from redemptions
     where session_id = v_ses.id
       and participant_id = v_par.id
       and voided_at is null;

    perform log_attempt(v_ses.id, v_par.id, p_token, 'duplicate', p_station, p_device);

    return jsonb_build_object(
      'status',      'duplicate',
      'name',        v_par.full_name,
      'detail',      participant_label(v_par.id),
      'redeemed_at', v_prev.redeemed_at,
      'station',     v_prev.station_label,
      'by',          (select display_name from profiles where id = v_prev.dispatched_by)
    );
  end if;

  perform log_attempt(v_ses.id, v_par.id, p_token, 'granted', p_station, p_device);

  return jsonb_build_object(
    'status',      'granted',
    'name',        v_par.full_name,
    'detail',      participant_label(v_par.id),
    'role',        v_par.role,
    'diet',        nullif(btrim(coalesce(v_par.dietary_notes, '')), ''),
    'redeemed_at', v_when
  );
end $$;

-- ═══════════════════════════════════════════════════════════════════════
--  Padrón local para el modo offline
--
--  Rompe parcialmente "el despachador no ve datos": para mostrar el
--  nombre y la alerta de alergia sin red, esos datos tienen que estar en
--  el teléfono. Mitigaciones: solo con sesión abierta, solo participantes
--  elegibles, campos mínimos, y cada descarga queda en audit_log.
-- ═══════════════════════════════════════════════════════════════════════

create or replace function session_roster()
returns table (qr_token text, name text, detail text, diet text)
language plpgsql security definer set search_path = public as $$
declare
  v_ses dispatch_sessions;
begin
  if not is_dispatcher() then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;

  select * into v_ses
    from dispatch_sessions
   where state = 'open' and event_id = active_event_id()
   limit 1;

  if not found then
    return;                       -- sin sesión abierta no hay padrón
  end if;

  perform log_audit('roster.download', 'dispatch_session', v_ses.id,
                    jsonb_build_object('session', v_ses.name));

  return query
    select p.qr_token,
           p.full_name,
           participant_label(p.id),
           nullif(btrim(coalesce(p.dietary_notes, '')), '')
      from participants p
     where p.event_id = v_ses.event_id
       and p.is_active
       and p.role = any (v_ses.eligible_roles);
end $$;

-- Contador del turno: lo único que el despachador ve además del veredicto.
create or replace function my_turn_count(p_device text default null)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'delivered', count(*) filter (where r.voided_at is null),
    'session',   s.name,
    'session_id', s.id
  )
  from dispatch_sessions s
  left join redemptions r
         on r.session_id = s.id
        and r.dispatched_by = auth.uid()
        and (p_device is null or r.device_id = p_device)
  where s.state = 'open' and s.event_id = active_event_id()
  group by s.id, s.name;
$$;

-- ═══════════════════════════════════════════════════════════════════════
--  Sesiones — abrir, cerrar, anular. Solo admin.
-- ═══════════════════════════════════════════════════════════════════════

create or replace function open_session(p_session uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_ses dispatch_sessions;
begin
  if not is_admin() then raise exception 'Solo un administrador puede abrir una sesión'
    using errcode = '42501'; end if;

  select * into v_ses from dispatch_sessions where id = p_session;
  if not found then raise exception 'La sesión no existe'; end if;
  if v_ses.state = 'closed' then
    raise exception 'Esa sesión ya se cerró; no se puede reabrir';
  end if;

  -- El índice único sesion_abierta_unica hace imposible dos abiertas.
  update dispatch_sessions
     set state = 'open', opened_at = coalesce(opened_at, now()), opened_by = auth.uid()
   where id = p_session;

  perform log_audit('session.open', 'dispatch_session', p_session,
                    jsonb_build_object('name', v_ses.name));

  return jsonb_build_object('status', 'open', 'session_id', p_session);
exception
  when unique_violation then
    raise exception 'Ya hay otra sesión abierta. Ciérrala antes de abrir esta.';
end $$;

create or replace function close_session(p_session uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo un administrador puede cerrar una sesión'
    using errcode = '42501'; end if;

  update dispatch_sessions
     set state = 'closed', closed_at = now(), closed_by = auth.uid()
   where id = p_session and state = 'open';

  if not found then raise exception 'Esa sesión no está abierta'; end if;

  perform log_audit('session.close', 'dispatch_session', p_session, '{}'::jsonb);
  return jsonb_build_object('status', 'closed', 'session_id', p_session);
end $$;

-- Anular no borra: marca. Y como el índice único solo cuenta las filas no
-- anuladas, la persona queda habilitada para volver a escanear.
create or replace function void_redemption(p_redemption uuid, p_reason text)
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo un administrador puede anular una entrega'
    using errcode = '42501'; end if;

  if length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'El motivo de la anulación es obligatorio';
  end if;

  update redemptions
     set voided_at = now(), voided_by = auth.uid(), void_reason = btrim(p_reason)
   where id = p_redemption and voided_at is null;

  if not found then raise exception 'Ese canje no existe o ya estaba anulado'; end if;

  perform log_audit('redemption.void', 'redemption', p_redemption,
                    jsonb_build_object('reason', btrim(p_reason)));

  return jsonb_build_object('status', 'voided', 'redemption_id', p_redemption);
end $$;

-- ═══════════════════════════════════════════════════════════════════════
--  Acta de cierre. Se calcula sobre los datos, no se congela: si después
--  se anula un canje, el acta lo refleja y lo lista como anomalía.
-- ═══════════════════════════════════════════════════════════════════════

create or replace function session_report(p_session uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_ses       dispatch_sessions;
  v_elegibles int;
  v_result    jsonb;
begin
  if not is_admin() then raise exception 'Sin permiso' using errcode = '42501'; end if;

  select * into v_ses from dispatch_sessions where id = p_session;
  if not found then raise exception 'La sesión no existe'; end if;

  select count(*) into v_elegibles
    from participants
   where event_id = v_ses.event_id and is_active
     and role = any (v_ses.eligible_roles);

  select jsonb_build_object(
    'session', jsonb_build_object(
      'id', v_ses.id, 'name', v_ses.name, 'kind', v_ses.kind, 'day', v_ses.day_number,
      'opened_at', v_ses.opened_at, 'closed_at', v_ses.closed_at,
      'duration_minutes', round(extract(epoch from (coalesce(v_ses.closed_at, now()) - v_ses.opened_at)) / 60)
    ),
    'expected',  v_elegibles,
    'delivered', (select count(*) from redemptions where session_id = p_session and voided_at is null),
    'voided',    (select count(*) from redemptions where session_id = p_session and voided_at is not null),
    'offline',   (select count(*) from redemptions where session_id = p_session and was_offline),
    'rejections', (
      select coalesce(jsonb_object_agg(result, n), '{}'::jsonb) from (
        select result::text, count(*) n from scan_attempts
         where session_id = p_session and result <> 'granted'
         group by result
      ) t
    ),
    'by_operator', (
      select coalesce(jsonb_agg(x order by x->>'name'), '[]'::jsonb) from (
        select jsonb_build_object(
                 'name', pr.display_name,
                 'station', r.station_label,
                 'delivered', count(*)
               ) x
          from redemptions r
          join profiles pr on pr.id = r.dispatched_by
         where r.session_id = p_session and r.voided_at is null
         group by pr.display_name, r.station_label
      ) t
    ),
    'by_forum', (
      select coalesce(jsonb_agg(x order by x->>'forum'), '[]'::jsonb) from (
        select jsonb_build_object(
                 'forum', coalesce(f.name, 'Sin foro'),
                 'expected', count(*),
                 'delivered', count(r.id) filter (where r.voided_at is null)
               ) x
          from participants p
          left join forums f on f.id = p.forum_id
          left join redemptions r on r.participant_id = p.id and r.session_id = p_session
         where p.event_id = v_ses.event_id and p.is_active
           and p.role = any (v_ses.eligible_roles)
         group by f.name
      ) t
    ),
    'missing', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'name', p.full_name, 'forum', coalesce(f.short_name, '—'),
               'detail', participant_label(p.id)) order by f.short_name, p.full_name), '[]'::jsonb)
        from participants p
        left join forums f on f.id = p.forum_id
       where p.event_id = v_ses.event_id and p.is_active
         and p.role = any (v_ses.eligible_roles)
         and not exists (
           select 1 from redemptions r
            where r.participant_id = p.id and r.session_id = p_session and r.voided_at is null)
    ),
    'anomalies', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'name', p.full_name, 'voided_at', r.voided_at,
               'reason', r.void_reason,
               'by', (select display_name from profiles where id = r.voided_by))), '[]'::jsonb)
        from redemptions r join participants p on p.id = r.participant_id
       where r.session_id = p_session and r.voided_at is not null
    )
  ) into v_result;

  return v_result;
end $$;
