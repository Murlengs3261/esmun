-- ═══════════════════════════════════════════════════════════════════════
--  ESMUN · Crear una cuenta desde el SQL Editor
--
--  Cambia las tres variables de abajo y ejecuta. Si el correo ya existe,
--  solo le cambia la contraseña.
--
--  Nota: escribir directo en auth.users no es la vía oficial de Supabase.
--  Funciona, pero si algún día una actualización de GoTrue cambia esas
--  columnas, este script se rompe y el de Authentication → Add user no.
-- ═══════════════════════════════════════════════════════════════════════

do $$
declare
  v_email  text := 'correo@ejemplo.com';
  v_pass   text := 'cambia-esta-contrasena';
  v_nombre text := 'Nombre Apellido';
  v_rol    app_role := 'admin';          -- 'admin' o 'dispatcher'
  v_id     uuid;
begin
  select id into v_id from auth.users where lower(email) = lower(v_email);

  if v_id is not null then
    update auth.users
       set encrypted_password = crypt(v_pass, gen_salt('bf')),
           email_confirmed_at = coalesce(email_confirmed_at, now()),
           updated_at         = now()
     where id = v_id;
    raise notice 'Contraseña actualizada para %', v_email;

  else
    v_id := gen_random_uuid();

    -- email_confirmed_at con valor = cuenta ya verificada. Sin esto habría
    -- que confirmar por correo, y todavía no hay SMTP configurado.
    -- Los cuatro tokens van en '' y no en NULL: GoTrue no tolera nulos ahí.
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_id, 'authenticated', 'authenticated',
      lower(v_email), crypt(v_pass, gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('display_name', v_nombre),
      now(), now(),
      '', '', '', ''
    );

    -- Sin la identidad, el inicio de sesión por contraseña falla.
    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_id, v_id::text,
      jsonb_build_object('sub', v_id::text, 'email', lower(v_email), 'email_verified', true),
      'email', now(), now(), now()
    );

    raise notice 'Cuenta creada: %', v_email;
  end if;

  -- El trigger on_auth_user_created ya dejó el perfil como 'dispatcher'.
  -- Esto solo ajusta rol y nombre.
  update profiles
     set role = v_rol, display_name = v_nombre, is_active = true
   where id = v_id;

  if not found then
    raise exception 'No se creó el perfil. ¿Corriste supabase/instalar.sql?';
  end if;

  raise notice 'Rol: %', v_rol;
end $$;

-- Comprobación
select u.email, p.display_name, p.role, u.email_confirmed_at is not null as confirmada
  from auth.users u join profiles p on p.id = u.id;
