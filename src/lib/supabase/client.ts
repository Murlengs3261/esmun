"use client";

import { createBrowserClient } from "@supabase/ssr";

/** Cliente de navegador. Usa la clave anónima: toda la autoridad real
 *  está en las políticas RLS, no en qué clave tenga el cliente. */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
