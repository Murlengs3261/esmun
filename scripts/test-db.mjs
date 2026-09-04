import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Corre las migraciones reales sobre un Postgres 18 en WASM y comprueba
// las garantías del sistema. No toca ninguna base de datos remota.
const DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "supabase", "migrations");
const db = await PGlite.create();

// PGlite: ejecuta un script con varias sentencias.
const runSql = db.exec.bind(db);

let pass = 0, fail = 0;
const ok  = (m) => { pass++; console.log("  \x1b[32m✓\x1b[0m " + m); };
const bad = (m, e) => { fail++; console.log("  \x1b[31m✗\x1b[0m " + m + (e ? "\n      " + String(e).split("\n")[0] : "")); };

async function check(label, fn) {
  try { await fn(); ok(label); } catch (e) { bad(label, e.message ?? e); }
}

// ── Stubs de lo que Supabase aporta y PGlite no ────────────────────────
console.log("\n\x1b[1mPreparando entorno Supabase simulado\x1b[0m");
await runSql(`
  -- PGlite no trae pgcrypto; gen_random_uuid() sí es del núcleo desde PG13.
  create or replace function gen_random_bytes(n int) returns bytea
    language sql volatile as $fn$
      select decode(string_agg(lpad(to_hex((random()*255)::int), 2, '0'), ''), 'hex')
        from generate_series(1, n)
    $fn$;
  create role anon           nologin;
  create role authenticated  nologin;
  create role service_role   nologin;
  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    raw_user_meta_data jsonb default '{}'::jsonb
  );
  create or replace function auth.uid() returns uuid
    language sql stable as $fn$
      select nullif(current_setting('test.uid', true), '')::uuid
    $fn$;
  create publication supabase_realtime;

  -- Storage de Supabase, lo mínimo para que corra la migración de marca.
  create schema storage;
  create table storage.buckets (
    id text primary key, name text, public boolean,
    file_size_limit bigint, allowed_mime_types text[]
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets(id), name text
  );
  alter table storage.objects enable row level security;
`);
console.log("  entorno listo");

// ── Migraciones ────────────────────────────────────────────────────────
console.log("\n\x1b[1mAplicando migraciones\x1b[0m");
for (const f of ["0001_schema.sql", "0002_functions.sql", "0003_rls.sql", "0004_seed.sql", "0005_foros_reales.sql", "0006_representacion_texto.sql", "0007_marca_y_sesiones.sql", "0008_importador.sql"]) {
  try {
    const sqlText = readFileSync(`${DIR}/${f}`, "utf8")
      .replace(/create extension if not exists pgcrypto;/i, "-- pgcrypto: sustituido en el arnés");
    await runSql(sqlText);
    ok(f);
  } catch (e) {
    bad(f, e.message ?? e);
    console.log("\n\x1b[31mMigración fallida — se detiene aquí.\x1b[0m\n");
    process.exit(1);
  }
}

const as = (uid) => runSql(`set test.uid = '${uid}';`);
const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];

// ── Datos de prueba ────────────────────────────────────────────────────
console.log("\n\x1b[1mSembrando datos de prueba\x1b[0m");

const ev = await one(`select id from events where is_active`);
const forum = await one(`select id from forums order by sort_order limit 1`);

const admin = await one(
  `insert into auth.users (email, raw_user_meta_data) values ('admin@eagles.edu', '{"display_name":"Mauricio L."}') returning id`);
const disp = await one(
  `insert into auth.users (email, raw_user_meta_data) values ('ana@eagles.edu', '{"display_name":"Ana Solís"}') returning id`);
await db.query(`update profiles set role = 'admin' where id = $1`, [admin.id]);

await check("el trigger de auth.users crea el perfil", async () => {
  const p = await one(`select display_name, role from profiles where id = $1`, [disp.id]);
  if (p.display_name !== "Ana Solís") throw new Error("nombre no tomado de la metadata");
  if (p.role !== "dispatcher") throw new Error("debería nacer como dispatcher, nació como " + p.role);
});

