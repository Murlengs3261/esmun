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
