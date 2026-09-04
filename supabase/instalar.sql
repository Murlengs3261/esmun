-- ═══════════════════════════════════════════════════════════════════
--  ESMUN · Instalación completa
--  Pegar TODO este archivo en el SQL Editor de Supabase y ejecutar.
--  Incluye los 20 foros reales.
--  Probado con 32 aserciones sobre Postgres 18 (npm run test:db).
-- ═══════════════════════════════════════════════════════════════════


-- ╭───────────────────────────────────────────────────────────────╮
-- │  0001_schema.sql                                              │
-- ╰───────────────────────────────────────────────────────────────╯
-- ═══════════════════════════════════════════════════════════════════════
--  ESMUN · 0001 · Esquema base
--  Todo cuelga de events. Las entregas son filas que se insertan, nunca
--  campos que se modifican: esa es la premisa de todo el sistema.
-- ═══════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ── Tipos ──────────────────────────────────────────────────────────────

create type participant_role as enum ('mesa', 'delegado', 'staff', 'prensa', 'invitado');
create type session_state    as enum ('draft', 'open', 'closed');
create type session_kind     as enum ('refrigerio', 'almuerzo', 'acreditacion', 'otro');
create type app_role         as enum ('admin', 'dispatcher');
create type scan_result      as enum (
  'granted', 'duplicate', 'unknown_token', 'not_eligible', 'session_closed', 'inactive'
);

-- ── Utilidad ───────────────────────────────────────────────────────────

create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ── Evento ─────────────────────────────────────────────────────────────

create table events (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,                              -- 'ESMUN 2026'
  organization  text not null default 'Colegio Eagles',
  starts_on     date not null,
  ends_on       date not null,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint fechas_coherentes check (ends_on >= starts_on)
);

-- Un solo evento activo a la vez. El sistema entero opera contra él.
create unique index events_un_solo_activo on events (is_active) where is_active;

create trigger events_touch before update on events
  for each row execute function touch_updated_at();

-- ── Usuarios del sistema ───────────────────────────────────────────────
-- profiles.id == auth.users.id. Un despachador es una cuenta con rol
-- 'dispatcher'; no hay forma de escalar a admin desde la aplicación.

create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  event_id      uuid references events(id) on delete cascade,
  display_name  text not null check (length(btrim(display_name)) > 0),
  role          app_role not null default 'dispatcher',
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index profiles_event_role_idx on profiles (event_id, role) where is_active;

create trigger profiles_touch before update on profiles
  for each row execute function touch_updated_at();

-- ── Puestos de despacho ────────────────────────────────────────────────
-- Configurables por evento: el nombre y el número de puestos cambian
-- entre días y no pueden vivir en el código.

create table stations (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references events(id) on delete cascade,
  label       text not null,        -- 'Puesto 1'
  location    text,                 -- 'Patio central'
  sort_order  smallint not null default 0,
  is_active   boolean not null default true,
  unique (event_id, label)
);

-- ── Foros y delegaciones ───────────────────────────────────────────────

create table forums (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references events(id) on delete cascade,
  name        text not null,        -- 'Consejo de Seguridad'
  short_name  text not null,        -- 'C. de Seguridad' — usado en filas estrechas
  sort_order  smallint not null default 0,
  created_at  timestamptz not null default now(),
  unique (event_id, name),
  unique (event_id, short_name)
);

-- Un país dentro de un foro. Francia en el CS y Francia en ECOSOC son
-- dos filas distintas. seats = cupo de delegados (doble delegación = 2).
create table delegations (
  id        uuid primary key default gen_random_uuid(),
  forum_id  uuid not null references forums(id) on delete cascade,
  country   text not null,
  seats     smallint not null default 2 check (seats between 1 and 4),
  unique (forum_id, country)
);

create index delegations_forum_idx on delegations (forum_id);

-- ── Participantes ──────────────────────────────────────────────────────
-- qr_token: 128 bits aleatorios. No es el id de la persona ni deriva de
-- ningún dato suyo, así que un gafete falsificado no corresponde a nadie.

