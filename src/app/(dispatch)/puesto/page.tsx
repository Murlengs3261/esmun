import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ElegirPuesto } from "./ElegirPuesto";

export default async function Puesto() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/ingresar");

  const [{ data: profile }, { data: stations }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).single(),
    supabase.from("stations").select("id, label, location").eq("is_active", true).order("sort_order"),
  ]);

  return (
    <ElegirPuesto
      nombre={profile?.display_name ?? "Despachador"}
      puestos={stations ?? []}
    />
  );
}
