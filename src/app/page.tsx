import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** No hay portada. Cada quien cae donde le toca. */
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/ingresar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  redirect(profile?.role === "admin" ? "/admin" : "/escanear");
}
