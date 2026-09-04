import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Pagina } from "@/components/admin/Pagina";
import { FilaParticipante, type Participante } from "@/components/admin/FilaParticipante";

export const dynamic = "force-dynamic";

export default async function Participantes({
  searchParams,
}: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const supabase = await createClient();

  let consulta = supabase
    .from("participants")
    .select("id, full_name, role, representation, position, dietary_notes, qr_token, forums(name, short_name)")
    .eq("is_active", true)
    .order("full_name")
    .limit(200);

  if (q) consulta = consulta.ilike("full_name", `%${q}%`);

  const { data } = await consulta;
  const filas = (data ?? []) as unknown as Participante[];

  return (
    <Pagina
      eyebrow={`${filas.length} registradas`}
      titulo="Participantes"
      ancho="ancho"
      acciones={
        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/participantes/importar"
            className="flex h-12 shrink-0 items-center border-2 border-line-control px-5 font-plate text-section text-fg"
          >
            Importar CSV
          </Link>
          <Link
            href="/admin/participantes/nuevo"
            className="flex h-12 shrink-0 items-center bg-accent px-5 font-plate text-section text-fg-on-accent"
          >
            Añadir
          </Link>
        </div>
      }
    >
      <form>
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por nombre"
          className="h-12 w-full max-w-md border border-line-control bg-surface px-4 text-body outline-none focus:border-b-2 focus:border-b-accent"
        />
      </form>

      {filas.length === 0 ? (
        <div className="border border-dashed border-line-control p-6">
          <h2 className="font-plate text-section">
            {q ? "Nadie con ese nombre" : "Todavía no hay nadie"}
          </h2>
          <p className="mt-2 text-body text-fg-secondary">
            {q
              ? "Prueba con menos letras o revisa los acentos."
              : "Registra a la primera persona y el sistema le genera su gafete."}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-line border border-line bg-surface">
          {filas.map((p) => <FilaParticipante key={p.id} p={p} />)}
        </ul>
      )}
    </Pagina>
  );
}
