-- ═══════════════════════════════════════════════════════════════════════
--  ESMUN · 0008 · Importación masiva de participantes
--
--  Una sola función con modo ensayo. La vista previa y la importación de
--  verdad corren EXACTAMENTE el mismo código, así que lo que ves en la
--  pantalla es lo que va a pasar — no una aproximación del cliente.
--
--  Todo o nada: si una fila falla en el modo real, se levanta una
--  excepción y la transacción entera se deshace. Media lista importada a
--  las once de la noche es peor que ninguna.
-- ═══════════════════════════════════════════════════════════════════════

create or replace function normalizar(t text) returns text
language sql immutable parallel safe as $$
  select lower(btrim(translate(coalesce(t, ''),
    'áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
    'aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC')));
$$;

grant execute on function normalizar(text) to authenticated;

create or replace function importar_participantes(
  p_filas  jsonb,
  p_ensayo boolean default true
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_evento    uuid;
  v_fila      jsonb;
  v_i         int := 0;
  v_errores   jsonb := '[]'::jsonb;
  v_avisos    jsonb := '[]'::jsonb;
  v_creadas   int := 0;
  v_actual    int := 0;

  v_nombre    text;
  v_rol       text;
  v_foro_txt  text;
  v_foro_id   uuid;
  v_rep       text;
  v_cargo     text;
  v_dieta     text;
  v_codigo    text;
  v_existe    uuid;
  v_codigos   text[] := '{}';
begin
  if not is_admin() then
    raise exception 'Solo un administrador puede importar' using errcode = '42501';
  end if;

  v_evento := active_event_id();
  if v_evento is null then
    raise exception 'No hay un evento activo';
  end if;

  if jsonb_typeof(p_filas) <> 'array' then
    raise exception 'Se esperaba una lista de filas';
  end if;

  for v_fila in select * from jsonb_array_elements(p_filas) loop
    v_i := v_i + 1;

    v_nombre   := nullif(btrim(coalesce(v_fila ->> 'nombre', '')), '');
    v_rol      := normalizar(v_fila ->> 'rol');
    v_foro_txt := nullif(btrim(coalesce(v_fila ->> 'foro', '')), '');
    v_rep      := nullif(btrim(coalesce(v_fila ->> 'representacion', '')), '');
    v_cargo    := nullif(btrim(coalesce(v_fila ->> 'cargo', '')), '');
    v_dieta    := nullif(upper(btrim(coalesce(v_fila ->> 'dieta', ''))), '');
    v_codigo   := nullif(btrim(coalesce(v_fila ->> 'codigo', '')), '');
    v_foro_id  := null;

    -- Nombre
    if v_nombre is null then
      v_errores := v_errores || jsonb_build_object(
        'fila', v_i, 'campo', 'nombre', 'mensaje', 'Falta el nombre.');
      continue;
    end if;

    -- Rol
    v_rol := case v_rol
               when 'delegado'  then 'delegado'
               when 'delegada'  then 'delegado'
               when 'mesa'      then 'mesa'
               when 'staff'     then 'staff'
               when 'prensa'    then 'prensa'
               when 'invitado'  then 'invitado'
               when 'invitada'  then 'invitado'
               else null
             end;

    if v_rol is null then
      v_errores := v_errores || jsonb_build_object(
        'fila', v_i, 'campo', 'rol',
        'mensaje', format('Rol no reconocido: «%s». Usa Delegado, Mesa, Staff, Prensa o Invitado.',
                          coalesce(v_fila ->> 'rol', '')));
      continue;
    end if;

    -- Foro: se acepta el nombre completo o el corto, sin distinguir
    -- mayúsculas ni acentos.
    if v_foro_txt is not null then
      select f.id into v_foro_id
        from forums f
       where f.event_id = v_evento
         and (normalizar(f.name) = normalizar(v_foro_txt)
              or normalizar(f.short_name) = normalizar(v_foro_txt))
       limit 1;

      if v_foro_id is null then
        v_errores := v_errores || jsonb_build_object(
          'fila', v_i, 'campo', 'foro',
          'mensaje', format('No existe el foro «%s».', v_foro_txt));
        continue;
      end if;
    end if;

    if v_rol in ('delegado', 'mesa') and v_foro_id is null then
      v_errores := v_errores || jsonb_build_object(
        'fila', v_i, 'campo', 'foro',
        'mensaje', 'Un delegado o una mesa necesitan foro.');
      continue;
    end if;

    if v_rol = 'delegado' and v_rep is null then
      v_errores := v_errores || jsonb_build_object(
        'fila', v_i, 'campo', 'representacion',
        'mensaje', 'Un delegado necesita el país o personaje que representa.');
      continue;
    end if;

    -- Código repetido dentro del mismo archivo
    if v_codigo is not null then
      if v_codigo = any (v_codigos) then
        v_errores := v_errores || jsonb_build_object(
          'fila', v_i, 'campo', 'codigo',
          'mensaje', format('El código «%s» aparece dos veces en el archivo.', v_codigo));
        continue;
      end if;
      v_codigos := v_codigos || v_codigo;
    end if;

    -- ¿Ya existe? Por código si lo hay; si no, por nombre dentro del foro.
    v_existe := null;
    if v_codigo is not null then
      select id into v_existe from participants
       where event_id = v_evento and external_code = v_codigo;
    else
      select id into v_existe from participants
       where event_id = v_evento
         and normalizar(full_name) = normalizar(v_nombre)
         and forum_id is not distinct from v_foro_id;

      if v_existe is not null then
        v_avisos := v_avisos || jsonb_build_object(
          'fila', v_i, 'campo', 'nombre',
          'mensaje', format('Ya hay un «%s» en ese foro; se va a actualizar. Con código de estudiante esto deja de ser ambiguo.',
                            v_nombre));
      end if;
    end if;

    if v_existe is not null then v_actual := v_actual + 1;
    else v_creadas := v_creadas + 1;
    end if;

    if not p_ensayo then
      if v_existe is not null then
        update participants
           set full_name = v_nombre, role = v_rol::participant_role,
               forum_id = v_foro_id,
               representation = case when v_rol = 'delegado' then v_rep end,
               position = case when v_rol = 'mesa' then v_cargo end,
               dietary_notes = v_dieta,
               external_code = coalesce(v_codigo, external_code),
               is_active = true
         where id = v_existe;
      else
        insert into participants
          (event_id, full_name, role, forum_id, representation, position,
           dietary_notes, external_code)
        values
          (v_evento, v_nombre, v_rol::participant_role, v_foro_id,
           case when v_rol = 'delegado' then v_rep end,
           case when v_rol = 'mesa' then v_cargo end,
           v_dieta, v_codigo);
      end if;
    end if;
  end loop;

  -- Todo o nada: cualquier error en modo real deshace la transacción.
  if not p_ensayo and jsonb_array_length(v_errores) > 0 then
    raise exception 'La importación se canceló: hay % filas con errores.',
      jsonb_array_length(v_errores);
  end if;

  if not p_ensayo then
    perform log_audit('participants.import', 'participant', null,
      jsonb_build_object('creadas', v_creadas, 'actualizadas', v_actual));
  end if;

  return jsonb_build_object(
    'total',        v_i,
    'creadas',      v_creadas,
    'actualizadas', v_actual,
    'errores',      v_errores,
    'avisos',       v_avisos,
    'ensayo',       p_ensayo
  );
end $$;

revoke execute on function importar_participantes(jsonb, boolean) from anon, public;
grant execute on function importar_participantes(jsonb, boolean) to authenticated;
