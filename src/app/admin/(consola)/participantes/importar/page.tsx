import Link from "next/link";
import { Pagina } from "@/components/admin/Pagina";
import { ImportadorCSV } from "@/components/admin/ImportadorCSV";

export const dynamic = "force-dynamic";

export default function Importar() {
  return (
    <Pagina
      eyebrow={<Link href="/admin/participantes" className="text-accent">← Participantes</Link>}
      titulo="Importar CSV"
      descripcion="Carga la lista completa de una vez. Antes de escribir nada te enseño exactamente qué va a pasar con cada fila."
      ancho="ancho"
    >
      <ImportadorCSV />
    </Pagina>
  );
}
