import { createClient } from "@/lib/supabase/server";
import { SelectorTema } from "@/components/admin/SelectorTema";
import { SubirLogo } from "@/components/admin/SubirLogo";
import { DatosEvento } from "@/components/admin/DatosEvento";
import Link from "next/link";
import { Pagina, Seccion } from "@/components/admin/Pagina";

export const dynamic = "force-dynamic";

export default async function Ajustes() {
  const supabase = await createClient();
  const { data: evento } = await supabase
    .from("events")
    .select("id, name, organization, starts_on, ends_on, logo_url")
    .eq("is_active", true)
    .single();

  return (
    <Pagina eyebrow="Configuración" titulo="Ajustes" ancho="angosto">
      <Seccion
        titulo="Cuentas"
        nota="Quién puede entrar al sistema y con qué permisos."
      >
        <Link
          href="/admin/personal"
          className="flex items-center justify-between gap-4 border border-line-control px-5 py-4 lg:max-w-md"
        >
          <span className="flex flex-col gap-1">
            <span className="text-body font-semibold">Personal del evento</span>
            <span className="text-label text-fg-tertiary">
              Administradores y escaneadores: crear cuentas, cambiar contraseñas, dar de baja
            </span>
          </span>
          <span aria-hidden className="text-fg-tertiary">→</span>
        </Link>
      </Seccion>

      <Seccion
        titulo="Logo de ESMUN"
        nota="Aparece en la pantalla de ingreso, en la consola y —cuando estén listos— impreso en cada gafete."
      >
        <SubirLogo actual={evento?.logo_url ?? null} />
      </Seccion>

      <Seccion titulo="Apariencia" nota="Se guarda en este dispositivo.">
        <SelectorTema />
      </Seccion>

      <Seccion titulo="El evento" nota="El nombre se ve en el pie del ingreso y en los gafetes.">
        <DatosEvento
          nombre={evento?.name ?? ""}
          inicio={evento?.starts_on ?? ""}
          fin={evento?.ends_on ?? ""}
        />
      </Seccion>
    </Pagina>
  );
}
