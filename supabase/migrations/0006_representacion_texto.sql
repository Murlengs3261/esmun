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
