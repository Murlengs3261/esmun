import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Escaner } from "./Escaner";

export const dynamic = "force-dynamic";

export default async function Escanear() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/ingresar");

  const { data: sesion } = await supabase
    .from("dispatch_sessions")
    .select("id, name, day_number")
    .eq("state", "open")
    .maybeSingle();

  // El contador del turno: lo único que el despachador ve además del
  // veredicto. Sus propias filas, nunca las de nadie más (RLS).
  let entregados = 0;
  if (sesion) {
    const { count } = await supabase
      .from("redemptions")
      .select("id", { count: "exact", head: true })
      .eq("session_id", sesion.id)
      .eq("dispatched_by", user.id)
      .is("voided_at", null);
    entregados = count ?? 0;
  }

  return <Escaner sesion={sesion} entregados={entregados} />;
}
