"use server";

import { revalidatePath } from "next/cache";
import { exigirAdmin } from "@/lib/supabase/admin";
import type { AppRole } from "@/lib/domain/types";

export interface ResultadoUsuario {
  error?: string;
  ok?: string;
  /** Solo se devuelve al crear o restablecer, y solo se muestra una vez. */
  credencial?: { email: string; password: string; nombre: string };
}

function normalizar(e: unknown) {
  const m = e instanceof Error ? e.message : String(e);
  if (/already been registered|already exists/i.test(m))
    return "Ya hay una cuenta con ese correo.";
  if (/administrador|Sin sesión/i.test(m)) return m;
  return m;
}

export async function crearUsuario(
  _previo: ResultadoUsuario,
  formData: FormData,
): Promise<ResultadoUsuario> {
  try {
    const { admin } = await exigirAdmin();

    const email = String(formData.get("email") || "").trim().toLowerCase();
    const nombre = String(formData.get("display_name") || "").trim();
    const rol = (String(formData.get("role") || "dispatcher") as AppRole);
    const password = String(formData.get("password") || "");

    if (!email || !email.includes("@")) return { error: "Escribe un correo válido." };
    if (!nombre) return { error: "El nombre es obligatorio: sale en el acta de cada entrega." };
    if (password.length < 6)
      return { error: "La contraseña necesita al menos 6 caracteres (mínimo de Supabase)." };

    // email_confirm: true porque no hay SMTP configurado; el correo de
    // verificación nunca llegaría y la cuenta quedaría muerta.
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: nombre },
    });

    if (error || !data.user) return { error: normalizar(error ?? "No se pudo crear la cuenta.") };

    // El trigger ya creó el perfil como 'dispatcher'; esto ajusta rol y nombre.
    const { error: errPerfil } = await admin
      .from("profiles")
      .update({ role: rol, display_name: nombre, is_active: true })
      .eq("id", data.user.id);

    if (errPerfil) return { error: errPerfil.message };

    revalidatePath("/admin/personal");
    return {
      ok: `Cuenta creada para ${nombre}.`,
      credencial: { email, password, nombre },
    };
  } catch (e) {
    return { error: normalizar(e) };
  }
}

/**
 * Cambiar la contraseña de cualquier cuenta a una que elige el admin, sin
 * necesidad de saber la anterior.
 *
 * Supabase la guarda con bcrypt y no hay forma de leerla después: eso no
 * es una decisión que yo pueda cambiar. Lo que sí resuelve el problema de
 * «no sé cuál tiene Ana» es esto — se le pone una nueva y ya.
 */
export async function cambiarContrasena(
  _previo: ResultadoUsuario,
  formData: FormData,
): Promise<ResultadoUsuario> {
  try {
    const { admin } = await exigirAdmin();
    const id = String(formData.get("id"));
    const password = String(formData.get("password") || "");

    if (password.length < 6)
      return { error: "La contraseña necesita al menos 6 caracteres." };

    const { data: perfil } = await admin
      .from("profiles").select("display_name").eq("id", id).single();

    const { data, error } = await admin.auth.admin.updateUserById(id, { password });
    if (error || !data.user) return { error: normalizar(error ?? "No se pudo cambiar.") };

    return {
      ok: `Contraseña de ${perfil?.display_name ?? "la cuenta"} cambiada.`,
      credencial: {
        email: data.user.email ?? "",
        password,
        nombre: perfil?.display_name ?? "",
      },
    };
  } catch (e) {
    return { error: normalizar(e) };
  }
}

/**
 * Dar de baja NO borra la cuenta: `is_dispatcher()` exige is_active, así
 * que dejar de estar activo basta para que no pueda escanear. Borrarla de
 * verdad rompería la clave foránea de sus entregas —está en restrict— y
 * con ella el acta que dice quién entregó qué.
 */
export async function cambiarEstadoUsuario(formData: FormData): Promise<void> {
  const { admin, adminId } = await exigirAdmin();
  const id = String(formData.get("id"));
  const activar = String(formData.get("activar")) === "1";

  if (id === adminId && !activar) {
    revalidatePath("/admin/personal");
    return;
  }

  await admin.from("profiles").update({ is_active: activar }).eq("id", id);
  revalidatePath("/admin/personal");
}

export async function cambiarRolUsuario(formData: FormData): Promise<void> {
  const { admin, adminId } = await exigirAdmin();
  const id = String(formData.get("id"));
  const rol = String(formData.get("role")) as AppRole;

  // Quitarse a uno mismo el rol de admin deja la consola sin dueño.
  if (id === adminId) {
    revalidatePath("/admin/personal");
    return;
  }

  await admin.from("profiles").update({ role: rol }).eq("id", id);
  revalidatePath("/admin/personal");
}
