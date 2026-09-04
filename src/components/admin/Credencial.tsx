"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

/** Resumen para copiar y dictar. La contraseña la acaba de escribir el
 *  admin, así que no es una revelación: es una comodidad. En la base
 *  Supabase la guarda con bcrypt y no se puede volver a leer desde ahí. */
export function Credencial({
  credencial,
  onCerrar,
}: {
  credencial: { email: string; password: string; nombre: string };
  onCerrar: () => void;
}) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    const texto = `ESMUN — ${credencial.nombre}\nCorreo: ${credencial.email}\nContraseña: ${credencial.password}`;
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <div className="w-full border-2 border-accent bg-surface p-5 lg:p-6">
      <p className="type-micro text-accent">Lista para dictar</p>
      <h2 className="font-plate mt-3 text-section">{credencial.nombre}</h2>

      <dl className="mt-5 flex flex-col gap-4">
        <div>
          <dt className="type-micro text-fg-tertiary">Correo</dt>
          <dd className="mt-1 break-all font-mono text-body">{credencial.email}</dd>
        </div>
        <div>
          <dt className="type-micro text-fg-tertiary">Contraseña</dt>
          <dd className="mt-1 select-all break-all border border-line-control bg-bg-sunken px-4 py-3 font-mono text-name">
            {credencial.password}
          </dd>
        </div>
      </dl>

      <p className="mt-5 max-w-[62ch] text-sub text-fg-secondary">
        Guárdala donde la tengas a mano. En la base queda cifrada y no se
        puede volver a leer, pero si se pierde le pones otra desde esta misma
        pantalla, sin necesidad de saber la anterior.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button type="button" size="md" variant="secondary" onClick={copiar}>
          {copiado ? "Copiado" : "Copiar correo y contraseña"}
        </Button>
        <Button type="button" size="md" onClick={onCerrar}>
          Listo
        </Button>
      </div>
    </div>
  );
}
