import { createClient } from "@/lib/supabase/server";
import { abrirSesion, cerrarSesion, borrarSesion } from "@/lib/actions";
import { Pagina } from "@/components/admin/Pagina";
import { NuevaSesion } from "@/components/admin/NuevaSesion";
import { ListaSesiones, type FilaSesion } from "@/components/admin/ListaSesiones";

export const dynamic = "force-dynamic";

export default async function Sesiones({
  searchParams,
}: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const supabase = await createClient();

  const { data } = await supabase
    .from("dispatch_sessions")
    .select("id, name, state, day_number, eligible_roles, opened_at, closed_at, redemptions(count)")
    .order("sort_order");

  type Cruda = Omit<FilaSesion, "canjes"> & { redemptions: { count: number }[] };
  const sesiones: FilaSesion[] = ((data ?? []) as unknown as Cruda[]).map((s) => ({
    ...s,
    canjes: s.redemptions?.[0]?.count ?? 0,
  }));

  return (
    <Pagina
      eyebrow={`${sesiones.length} ventanas de entrega`}
      titulo="Sesiones"
      descripcion="Las abres y las cierras a mano. Solo puede haber una abierta a la vez: no es una recomendación, la base de datos lo impide."
      acciones={<NuevaSesion />}
    >
      {error && (
        <p className="border-l-[3px] border-duplicate bg-surface p-4 text-sub text-duplicate">
          {error}
        </p>
      )}

      {sesiones.length === 0 ? (
        <p className="border border-dashed border-line-control p-6 text-body text-fg-tertiary">
          No hay ninguna sesión. Crea la primera para que los escaneadores
          puedan empezar a escanear.
        </p>
      ) : (
        <ListaSesiones
          sesiones={sesiones}
          onAbrir={abrirSesion}
          onCerrar={cerrarSesion}
          onBorrar={borrarSesion}
        />
      )}
    </Pagina>
  );
}