create table participants (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references events(id) on delete cascade,
  external_code  text,                                    -- código de estudiante; clave estable de importación
  full_name      text not null check (length(btrim(full_name)) > 0),
  role           participant_role not null,
  forum_id       uuid references forums(id) on delete restrict,
  delegation_id  uuid references delegations(id) on delete restrict,
  position       text,                                    -- 'Presidente', 'Moderador'…
  dietary_notes  text,                                    -- 'SIN GLUTEN', 'ALERGIA AL MANÍ'
  qr_token       text not null unique default 'esm-' || encode(gen_random_bytes(16), 'hex'),
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- Las reglas de negocio viven en la base, no solo en el formulario
  constraint mesa_requiere_foro
    check (role <> 'mesa' or forum_id is not null),
  constraint delegado_requiere_foro_y_pais
    check (role <> 'delegado' or (forum_id is not null and delegation_id is not null)),
  constraint solo_delegado_ocupa_pais
    check (delegation_id is null or role = 'delegado')     -- la mesa no consume cupo
);

create index participants_event_idx        on participants (event_id) where is_active;
create index participants_forum_idx        on participants (forum_id);
create index participants_delegation_idx   on participants (delegation_id);
create index participants_name_idx         on participants (event_id, full_name);
create unique index participants_codigo_uq on participants (event_id, external_code)
  where external_code is not null;

create trigger participants_touch before update on participants
  for each row execute function touch_updated_at();

-- Coherencia que un CHECK no puede expresar porque cruza tablas:
-- el foro pertenece al evento, el país pertenece a ese foro, y el cupo
-- de la delegación no se puede exceder.
create or replace function participants_validate() returns trigger
language plpgsql as $$
declare
  v_forum_event uuid;
  v_deleg_forum uuid;
  v_seats       smallint;
  v_ocupados    int;
begin
  if new.forum_id is not null then
    select event_id into v_forum_event from forums where id = new.forum_id;
    if v_forum_event is distinct from new.event_id then
      raise exception 'El foro no pertenece a este evento';
    end if;
  end if;

  if new.delegation_id is not null then
    select forum_id, seats into v_deleg_forum, v_seats
      from delegations where id = new.delegation_id;

    if v_deleg_forum is distinct from new.forum_id then
      raise exception 'El país elegido no pertenece al foro seleccionado';
    end if;

    if new.is_active then
      select count(*) into v_ocupados
        from participants
       where delegation_id = new.delegation_id
         and is_active
         and id <> new.id;

      if v_ocupados >= v_seats then
        raise exception 'Esa delegación ya tiene sus % cupos ocupados', v_seats
          using errcode = 'check_violation';
      end if;
    end if;
  end if;

  return new;
end $$;

create trigger participants_validate_trg
  before insert or update on participants
  for each row execute function participants_validate();

-- ── Sesiones de despacho ───────────────────────────────────────────────
-- Seis por evento: dos por día durante tres días. El admin las abre y
-- cierra a mano; nada se activa por reloj.

create table dispatch_sessions (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references events(id) on delete cascade,
  name            text not null,                    -- 'Refrigerio de la mañana'
  kind            session_kind not null default 'refrigerio',
  day_number      smallint,                         -- 1, 2, 3
  state           session_state not null default 'draft',
  eligible_roles  participant_role[] not null
                    default array['mesa','delegado','staff','prensa']::participant_role[],
  scheduled_at    timestamptz,
  opened_at       timestamptz,
  closed_at       timestamptz,
  opened_by       uuid references profiles(id) on delete set null,
  closed_by       uuid references profiles(id) on delete set null,
  sort_order      smallint not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint roles_no_vacios check (array_length(eligible_roles, 1) > 0),
  constraint cierre_posterior check (closed_at is null or opened_at is null or closed_at >= opened_at)
);

-- Solo una sesión abierta a la vez por evento. Elimina de raíz el error
-- humano de dejar dos ventanas de entrega vivas al mismo tiempo.
create unique index sesion_abierta_unica
  on dispatch_sessions (event_id) where state = 'open';

create index dispatch_sessions_event_idx on dispatch_sessions (event_id, sort_order);

