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
