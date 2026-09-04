/**
 * Crea una cuenta de ESMUN desde la terminal.
 *
 *   node scripts/crear-usuario.mjs <correo> <contraseña> [--admin] [--nombre "Ana Solís"]
 *
 * Usa la service_role key de .env.local, así que corre SOLO en tu máquina:
 * esa clave se salta RLS entera y nunca debe salir de aquí.
 *
 * El perfil lo crea el trigger handle_new_user con rol 'dispatcher'.
 * --admin hace el UPDATE posterior; es la única vía de promover a admin,
 * porque la aplicación no tiene ninguna ruta que escale privilegios.
 */

import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const [email, password] = args.filter((a) => !a.startsWith("--"));

const nombreIdx = args.indexOf("--nombre");
const displayName =
  nombreIdx !== -1 ? args[nombreIdx + 1] : (email ?? "").split("@")[0];

if (!email || !password) {
  console.error(`
Uso:
  node scripts/crear-usuario.mjs <correo> <contraseña> [--admin] [--nombre "Ana Solís"]

Ejemplos:
  node scripts/crear-usuario.mjs ana@eagles.edu "una-clave" --nombre "Ana Solís"
  node scripts/crear-usuario.mjs jefe@eagles.edu "otra-clave" --admin --nombre "Mauricio L."

Si la cuenta ya existe, agrega --actualizar para cambiarle la contraseña.
`);
  process.exit(1);
}

if (password.length < 6) {
  console.error("Supabase exige mínimo 6 caracteres.");
  process.exit(1);
}

// ── Configuración ──────────────────────────────────────────────────────
const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const leer = (k) => (env.match(new RegExp(`^${k}=(.*)$`, "m")) || [])[1]?.trim();

const URL_BASE = leer("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE = leer("SUPABASE_SERVICE_ROLE_KEY");

if (!URL_BASE || !SERVICE) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

const cabeceras = {
  apikey: SERVICE,
  Authorization: `Bearer ${SERVICE}`,
  "Content-Type": "application/json",
};

async function pedir(ruta, opciones = {}) {
  const r = await fetch(URL_BASE + ruta, { ...opciones, headers: { ...cabeceras, ...opciones.headers } });
  const texto = await r.text();
  let cuerpo;
  try { cuerpo = texto ? JSON.parse(texto) : null; } catch { cuerpo = texto; }
  return { ok: r.ok, status: r.status, cuerpo };
}

// ── 1 · ¿Ya existe? ────────────────────────────────────────────────────
const lista = await pedir(`/auth/v1/admin/users?per_page=200`);
if (!lista.ok) {
  console.error("No se pudo consultar Authentication:", lista.status, lista.cuerpo);
  process.exit(1);
}

const existente = (lista.cuerpo.users ?? []).find(
  (u) => u.email?.toLowerCase() === email.toLowerCase(),
);

let userId;

if (existente) {
  if (!flags.has("--actualizar")) {
    console.error(
      `\nYa existe una cuenta con ${email}.\n` +
      `Para cambiarle la contraseña, repite el comando con --actualizar.\n`,
    );
    process.exit(1);
  }
  const upd = await pedir(`/auth/v1/admin/users/${existente.id}`, {
    method: "PUT",
    body: JSON.stringify({ password, email_confirm: true }),
  });
  if (!upd.ok) {
    console.error("No se pudo actualizar:", upd.status, upd.cuerpo);
    process.exit(1);
  }
  userId = existente.id;
  console.log(`\n✓ Contraseña actualizada para ${email}`);
} else {
  // email_confirm: true evita el correo de verificación, que todavía no
  // se puede enviar porque no hay SMTP configurado.
  const nuevo = await pedir(`/auth/v1/admin/users`, {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    }),
  });
  if (!nuevo.ok) {
    console.error("No se pudo crear la cuenta:", nuevo.status, nuevo.cuerpo);
    process.exit(1);
  }
  userId = nuevo.cuerpo.id;
  console.log(`\n✓ Cuenta creada: ${email}`);
}

// ── 2 · Rol ────────────────────────────────────────────────────────────
const rol = flags.has("--admin") ? "admin" : "dispatcher";

const perfil = await pedir(`/rest/v1/profiles?id=eq.${userId}`, {
  method: "PATCH",
  headers: { Prefer: "return=representation" },
  body: JSON.stringify({ role: rol, display_name: displayName, is_active: true }),
});

if (!perfil.ok || !perfil.cuerpo?.length) {
  console.error(
    "\nLa cuenta existe pero no se pudo escribir el perfil.",
    "\n¿Corriste las migraciones (supabase/instalar.sql)?",
    "\nDetalle:", perfil.status, perfil.cuerpo,
  );
  process.exit(1);
}

console.log(`  nombre : ${displayName}`);
console.log(`  rol    : ${rol}`);
console.log(
  rol === "admin"
    ? "\n  Ojo: la consola de admin todavía no está construida.\n"
    : "\n  Entra en http://localhost:3000/ingresar\n",
);
