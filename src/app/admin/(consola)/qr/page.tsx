import { createClient } from "@/lib/supabase/server";
import { Pagina } from "@/components/admin/Pagina";
import { PanelQR, type PersonaQR } from "@/components/admin/PanelQR";

export const dynamic = "force-dynamic";

export default async function QR() {
  const supabase = await createClient();

  const [{ data: gente }, { data: foros }] = await Promise.all([
    supabase
      .from("participants")
      .select("id, full_name, role, representation, position, dietary_notes, external_code, qr_token, forums(name, short_name)")
      .eq("is_active", true)
      .order("full_name"),
    supabase.from("forums").select("id, name, short_name").order("sort_order"),
  ]);

  type Cruda = Omit<PersonaQR, "foro" | "foro_corto"> & {
    forums: { name: string; short_name: string } | null;
  };

  const personas: PersonaQR[] = ((gente ?? []) as unknown as Cruda[]).map((p) => ({
    ...p,
    foro: p.forums?.name ?? null,
    foro_corto: p.forums?.short_name ?? null,
  }));

  return (
    <Pagina
      eyebrow="Códigos"
      titulo="QR"
      descripcion="El código de cada persona, sin gafete. Se genera en tu navegador a partir del token que ya está en la base: descargarlo no lo cambia ni lo invalida."
      ancho="ancho"
    >
      <PanelQR personas={personas} foros={foros ?? []} />
    </Pagina>
  );
}