create trigger dispatch_sessions_touch before update on dispatch_sessions
  for each row execute function touch_updated_at();

-- ── Canjes ─────────────────────────────────────────────────────────────
-- El corazón del sistema. Insert-only: nadie edita ni borra durante el
-- despacho. Anular es marcar voided_at, y el índice único parcial deja
-- entonces libre el cupo para volver a escanear.

create table redemptions (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references dispatch_sessions(id) on delete cascade,
  participant_id  uuid not null references participants(id) on delete cascade,
  dispatched_by   uuid not null references profiles(id) on delete restrict,
  station_label   text,
  device_id       text,                          -- distingue dos teléfonos en el mismo puesto
  redeemed_at     timestamptz not null default now(),
  was_offline     boolean not null default false,
  synced_at       timestamptz,                   -- cuándo subió, si vino de la cola local
  voided_at       timestamptz,
  voided_by       uuid references profiles(id) on delete set null,
  void_reason     text,
  constraint anulacion_completa check (
    voided_at is null
    or (voided_by is not null and length(btrim(coalesce(void_reason, ''))) >= 5)
  )
);

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║  LA GARANTÍA. Dos teléfonos escaneando el mismo gafete en el      ║
-- ║  mismo milisegundo: Postgres deja pasar exactamente uno.          ║
-- ║  No es una comprobación, es una imposibilidad en el motor.        ║
-- ╚═══════════════════════════════════════════════════════════════════╝
create unique index canje_activo_unico
  on redemptions (session_id, participant_id) where voided_at is null;

create index redemptions_session_idx   on redemptions (session_id, redeemed_at desc);
create index redemptions_operator_idx  on redemptions (session_id, dispatched_by) where voided_at is null;
create index redemptions_participant_idx on redemptions (participant_id);

-- ── Auditoría ──────────────────────────────────────────────────────────

-- Todo escaneo, incluidos los rechazados. Sin datos personales propios:
-- solo referencias. Es lo que responde "yo nunca recibí mi refrigerio".
create table scan_attempts (
  id              bigint generated always as identity primary key,
  session_id      uuid references dispatch_sessions(id) on delete set null,
  participant_id  uuid references participants(id) on delete set null,
  scanned_token   text,
  result          scan_result not null,
  operator_id     uuid references profiles(id) on delete set null,
  station_label   text,
  device_id       text,
  created_at      timestamptz not null default now()
);

create index scan_attempts_session_idx on scan_attempts (session_id, created_at desc);
create index scan_attempts_result_idx  on scan_attempts (session_id, result);

