-- ═══════════════════════════════════════════════════════════════════
--  ESMUN · Migraciones pendientes (0006 y 0007)
--  Pegar en el SQL Editor de Supabase y ejecutar.
--  0006 · país/personaje como texto libre
--  0007 · logo del evento + crear/borrar/reordenar sesiones
-- ═══════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════
--  ESMUN · 0006 · La representación pasa a texto libre
--
--  Todavía no hay lista de países, y además habrá personajes (un comité
--  histórico representa personas, no estados). Así que por ahora se
--  escribe a mano: 'Francia', 'Simón Bolívar', 'Angela Merkel'.
--
--  El catálogo de delegations NO se elimina. Cuando exista la lista real
--  se cargan los países y se migran los textos a delegation_id sin tocar
--  el esquema: los dos caminos conviven.
-- ═══════════════════════════════════════════════════════════════════════

alter table participants
  add column if not exists representation text;

comment on column participants.representation is
  'País o personaje escrito a mano, mientras no exista catálogo. Si hay delegation_id, ese manda.';

-- Un delegado necesita foro y ALGO que representar: o una delegación del
-- catálogo, o el texto libre. Lo que no puede es no tener ninguno de los dos.
alter table participants drop constraint if exists delegado_requiere_foro_y_pais;

alter table participants
  add constraint delegado_requiere_foro_y_representacion
  check (
    role <> 'delegado'
    or (
      forum_id is not null
      and (delegation_id is not null or length(btrim(coalesce(representation, ''))) > 0)
    )
  );

-- El texto libre es solo para delegados, igual que el cupo de país.
alter table participants
  add constraint solo_delegado_representa
  check (representation is null or role = 'delegado');

create index if not exists participants_representation_idx
  on participants (event_id, representation);

-- La etiqueta que ve el despachador: el catálogo tiene prioridad sobre el
-- texto, para que el día que se migren los países no haya que tocar nada.
create or replace function participant_label(p_id uuid) returns text
language sql stable security definer set search_path = public as $$
  select case
    when p.role = 'delegado'
      then f.name || ' · ' || coalesce(d.country, p.representation, 'Sin asignar')
    when p.role = 'mesa'
      then f.name || coalesce(' · ' || p.position, '')
    else initcap(p.role::text)
  end
  from participants p
  left join forums f      on f.id = p.forum_id
  left join delegations d on d.id = p.delegation_id
  where p.id = p_id;
$$;


-- ═══════════════════════════════════════════════════════════════════════
--  ESMUN · 0007 · Marca del evento y gestión de sesiones
--
--  1. Logo del evento, guardado en Storage.
--  2. Poder crear, borrar y reordenar sesiones sin romper el historial.
-- ═══════════════════════════════════════════════════════════════════════

-- ── Marca ──────────────────────────────────────────────────────────────

alter table events
  add column if not exists logo_url   text,
  add column if not exists logo_path  text;   -- ruta en Storage, para poder reemplazarlo

comment on column events.logo_path is
  'Ruta dentro del bucket "marca". Se guarda para borrar el archivo anterior al subir uno nuevo.';

-- Bucket público: el logo va impreso en los gafetes y visible en el
-- ingreso, que es una pantalla sin sesión iniciada.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('marca', 'marca', true, 2097152,
        array['image/png','image/jpeg','image/svg+xml','image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = 2097152,
      allowed_mime_types = array['image/png','image/jpeg','image/svg+xml','image/webp'];

drop policy if exists marca_lectura_publica on storage.objects;
create policy marca_lectura_publica on storage.objects
  for select using (bucket_id = 'marca');

drop policy if exists marca_escritura_admin on storage.objects;
create policy marca_escritura_admin on storage.objects
  for all to authenticated
  using (bucket_id = 'marca' and is_admin())
  with check (bucket_id = 'marca' and is_admin());

-- ── Sesiones: crear, borrar, reordenar ─────────────────────────────────
-- El admin ya tiene política de escritura sobre dispatch_sessions, así que
-- insert y update funcionan directo. Lo que hace falta es impedir borrados
-- que destruyan historial.

create or replace function proteger_borrado_sesion() returns trigger
language plpgsql as $$
declare
  v_canjes int;
begin
  if old.state = 'open' then
    raise exception 'No se puede borrar una sesión abierta. Ciérrala primero.';
  end if;

  select count(*) into v_canjes from redemptions where session_id = old.id;
  if v_canjes > 0 then
    raise exception
      'Esa sesión tiene % entregas registradas. Borrarla destruiría el acta.', v_canjes;
  end if;

  return old;
end $$;

drop trigger if exists proteger_borrado_sesion_trg on dispatch_sessions;
create trigger proteger_borrado_sesion_trg
  before delete on dispatch_sessions
  for each row execute function proteger_borrado_sesion();

-- Reordenar en una sola llamada: recibe los ids en el orden deseado y
-- reescribe sort_order. Hacerlo fila por fila desde el cliente deja el
-- orden inconsistente si se corta a la mitad.
create or replace function reordenar_sesiones(p_ids uuid[]) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_evento uuid;
begin
  if not is_admin() then
    raise exception 'Solo un administrador puede reordenar las sesiones'
      using errcode = '42501';
  end if;

  v_evento := active_event_id();

  if exists (
    select 1 from unnest(p_ids) id
     where id not in (select s.id from dispatch_sessions s where s.event_id = v_evento)
  ) then
    raise exception 'Hay identificadores que no pertenecen a este evento';
  end if;

  update dispatch_sessions s
     set sort_order = t.orden
    from (select id, row_number() over () as orden from unnest(p_ids) as id) t
   where s.id = t.id and s.event_id = v_evento;

  perform log_audit('sessions.reorder', 'dispatch_session', null,
                    jsonb_build_object('total', array_length(p_ids, 1)));
end $$;

revoke execute on function reordenar_sesiones(uuid[]) from anon, public;
grant execute on function reordenar_sesiones(uuid[]) to authenticated;