await check("los 20 foros quedan cargados, sin duplicados", async () => {
  const r = await one(
    `select count(*)::int n, count(distinct name)::int dn, count(distinct short_name)::int ds,
            max(length(short_name))::int maxlen from forums`);
  if (r.n !== 20) throw new Error("hay " + r.n + " foros");
  if (r.dn !== 20 || r.ds !== 20) throw new Error("hay nombres o nombres cortos repetidos");
  if (r.maxlen > 16) throw new Error("un nombre corto de " + r.maxlen + " chars no cabe en la fila del flujo");
});

const fr = await one(
  `insert into delegations (forum_id, country, seats) values ($1, 'Francia', 2) returning id`, [forum.id]);

const mk = async (name, role, extra = {}) => one(
  `insert into participants (event_id, full_name, role, forum_id, delegation_id, representation, position, dietary_notes)
   values ($1,$2,$3,$4,$5,$6,$7,$8) returning id, qr_token`,
  [ev.id, name, role, extra.forum ?? null, extra.deleg ?? null, extra.rep ?? null,
   extra.position ?? null, extra.diet ?? null]);

const p1 = await mk("María Fernanda López", "delegado", { forum: forum.id, deleg: fr.id });
const p2 = await mk("Sebastián Mejía", "delegado", { forum: forum.id, deleg: fr.id, diet: "ALERGIA AL MANÍ" });
const prensa = await mk("Valentina Ortiz", "prensa");
console.log("  3 participantes creados");

// ── Restricciones del esquema ──────────────────────────────────────────
console.log("\n\x1b[1mRestricciones del esquema\x1b[0m");

await check("una mesa sin foro es rechazada", async () => {
  try { await mk("Sin Foro", "mesa"); } catch { return; }
  throw new Error("lo aceptó");
});

await check("el tercer delegado de Francia excede el cupo de 2", async () => {
  try { await mk("Tercero", "delegado", { forum: forum.id, deleg: fr.id }); }
  catch (e) { if (!/cupos/.test(e.message)) throw new Error("mensaje inesperado: " + e.message); return; }
  throw new Error("aceptó un tercer delegado");
});

await check("un delegado con país escrito a mano (sin catálogo) es válido", async () => {
  const p = await mk("Camila Restrepo", "delegado", { forum: forum.id, rep: "Noruega" });
  const r = await one(`select participant_label($1) l`, [p.id]);
  if (!/Noruega/.test(r.l)) throw new Error("la etiqueta no usa el texto libre: " + r.l);
});

await check("un delegado con personaje en vez de país es válido", async () => {
  const p = await mk("Tomás Aguirre", "delegado", { forum: forum.id, rep: "Simón Bolívar" });
  const r = await one(`select participant_label($1) l`, [p.id]);
  if (!/Simón Bolívar/.test(r.l)) throw new Error("etiqueta: " + r.l);
});

await check("un delegado sin país NI texto sigue siendo rechazado", async () => {
  try { await mk("Nadie", "delegado", { forum: forum.id }); } catch { return; }
  throw new Error("lo aceptó");
});

await check("el catálogo manda sobre el texto libre cuando existen los dos", async () => {
  const jp = await one(
    `insert into delegations (forum_id, country, seats) values ($1, 'Japón', 1) returning id`, [forum.id]);
  const p = await mk("Doble Fuente", "delegado", { forum: forum.id, deleg: jp.id, rep: "Noruega" });
  const r = await one(`select participant_label($1) l`, [p.id]);
  if (!/Japón/.test(r.l)) throw new Error("debería ganar el catálogo: " + r.l);
});

await check("la mesa NO consume cupo de país", async () => {
  await mk("Presidente CS", "mesa", { forum: forum.id, position: "Presidente" });
});

await check("los tokens QR son distintos y de 128 bits", async () => {
  const r = await one(`select count(distinct qr_token) d, count(*) n, min(length(qr_token)) l from participants`);
  if (r.d !== r.n) throw new Error("hay tokens repetidos");
  if (Number(r.l) !== 36) throw new Error("longitud inesperada: " + r.l);
});

