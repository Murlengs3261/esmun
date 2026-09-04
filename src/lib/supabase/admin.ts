import "server-only";

import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Cliente con la clave de servicio: se salta RLS por completo.
 *
 * El import de "server-only" hace que el build falle si algún día alguien
 * lo importa desde un componente de cliente. Es la única barrera que no
 * depende de que nadie se equivoque.
 *
 * Nunca se usa sin pasar antes por exigirAdmin().
 */
function clienteDeServicio() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !clave) {
    throw new Error(
      "Falta SUPABASE_SERVICE_ROLE_KEY. En local va en .env.local; en Vercel, en las variables de entorno del proyecto.",
    );
  }

  return createAdminClient(url, clave, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Comprueba contra la base —no contra la cookie— que quien llama es un
 *  administrador activo. Devuelve su id y el cliente privilegiado. */
export async function exigirAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Sin sesión.");

  const { data: perfil } = await supabase
    .from("profiles")
    .select("role, is_active, display_name")
    .eq("id", user.id)
    .single();

  if (!perfil?.is_active || perfil.role !== "admin") {
    throw new Error("Hace falta ser administrador.");
  }

  return { adminId: user.id, admin: clienteDeServicio(), supabase };
}
