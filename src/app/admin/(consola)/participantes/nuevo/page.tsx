import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { FormularioAlta } from "./FormularioAlta";

export const dynamic = "force-dynamic";

export default async function Nuevo() {
  const supabase = await createClient();
  const { data: foros } = await supabase
    .from("forums").select("id, name, short_name").order("sort_order");

  return (
    <main className="mx-auto w-full max-w-md px-5 pt-8">
      <Link href="/admin/participantes" className="type-micro text-accent">
        ← Participantes
      </Link>
      <h1 className="font-plate mt-4 text-title">Nueva persona</h1>
      <FormularioAlta foros={foros ?? []} />
    </main>
  );
}