// ── Sesiones ───────────────────────────────────────────────────────────
console.log("\n\x1b[1mSesiones de despacho\x1b[0m");
const s1 = await one(`select id, name from dispatch_sessions order by sort_order limit 1`);
const s2 = await one(`select id from dispatch_sessions order by sort_order offset 1 limit 1`);

await as(disp.id);
await check("un despachador NO puede abrir una sesión", async () => {
  try { await db.query(`select open_session($1)`, [s1.id]); }
  catch (e) { if (!/administrador/.test(e.message)) throw e; return; }
  throw new Error("lo dejó abrir");
});

await as(admin.id);
await check("el admin abre la sesión", async () => {
  const r = await one(`select open_session($1) x`, [s1.id]);
  if (r.x.status !== "open") throw new Error(JSON.stringify(r.x));
});

await check("no se puede abrir una segunda sesión a la vez", async () => {
  try { await db.query(`select open_session($1)`, [s2.id]); }
  catch (e) { if (!/otra sesión abierta/.test(e.message)) throw e; return; }
  throw new Error("dejó dos sesiones abiertas");
});

// ── El canje ───────────────────────────────────────────────────────────
console.log("\n\x1b[1mCanje — la garantía anti-doble\x1b[0m");
await as(disp.id);

await check("primer escaneo → granted, con foro y país", async () => {
  const r = await one(`select redeem_qr($1,'Puesto 1','tel-a') x`, [p1.qr_token]);
  if (r.x.status !== "granted") throw new Error(JSON.stringify(r.x));
  if (r.x.name !== "María Fernanda López") throw new Error("nombre: " + r.x.name);
  if (!/Francia/.test(r.x.detail)) throw new Error("detalle: " + r.x.detail);
  if (r.x.diet !== null) throw new Error("no debería traer dieta");
});

await check("segundo escaneo → duplicate, con hora y responsable", async () => {
  const r = await one(`select redeem_qr($1,'Puesto 2','tel-b') x`, [p1.qr_token]);
  if (r.x.status !== "duplicate") throw new Error(JSON.stringify(r.x));
  if (r.x.by !== "Ana Solís") throw new Error("no dice quién entregó: " + r.x.by);
  if (!r.x.redeemed_at) throw new Error("no dice a qué hora");
});

await check("tras el duplicado sigue habiendo UNA sola fila", async () => {
  const r = await one(`select count(*) n from redemptions where participant_id=$1 and voided_at is null`, [p1.id]);
  if (Number(r.n) !== 1) throw new Error("filas: " + r.n);
});

await check("el índice único rechaza un insert directo duplicado", async () => {
  try {
    await db.query(
      `insert into redemptions (session_id, participant_id, dispatched_by) values ($1,$2,$3)`,
      [s1.id, p1.id, disp.id]);
  } catch (e) { if (!/duplicate key|canje_activo_unico/.test(e.message)) throw e; return; }
  throw new Error("la base aceptó un canje duplicado por inserción directa");
});

await check("la alerta alimentaria viaja en la respuesta", async () => {
  const r = await one(`select redeem_qr($1,'Puesto 1','tel-a') x`, [p2.qr_token]);
  if (r.x.status !== "granted") throw new Error(JSON.stringify(r.x));
  if (r.x.diet !== "ALERGIA AL MANÍ") throw new Error("dieta: " + r.x.diet);
});

await check("token desconocido → unknown_token, sin nombre", async () => {
  const r = await one(`select redeem_qr('esm-noexiste','Puesto 1','tel-a') x`);
  if (r.x.status !== "unknown_token") throw new Error(JSON.stringify(r.x));
  if (r.x.name) throw new Error("filtró un nombre");
});

await check("rol fuera de eligible_roles → not_eligible, con nombre", async () => {
  await as(admin.id);
  await db.query(
    `update dispatch_sessions set eligible_roles = array['mesa','delegado']::participant_role[] where id=$1`, [s1.id]);
  await as(disp.id);
  const r = await one(`select redeem_qr($1,'Puesto 1','tel-a') x`, [prensa.qr_token]);
  if (r.x.status !== "not_eligible") throw new Error(JSON.stringify(r.x));
  if (r.x.name !== "Valentina Ortiz") throw new Error("debe mostrar el nombre para devolver el gafete");
});

