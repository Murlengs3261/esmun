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
