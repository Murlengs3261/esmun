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