// ── Anulación ──────────────────────────────────────────────────────────
console.log("\n\x1b[1mAnulación\x1b[0m");
const red1 = await one(`select id from redemptions where participant_id=$1 and voided_at is null`, [p1.id]);

await as(disp.id);
await check("un despachador NO puede anular", async () => {
  try { await db.query(`select void_redemption($1,'me equivoqué')`, [red1.id]); }
  catch (e) { if (!/administrador/.test(e.message)) throw e; return; }
  throw new Error("lo dejó anular");
});

await as(admin.id);
await check("anular sin motivo es rechazado", async () => {
  try { await db.query(`select void_redemption($1,'x')`, [red1.id]); }
  catch (e) { if (!/motivo/.test(e.message)) throw e; return; }
  throw new Error("aceptó anular sin motivo");
});

await check("el admin anula con motivo", async () => {
  const r = await one(`select void_redemption($1,'Se le cayó la bolsa al piso') x`, [red1.id]);
  if (r.x.status !== "voided") throw new Error(JSON.stringify(r.x));
});

await check("tras anular, la persona puede volver a escanear", async () => {
  await as(disp.id);
  const r = await one(`select redeem_qr($1,'Puesto 1','tel-a') x`, [p1.qr_token]);
  if (r.x.status !== "granted") throw new Error(JSON.stringify(r.x));
});

await check("la fila anulada se conserva con motivo y responsable", async () => {
  const r = await one(`select void_reason, voided_by from redemptions where id=$1`, [red1.id]);
  if (!r.void_reason) throw new Error("se perdió el motivo");
  if (r.voided_by !== admin.id) throw new Error("no registró quién anuló");
});

// ── Sesión cerrada ─────────────────────────────────────────────────────
console.log("\n\x1b[1mCierre y acta\x1b[0m");
await as(admin.id);
await check("el admin cierra la sesión", async () => {
  const r = await one(`select close_session($1) x`, [s1.id]);
  if (r.x.status !== "closed") throw new Error(JSON.stringify(r.x));
});

await as(disp.id);
await check("con la sesión cerrada, escanear → session_closed", async () => {
  const r = await one(`select redeem_qr($1,'Puesto 1','tel-a') x`, [p2.qr_token]);
  if (r.x.status !== "session_closed") throw new Error(JSON.stringify(r.x));
});

await as(admin.id);
await check("el acta cuadra: entregados, anulados, faltantes y anomalías", async () => {
  const r = await one(`select session_report($1) x`, [s1.id]);
  const a = r.x;
  if (a.delivered !== 2) throw new Error("entregados=" + a.delivered + " (esperaba 2)");
  if (a.voided !== 1) throw new Error("anulados=" + a.voided);
  if (!Array.isArray(a.missing)) throw new Error("falta la lista de quienes no pasaron");
  if (a.anomalies.length !== 1) throw new Error("anomalías=" + a.anomalies.length);
  if (!/cayó la bolsa/.test(a.anomalies[0].reason)) throw new Error("la anomalía no trae el motivo");
  if (!a.rejections || !a.rejections.duplicate) throw new Error("el acta no cuenta los rechazos");
});

await check("los rechazos quedaron auditados en scan_attempts", async () => {
  const r = await db.query(`select result, count(*)::int n from scan_attempts group by result order by result`);
  const m = Object.fromEntries(r.rows.map((x) => [x.result, x.n]));
  for (const k of ["granted", "duplicate", "unknown_token", "not_eligible", "session_closed"])
    if (!m[k]) throw new Error("no se registró ningún intento '" + k + "'");
});

await check("la descarga del padrón queda auditada", async () => {
  await db.query(`select open_session($1)`, [s2.id]);
  await as(disp.id);
  const roster = await db.query(`select * from session_roster()`);
  if (roster.rows.length === 0) throw new Error("el padrón vino vacío");
  if (roster.rows.some((x) => x.qr_token == null)) throw new Error("faltan tokens");
  const r = await one(`select count(*) n from audit_log where action='roster.download'`);
  if (Number(r.n) < 1) throw new Error("no se auditó la descarga");
});