-- Acciones administrativas. Nadie corrige datos en silencio.
create table audit_log (
  id          bigint generated always as identity primary key,
  event_id    uuid references events(id) on delete cascade,
  actor_id    uuid references profiles(id) on delete set null,
  action      text not null,     -- 'session.open', 'redemption.void', 'roster.download'…
  entity      text not null,
  entity_id   uuid,
  detail      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index audit_log_event_idx on audit_log (event_id, created_at desc);


-- ╭───────────────────────────────────────────────────────────────╮
-- │  0002_functions.sql                                           │
-- ╰───────────────────────────────────────────────────────────────╯
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


-- ╭───────────────────────────────────────────────────────────────╮
-- │  0003_rls.sql                                                 │
-- ╰───────────────────────────────────────────────────────────────╯
-- ═══════════════════════════════════════════════════════════════════════
--  ESMUN · 0003 · Row Level Security
--
--  El límite de seguridad vive aquí, no en React. Un despachador con las
--  DevTools abiertas no llega a la lista de participantes: no existe
--  ninguna política que se lo permita.
-- ═══════════════════════════════════════════════════════════════════════

alter table events            enable row level security;
alter table profiles          enable row level security;
alter table stations          enable row level security;
alter table forums            enable row level security;
alter table delegations       enable row level security;
alter table participants      enable row level security;
alter table dispatch_sessions enable row level security;
alter table redemptions       enable row level security;
alter table scan_attempts     enable row level security;
alter table audit_log         enable row level security;

-- ── Nadie escribe canjes ni auditoría a mano ───────────────────────────
-- Ni el admin. redeem_qr y void_redemption son la única vía.
revoke insert, update, delete on redemptions   from anon, authenticated;
revoke insert, update, delete on scan_attempts from anon, authenticated;
revoke insert, update, delete on audit_log     from anon, authenticated;
revoke all on participants from anon;
revoke all on redemptions  from anon;

-- ── events ─────────────────────────────────────────────────────────────
create policy events_read on events
  for select to authenticated using (true);
create policy events_admin_write on events
  for all to authenticated using (is_admin()) with check (is_admin());

-- ── profiles ───────────────────────────────────────────────────────────
-- Cada quien se ve a sí mismo. El admin ve y gestiona a todos.
create policy profiles_self on profiles
  for select to authenticated using (id = auth.uid());
create policy profiles_admin_read on profiles
  for select to authenticated using (is_admin());
create policy profiles_admin_write on profiles
  for all to authenticated using (is_admin()) with check (is_admin());

-- ── stations ───────────────────────────────────────────────────────────
-- El despachador necesita la lista para elegir su puesto.
create policy stations_read on stations
  for select to authenticated using (is_dispatcher());
create policy stations_admin_write on stations
  for all to authenticated using (is_admin()) with check (is_admin());

-- ── forums · delegations ───────────────────────────────────────────────
-- Solo admin. El despachador recibe el foro y el país ya resueltos como
-- texto dentro de la respuesta de redeem_qr.
create policy forums_admin on forums
  for all to authenticated using (is_admin()) with check (is_admin());
create policy delegations_admin on delegations
  for all to authenticated using (is_admin()) with check (is_admin());

-- ── participants ───────────────────────────────────────────────────────
-- SOLO ADMIN. No hay política para dispatcher, y esa ausencia es la
-- función de seguridad: si ese teléfono se pierde, no se va con él el
-- listado de 350 menores de edad.
create policy participants_admin on participants
  for all to authenticated using (is_admin()) with check (is_admin());

-- ── dispatch_sessions ──────────────────────────────────────────────────
-- El despachador lee (necesita saber si hay sesión abierta y cómo se
-- llama). Escribir es del admin, y abrir/cerrar pasa por función.
create policy sessions_read on dispatch_sessions
  for select to authenticated using (is_dispatcher());
create policy sessions_admin_write on dispatch_sessions
  for all to authenticated using (is_admin()) with check (is_admin());

-- ── redemptions ────────────────────────────────────────────────────────
-- Lectura: el admin ve todo (panel en vivo). El despachador ve solo sus
-- propias filas, que es lo que alimenta el contador de su turno.
create policy redemptions_admin_read on redemptions
  for select to authenticated using (is_admin());
create policy redemptions_own_read on redemptions
  for select to authenticated using (dispatched_by = auth.uid());

-- ── auditoría ──────────────────────────────────────────────────────────
create policy scan_attempts_admin on scan_attempts
  for select to authenticated using (is_admin());
create policy audit_log_admin on audit_log
  for select to authenticated using (is_admin());

-- ── Ejecución de funciones ─────────────────────────────────────────────
revoke execute on function redeem_qr(text, text, text, timestamptz) from anon, public;
revoke execute on function session_roster()                          from anon, public;
revoke execute on function open_session(uuid)                        from anon, public;
revoke execute on function close_session(uuid)                       from anon, public;
revoke execute on function void_redemption(uuid, text)               from anon, public;
revoke execute on function session_report(uuid)                      from anon, public;
revoke execute on function log_attempt(uuid, uuid, text, scan_result, text, text) from anon, public, authenticated;
revoke execute on function log_audit(text, text, uuid, jsonb)        from anon, public, authenticated;

grant execute on function redeem_qr(text, text, text, timestamptz) to authenticated;
grant execute on function session_roster()                          to authenticated;
grant execute on function my_turn_count(text)                       to authenticated;
grant execute on function open_session(uuid)                        to authenticated;
grant execute on function close_session(uuid)                       to authenticated;
grant execute on function void_redemption(uuid, text)               to authenticated;
grant execute on function session_report(uuid)                      to authenticated;
grant execute on function participant_label(uuid)                   to authenticated;
grant execute on function is_admin()                                to authenticated;
grant execute on function is_dispatcher()                           to authenticated;
grant execute on function active_event_id()                         to authenticated;

-- ── Realtime ───────────────────────────────────────────────────────────
-- El panel en vivo se suscribe a redemptions. La política de lectura de
-- arriba aplica igual en Realtime: el despachador solo recibe lo suyo.
alter publication supabase_realtime add table redemptions;
alter publication supabase_realtime add table dispatch_sessions;


-- ╭───────────────────────────────────────────────────────────────╮
-- │  0004_seed.sql                                                │
-- ╰───────────────────────────────────────────────────────────────╯
-- ═══════════════════════════════════════════════════════════════════════
--  ESMUN · 0004 · Datos iniciales
--  Idempotente: se puede correr varias veces sin duplicar nada.
--  Los 20 foros son los reales. Las FECHAS siguen siendo provisionales:
--  se editan desde el panel de admin, no volviendo a tocar este archivo.
-- ═══════════════════════════════════════════════════════════════════════

do $$
declare
  v_event uuid;
begin
  select id into v_event from events where is_active limit 1;

  if v_event is null then
    insert into events (name, organization, starts_on, ends_on)
    values ('ESMUN 2026', 'Colegio Eagles', '2026-09-16', '2026-09-18')
    returning id into v_event;
  end if;

  -- ── Puestos de despacho ──────────────────────────────────────────────
  insert into stations (event_id, label, location, sort_order)
  select v_event, s.label, s.location, s.ord
    from (values
      ('Puesto 1', 'Patio central',          1),
      ('Puesto 2', 'Pasillo de aulas',       2),
      ('Puesto 3', 'Entrada del auditorio',  3)
    ) as s(label, location, ord)
   where not exists (
     select 1 from stations x where x.event_id = v_event and x.label = s.label
   );

  -- ── Las seis ventanas de entrega ─────────────────────────────────────
  -- Se crean en 'draft'. El admin las abre y cierra a mano el día del
  -- evento; ninguna se activa por reloj.
  insert into dispatch_sessions (event_id, name, kind, day_number, sort_order, eligible_roles)
  select v_event, s.name, s.kind::session_kind, s.day, s.ord,
         array['mesa','delegado','staff','prensa']::participant_role[]
    from (values
      ('Día 1 · Refrigerio de la mañana', 'refrigerio', 1, 1),
      ('Día 1 · Almuerzo',                'almuerzo',   1, 2),
      ('Día 2 · Refrigerio de la mañana', 'refrigerio', 2, 3),
      ('Día 2 · Almuerzo',                'almuerzo',   2, 4),
      ('Día 3 · Refrigerio de la mañana', 'refrigerio', 3, 5),
      ('Día 3 · Almuerzo',                'almuerzo',   3, 6)
    ) as s(name, kind, day, ord)
   where not exists (
     select 1 from dispatch_sessions x where x.event_id = v_event and x.name = s.name
   );

  -- ── Los 20 foros de ESMUN ────────────────────────────────────────────
  -- Lista real entregada por la organización. El orden es el suyo.
  insert into forums (event_id, name, short_name, sort_order)
  select v_event, f.name, f.short_name, f.ord
    from (values
      ('UNICEF Jr', 'UNICEF Jr', 1),
      ('Nacional Jr', 'Nacional Jr', 2),
      ('Juventud Jr', 'Juventud Jr', 3),
      ('ONU Mujeres Jr', 'ONU Muj. Jr', 4),
      ('ONUDC 1 Jr', 'ONUDC 1 Jr', 5),
      ('ONUDC 2 Jr', 'ONUDC 2 Jr', 6),
      ('CSI Jr', 'CSI Jr', 7),
      ('SOCHUM 1', 'SOCHUM 1', 8),
      ('SOCHUM 2', 'SOCHUM 2', 9),
      ('Juventud', 'Juventud', 10),
      ('ONUDC', 'ONUDC', 11),
      ('UNICEF', 'UNICEF', 12),
      ('PNUMA', 'PNUMA', 13),
      ('Asamblea General', 'Asamblea Gral.', 14),
      ('OMS', 'OMS', 15),
      ('Nacional Histórico', 'Nac. Histórico', 16),
      ('ONU Mujeres', 'ONU Mujeres', 17),
      ('CSI', 'CSI', 18),
      ('CEPAL', 'CEPAL', 19),
      ('Foro Prensa', 'Prensa', 20)
    ) as f(name, short_name, ord)
   where not exists (
     select 1 from forums x where x.event_id = v_event and x.name = f.name
   );
end $$;

-- ═══════════════════════════════════════════════════════════════════════
--  Alta automática de perfil al crear una cuenta.
--  Todos nacen como 'dispatcher'. Promover a admin es un UPDATE manual
--  desde la consola de Supabase: no hay ninguna ruta en la aplicación que
--  permita escalar privilegios.
-- ═══════════════════════════════════════════════════════════════════════

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, event_id, display_name, role)
  values (
    new.id,
    (select id from events where is_active limit 1),
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1)),
    'dispatcher'
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();


