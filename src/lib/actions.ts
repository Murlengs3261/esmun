"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ParticipantRole } from "@/lib/domain/types";

export interface EstadoAlta {
  error?: string;
  ok?: string;
}

/** Todas las escrituras sensibles pasan por funciones SECURITY DEFINER de
 *  Postgres. Estas acciones solo las invocan: la autoridad está en la base. */

/** Los mensajes de error de la base ya vienen redactados para una
 *  persona, así que se pasan tal cual por la URL en vez de reventar la
 *  página con una excepción. */
async function cambiarEstado(rpc: "open_session" | "close_session", id: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc(rpc, { p_session: id });
  revalidatePath("/admin/sesiones");
  revalidatePath("/admin");
  if (error) redirect(`/admin/sesiones?error=${encodeURIComponent(error.message)}`);
  redirect("/admin/sesiones");
}

export async function abrirSesion(formData: FormData): Promise<void> {
  await cambiarEstado("open_session", String(formData.get("id")));
}

export async function cerrarSesion(formData: FormData): Promise<void> {
  await cambiarEstado("close_session", String(formData.get("id")));
}

export async function anularEntrega(
  _previo: EstadoAlta,
  formData: FormData,
): Promise<EstadoAlta> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("void_redemption", {
    p_redemption: String(formData.get("id")),
    p_reason: String(formData.get("motivo") ?? ""),
  });
  revalidatePath("/admin");
  if (error) return { error: error.message };
  return { ok: "Entrega anulada. Esa persona puede volver a escanear." };
}

export async function crearParticipante(
  _previo: EstadoAlta,
  formData: FormData,
): Promise<EstadoAlta> {
  const supabase = await createClient();

  const { data: evento } = await supabase
    .from("events").select("id").eq("is_active", true).single();
  if (!evento) return { error: "No hay un evento activo." };

  const rol = String(formData.get("role") || "") as ParticipantRole;
  const nombre = String(formData.get("full_name") || "").trim();
  const foro = String(formData.get("forum_id") || "") || null;
  const representacion = String(formData.get("representation") || "").trim() || null;
  const cargo = String(formData.get("position") || "").trim() || null;
  const dieta = String(formData.get("dietary_notes") || "").trim().toUpperCase() || null;
  const codigo = String(formData.get("external_code") || "").trim() || null;

  if (!nombre) return { error: "El nombre no puede ir vacío." };
  if (rol === "delegado" && !representacion)
    return { error: "Un delegado necesita el país o personaje que representa." };
  if ((rol === "delegado" || rol === "mesa") && !foro)
    return { error: "Elige el foro." };

  const { error } = await supabase.from("participants").insert({
    event_id: evento.id,
    full_name: nombre,
    role: rol,
    forum_id: foro,
    representation: rol === "delegado" ? representacion : null,
    position: rol === "mesa" ? cargo : null,
    dietary_notes: dieta,
    external_code: codigo,
  });

  if (error) {
    // Los CHECK y el trigger de la base devuelven mensajes ya redactados
    // para una persona; no hace falta traducirlos otra vez.
    return { error: error.message };
  }

  revalidatePath("/admin/participantes");
  return { ok: `${nombre} quedó registrado.` };
}

export async function salir() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/ingresar");
}

/* ── Ajustes del evento ─────────────────────────────────────────────── */

export async function guardarEvento(
  _previo: EstadoAlta,
  formData: FormData,
): Promise<EstadoAlta> {
  const supabase = await createClient();
  const nombre = String(formData.get("name") || "").trim();
  const inicio = String(formData.get("starts_on") || "");
  const fin = String(formData.get("ends_on") || "");

  if (!nombre) return { error: "El evento necesita un nombre." };
  if (fin < inicio) return { error: "La fecha de cierre es anterior a la de inicio." };

  const { error } = await supabase
    .from("events")
    .update({ name: nombre, starts_on: inicio, ends_on: fin })
    .eq("is_active", true);

  if (error) return { error: error.message };
  revalidatePath("/admin", "layout");
  return { ok: "Datos del evento guardados." };
}

/** El archivo ya se subió a Storage desde el navegador; aquí solo se
 *  guarda a qué apunta y se limpia el anterior. */