// ── Gestión de sesiones ──────────────────────────────────────────────
console.log("\n\x1b[1mCrear, borrar y reordenar sesiones\x1b[0m");
await as(admin.id);

const nueva = await one(
  `insert into dispatch_sessions (event_id, name, kind, day_number, sort_order)
   values ($1, 'Día 3 · Refrigerio extra', 'refrigerio', 3, 99) returning id`, [ev.id]);

await check("se puede crear una sesión nueva", async () => {
  if (!nueva.id) throw new Error("no devolvió id");
});

await check("una sesión en borrador y sin canjes se puede borrar", async () => {
  await db.query(`delete from dispatch_sessions where id=$1`, [nueva.id]);
  const r = await one(`select count(*) n from dispatch_sessions where id=$1`, [nueva.id]);
  if (Number(r.n) !== 0) throw new Error("no se borró");
});

await check("NO se puede borrar una sesión con entregas registradas", async () => {
  try { await db.query(`delete from dispatch_sessions where id=$1`, [s1.id]); }
  catch (e) { if (!/destruiría el acta/.test(e.message)) throw e; return; }
  throw new Error("borró una sesión con historial");
});

await check("NO se puede borrar una sesión abierta", async () => {
  const abierta = await one(`select id from dispatch_sessions where state='open' limit 1`);
  try { await db.query(`delete from dispatch_sessions where id=$1`, [abierta.id]); }
  catch (e) { if (!/sesión abierta/.test(e.message)) throw e; return; }
  throw new Error("borró una sesión abierta");
});

await check("reordenar reescribe sort_order en bloque", async () => {
  const antes = await db.query(`select id from dispatch_sessions order by sort_order`);
  const ids = antes.rows.map((r) => r.id).reverse();
  await db.query(`select reordenar_sesiones($1::uuid[])`, [ids]);
  const despues = await db.query(`select id from dispatch_sessions order by sort_order`);
  if (despues.rows.map((r) => r.id).join() !== ids.join())
    throw new Error("el orden no quedó como se pidió");
});

await check("un despachador NO puede reordenar", async () => {
  await as(disp.id);
  const ids = (await db.query(`select id from dispatch_sessions`)).rows.map((r) => r.id);
  try { await db.query(`select reordenar_sesiones($1::uuid[])`, [ids]); }
  catch (e) { if (!/administrador/.test(e.message)) throw e; return; }
  throw new Error("lo dejó reordenar");
});

await check("el bucket de marca queda público y con límite de tamaño", async () => {
  const b = await one(`select public, file_size_limit from storage.buckets where id='marca'`);
  if (!b) throw new Error("no se creó el bucket");
  if (!b.public) throw new Error("debería ser público: el logo va en el ingreso");
  if (Number(b.file_size_limit) !== 2097152) throw new Error("límite: " + b.file_size_limit);
});

// ── Importador CSV ───────────────────────────────────────────────────
console.log("\n\x1b[1mImportador\x1b[0m");
await as(admin.id);

const importar = async (filas, ensayo = true) =>
  (await one(`select importar_participantes($1::jsonb, $2) x`, [JSON.stringify(filas), ensayo])).x;

await check("el ensayo NO escribe nada", async () => {
  const antes = await one(`select count(*)::int n from participants`);
  const r = await importar([{ nombre: "Prueba Ensayo", rol: "Staff" }]);
  const despues = await one(`select count(*)::int n from participants`);
  if (antes.n !== despues.n) throw new Error("el ensayo insertó filas");
  if (r.creadas !== 1) throw new Error("no contó la fila: " + JSON.stringify(r));
});

await check("acepta el foro por nombre corto, sin acentos ni mayúsculas", async () => {
  const corto = (await one(`select short_name from forums limit 1`)).short_name;
  const r = await importar([
    { nombre: "Ana Prueba", rol: "DELEGADO", foro: corto.toUpperCase(), representacion: "Perú" },
  ]);
  if (r.errores.length) throw new Error(JSON.stringify(r.errores));
});

