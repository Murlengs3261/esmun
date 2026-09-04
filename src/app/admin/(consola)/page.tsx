import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PanelVivo } from "@/components/admin/PanelVivo";
import { Pagina } from "@/components/admin/Pagina";

export const dynamic = "force-dynamic";

export default async function Panel() {
  const supabase = await createClient();

  const { data: sesion } = await supabase
    .from("dispatch_sessions")
    .select("id, name, day_number, opened_at, eligible_roles")
    .eq("state", "open")
    .maybeSingle();

  const { count: totalPersonas } = await supabase
    .from("participants")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);

  if (!sesion) {
    return (
      <Encabezado>
        <div className="border border-dashed border-line-control p-6">
          <h2 className="font-plate text-section">Ninguna entrega abierta</h2>
          <p className="mt-2 text-body text-fg-secondary">
            Mientras no abras una sesión, los teléfonos de los escaneadores
            muestran una pantalla de espera y la cámara está apagada.
          </p>
          <Link
            href="/admin/sesiones"
            className="mt-5 inline-flex h-12 items-center bg-accent px-5 text-fg-on-accent"
          >
            <span className="font-plate text-section">Ver las sesiones</span>
          </Link>
        </div>

        <dl className="grid grid-cols-2 gap-4 sm:max-w-lg">
          <Dato etiqueta="Personas registradas" valor={String(totalPersonas ?? 0)} />
          <Dato etiqueta="Sesiones del evento" valor="6" />
        </dl>

        {!totalPersonas && (
          <p className="text-sub text-fg-tertiary">
            Todavía no hay nadie registrado.{" "}
            <Link href="/admin/participantes/nuevo" className="underline">
              Registra a la primera persona
            </Link>
            .
          </p>
        )}
      </Encabezado>
    );
  }

  // Elegibles de ESTA sesión: el denominador honesto, no un 350 fijo.
  const { count: elegibles } = await supabase
    .from("participants")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true)
    .in("role", sesion.eligible_roles);

  return (
    <Encabezado>
      <PanelVivo sesion={sesion} elegibles={elegibles ?? 0} />
    </Encabezado>
  );
}

function Encabezado({ children }: { children: React.ReactNode }) {
  return (
    <Pagina eyebrow="Colegio Eagles" titulo="Panel en vivo" ancho="ancho">
      {children}
    </Pagina>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="border border-line bg-surface p-4">
      <dt className="type-micro text-fg-tertiary">{etiqueta}</dt>
      <dd className="font-plate mt-1 text-title">{valor}</dd>
    </div>
  );
}