export async function guardarLogo(url: string, path: string): Promise<EstadoAlta> {
  const supabase = await createClient();

  const { data: evento } = await supabase
    .from("events").select("id, logo_path").eq("is_active", true).single();
  if (!evento) return { error: "No hay un evento activo." };

  const { error } = await supabase
    .from("events").update({ logo_url: url, logo_path: path }).eq("id", evento.id);
  if (error) return { error: error.message };

  if (evento.logo_path && evento.logo_path !== path) {
    await supabase.storage.from("marca").remove([evento.logo_path]);
  }

  revalidatePath("/admin", "layout");
  return { ok: "Logo actualizado." };
}

export async function quitarLogo(): Promise<EstadoAlta> {
  const supabase = await createClient();
  const { data: evento } = await supabase
    .from("events").select("id, logo_path").eq("is_active", true).single();
  if (!evento) return { error: "No hay un evento activo." };

  if (evento.logo_path) await supabase.storage.from("marca").remove([evento.logo_path]);
  await supabase.from("events").update({ logo_url: null, logo_path: null }).eq("id", evento.id);

  revalidatePath("/admin", "layout");
  return { ok: "Logo quitado." };
}

/* ── Sesiones: crear, borrar, reordenar ─────────────────────────────── */

export async function crearSesion(
  _previo: EstadoAlta,
  formData: FormData,
): Promise<EstadoAlta> {
  const supabase = await createClient();

  const { data: evento } = await supabase
    .from("events").select("id").eq("is_active", true).single();
  if (!evento) return { error: "No hay un evento activo." };

  const nombre = String(formData.get("name") || "").trim();
  if (!nombre) return { error: "Ponle un nombre reconocible: se ve en el teléfono del escaneador." };

  const roles = formData.getAll("eligible_roles").map(String) as ParticipantRole[];
  if (roles.length === 0) return { error: "Elige al menos un rol que pueda canjear." };

  const { data: ultimo } = await supabase
    .from("dispatch_sessions").select("sort_order")
    .eq("event_id", evento.id).order("sort_order", { ascending: false }).limit(1).maybeSingle();

  const dia = String(formData.get("day_number") || "");

  const { error } = await supabase.from("dispatch_sessions").insert({
    event_id: evento.id,
    name: nombre,
    kind: String(formData.get("kind") || "refrigerio"),
    day_number: dia ? Number(dia) : null,
    eligible_roles: roles,
    sort_order: (ultimo?.sort_order ?? 0) + 1,
  });

  if (error) return { error: error.message };
  revalidatePath("/admin/sesiones");
  return { ok: `«${nombre}» quedó programada.` };
}

export async function borrarSesion(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("dispatch_sessions").delete().eq("id", String(formData.get("id")));

  revalidatePath("/admin/sesiones");
  if (error) redirect(`/admin/sesiones?error=${encodeURIComponent(error.message)}`);
  redirect("/admin/sesiones");
}

export async function reordenarSesiones(ids: string[]): Promise<EstadoAlta> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("reordenar_sesiones", { p_ids: ids });
  revalidatePath("/admin/sesiones");
  if (error) return { error: error.message };
  return { ok: "Orden guardado." };
}

/* ── Participantes: eliminar ────────────────────────────────────────── */

/** Si la persona ya recibió alguna entrega, no se borra la fila: se da
 *  de baja, para que el acta siga cuadrando. Si nunca canjeó nada, se
 *  elimina del todo. En los dos casos su código deja de servir al
 *  instante y libera el cupo de su delegación. */
export async function eliminarParticipante(
  _previo: EstadoAlta,
  formData: FormData,
): Promise<EstadoAlta> {
  const supabase = await createClient();
  const id = String(formData.get("id") || "");

  const { data: persona } = await supabase
    .from("participants").select("id, full_name").eq("id", id).maybeSingle();
  if (!persona) return { error: "Esa persona ya no está en el padrón." };

  const { count } = await supabase
    .from("redemptions")
    .select("id", { count: "exact", head: true })
    .eq("participant_id", id);

  const conEntregas = (count ?? 0) > 0;
  const { error } = conEntregas
    ? await supabase.from("participants").update({ is_active: false }).eq("id", id)
    : await supabase.from("participants").delete().eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/admin/participantes");
  revalidatePath("/admin/qr");
  revalidatePath("/admin");
  return {
    ok: conEntregas
      ? `${persona.full_name} quedó fuera del padrón. Sus entregas se conservan en el acta.`
      : `${persona.full_name} fue eliminado.`,
  };
}