await check("rechaza un rol que no existe, diciendo cuáles valen", async () => {
  const r = await importar([{ nombre: "X", rol: "capitán" }]);
  if (r.errores.length !== 1) throw new Error("no lo marcó");
  if (!/Delegado, Mesa, Staff/.test(r.errores[0].mensaje)) throw new Error(r.errores[0].mensaje);
});

await check("rechaza un foro inexistente nombrándolo", async () => {
  const r = await importar([{ nombre: "X", rol: "Delegado", foro: "Consejo Inventado", representacion: "Perú" }]);
  if (!/No existe el foro/.test(r.errores[0]?.mensaje ?? "")) throw new Error(JSON.stringify(r.errores));
});

await check("rechaza un delegado sin representación", async () => {
  const f = (await one(`select name from forums limit 1`)).name;
  const r = await importar([{ nombre: "X", rol: "Delegado", foro: f }]);
  if (!/país o personaje/.test(r.errores[0]?.mensaje ?? "")) throw new Error(JSON.stringify(r.errores));
});

await check("detecta un código repetido dentro del mismo archivo", async () => {
  const r = await importar([
    { nombre: "Uno", rol: "Staff", codigo: "A-1" },
    { nombre: "Dos", rol: "Staff", codigo: "A-1" },
  ]);
  if (!/dos veces en el archivo/.test(r.errores[0]?.mensaje ?? "")) throw new Error(JSON.stringify(r.errores));
});

await check("importa de verdad y cuenta creadas", async () => {
  const f = (await one(`select name from forums order by sort_order limit 1`)).name;
  const antes = await one(`select count(*)::int n from participants`);
  const r = await importar([
    { nombre: "Lucía Fernández", rol: "Delegado", foro: f, representacion: "Perú", codigo: "E-100" },
    { nombre: "Pablo Duarte", rol: "Staff", dieta: "sin gluten", codigo: "E-101" },
  ], false);
  const despues = await one(`select count(*)::int n from participants`);
  if (r.creadas !== 2) throw new Error(JSON.stringify(r));
  if (despues.n - antes.n !== 2) throw new Error("insertó " + (despues.n - antes.n));
  const p = await one(`select dietary_notes from participants where external_code='E-101'`);
  if (p.dietary_notes !== "SIN GLUTEN") throw new Error("no normalizó la dieta: " + p.dietary_notes);
});

await check("reimportar el mismo código actualiza en vez de duplicar", async () => {
  const antes = await one(`select count(*)::int n from participants`);
  const r = await importar([{ nombre: "Pablo Duarte Ruiz", rol: "Staff", codigo: "E-101" }], false);
  const despues = await one(`select count(*)::int n from participants`);
  if (r.actualizadas !== 1) throw new Error(JSON.stringify(r));
  if (antes.n !== despues.n) throw new Error("duplicó");
  const p = await one(`select full_name from participants where external_code='E-101'`);
  if (p.full_name !== "Pablo Duarte Ruiz") throw new Error("no actualizó el nombre");
});

await check("una sola fila mala cancela TODA la importación", async () => {
  const antes = await one(`select count(*)::int n from participants`);
  try {
    await importar([
      { nombre: "Buena", rol: "Staff", codigo: "E-200" },
      { nombre: "Mala", rol: "arquitecto" },
    ], false);
  } catch (e) {
    if (!/se canceló/.test(e.message)) throw e;
    const despues = await one(`select count(*)::int n from participants`);
    if (antes.n !== despues.n) throw new Error("dejó filas a medias: " + (despues.n - antes.n));
    return;
  }
  throw new Error("no canceló");
});

await check("un despachador NO puede importar", async () => {
  await as(disp.id);
  try { await importar([{ nombre: "X", rol: "Staff" }]); }
  catch (e) { if (!/administrador/.test(e.message)) throw e; return; }
  throw new Error("lo dejó importar");
});

console.log(`\n\x1b[1m${pass} pasaron, ${fail} fallaron\x1b[0m\n`);
process.exit(fail ? 1 : 0);
