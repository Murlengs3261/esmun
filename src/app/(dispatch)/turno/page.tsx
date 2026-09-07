import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FinDeTurno } from "@/components/dispatch/FinDeTurno";

export const dynamic = "force-dynamic";

export default async function Turno() {
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

  // Solo las filas propias (RLS): cuántas y entre qué horas.
  let entregados = 0;
  let primero: string | null = null;
  let ultimo: string | null = null;

  if (sesion) {
    const { data } = await supabase
      .from("redemptions")
      .select("redeemed_at")
      .eq("session_id", sesion.id)
      .eq("dispatched_by", user.id)
      .is("voided_at", null)
      .order("redeemed_at");
    const filas = data ?? [];
    entregados = filas.length;
    primero = filas[0]?.redeemed_at ?? null;
    ultimo = filas[filas.length - 1]?.redeemed_at ?? null;
  }

  return (
    <FinDeTurno
      sesion={sesion}
      entregados={entregados}
      primero={primero}
      ultimo={ultimo}
    />
  );
}