-- ╭───────────────────────────────────────────────────────────────╮
-- │  0005_foros_reales.sql                                        │
-- ╰───────────────────────────────────────────────────────────────╯
-- ═══════════════════════════════════════════════════════════════════════
--  ESMUN · 0005 · Los 20 foros reales
--  Solo hace falta si ya corriste la semilla con los foros de ejemplo.
--  En una instalación nueva no encuentra nada que borrar y no hace nada.
-- ═══════════════════════════════════════════════════════════════════════

do $$
declare
  v_event uuid;
begin
  select id into v_event from events where is_active limit 1;
  if v_event is null then
    raise exception 'No hay evento activo. Corre antes 0004_seed.sql.';
  end if;

  -- Fuera los de ejemplo. El delete solo alcanza a los que nadie usa:
  -- participants.forum_id es "on delete restrict", así que si alguno ya
  -- tuviera gente asignada, esto falla en vez de arrastrarla.
  -- 'Asamblea General' NO se borra: también es un foro real.
  delete from forums
   where event_id = v_event
     and name in ('Consejo de Seguridad', 'ECOSOC', 'DISEC', 'Consejo de Derechos Humanos', 'UNESCO', 'Organización Mundial de la Salud', 'Corte Internacional de Justicia')
     and not exists (select 1 from participants p where p.forum_id = forums.id);

  insert into forums (event_id, name, short_name, sort_order)
  select v_event, f.name, f.short_name, f.ord
    from (values
      ('UNICEF Jr', 'UNICEF Jr', 1),
      ('Nacional Jr', 'Nacional Jr', 2),
      ('Juventud Jr', 'Juventud Jr', 3),
      ('ONU Mujeres Jr', 'ONU Muj. Jr', 4),
      ('ONUDC 1 Jr', 'ONUDC 1 Jr', 5),
      ('ONUDC 2 Jr', 'ONUDC 2 Jr', 6),
      ('CSI Jr', 'CSI Jr', 7),
      ('SOCHUM 1', 'SOCHUM 1', 8),
      ('SOCHUM 2', 'SOCHUM 2', 9),
      ('Juventud', 'Juventud', 10),
      ('ONUDC', 'ONUDC', 11),
      ('UNICEF', 'UNICEF', 12),
      ('PNUMA', 'PNUMA', 13),
      ('Asamblea General', 'Asamblea Gral.', 14),
      ('OMS', 'OMS', 15),
      ('Nacional Histórico', 'Nac. Histórico', 16),
      ('ONU Mujeres', 'ONU Mujeres', 17),
      ('CSI', 'CSI', 18),
      ('CEPAL', 'CEPAL', 19),
      ('Foro Prensa', 'Prensa', 20)
    ) as f(name, short_name, ord)
   where not exists (
     select 1 from forums x where x.event_id = v_event and x.name = f.name
   );

  if (select count(*) from forums where event_id = v_event) <> 20 then
    raise warning 'Se esperaban 20 foros y hay %.',
      (select count(*) from forums where event_id = v_event);
  end if;
end $$;
