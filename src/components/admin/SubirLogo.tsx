"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { guardarLogo, quitarLogo, type EstadoAlta } from "@/lib/actions";
import { Button } from "@/components/ui/Button";
import { Aviso } from "@/components/admin/Aviso";

const TIPOS = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];
const MAX = 2 * 1024 * 1024;

export function SubirLogo({ actual }: { actual: string | null }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [estado, setEstado] = useState<EstadoAlta>({});
  const [subiendo, setSubiendo] = useState(false);
  const [pendiente, iniciar] = useTransition();
  const [vista, setVista] = useState<string | null>(actual);

  async function elegir(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;

    if (!TIPOS.includes(archivo.type)) {
      setEstado({ error: "Tiene que ser PNG, JPG, SVG o WebP." });
      return;
    }
    if (archivo.size > MAX) {
      setEstado({ error: "El archivo pesa más de 2 MB. Redúcelo antes de subirlo." });
      return;
    }

    setEstado({});
    setSubiendo(true);
    setVista(URL.createObjectURL(archivo));

    const supabase = createClient();
    const extension = archivo.name.split(".").pop()?.toLowerCase() ?? "png";
    // Nombre con marca de tiempo: evita que el navegador siga mostrando
    // el logo viejo desde su caché.
    const ruta = `logo-${Date.now()}.${extension}`;

    const { error } = await supabase.storage
      .from("marca")
      .upload(ruta, archivo, { cacheControl: "3600", upsert: true });

    if (error) {
      setSubiendo(false);
      setVista(actual);
      setEstado({
        error: error.message.includes("row-level security")
          ? "Sin permiso para subir. ¿Corriste la migración 0007?"
          : error.message,
      });
      return;
    }

    const { data } = supabase.storage.from("marca").getPublicUrl(ruta);
    const r = await guardarLogo(data.publicUrl, ruta);
    setSubiendo(false);
    setEstado(r);
    if (r.ok) router.refresh();
  }

  function quitar() {
    iniciar(async () => {
      const r = await quitarLogo();
      setEstado(r);
      if (r.ok) {
        setVista(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-5">
        <div className="flex size-28 shrink-0 items-center justify-center border border-dashed border-line-control bg-surface p-2">
          {vista ? (
            <Image
              src={vista}
              alt="Logo actual de ESMUN"
              width={96}
              height={96}
              unoptimized
              className="max-h-24 w-auto object-contain"
            />
          ) : (
            <span className="type-micro text-center text-fg-tertiary">Sin logo</span>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <input
            ref={input}
            type="file"
            accept={TIPOS.join(",")}
            onChange={elegir}
            className="sr-only"
          />
          <Button
            type="button"
            size="md"
            variant="secondary"
            loading={subiendo}
            onClick={() => input.current?.click()}
          >
            {subiendo ? "Subiendo…" : vista ? "Cambiar logo" : "Subir logo"}
          </Button>

          {vista ? (
            <button
              type="button"
              onClick={quitar}
              disabled={pendiente}
              className="self-start text-label font-semibold text-duplicate"
            >
              Quitar
            </button>
          ) : null}

          <p className="max-w-[42ch] text-label text-fg-tertiary">
            PNG, JPG, SVG o WebP, hasta 2 MB. Para el gafete conviene un PNG con
            fondo transparente: se imprime en negro sobre papel.
          </p>
        </div>
      </div>

      <Aviso estado={estado} />
    </div>
  );
}
