"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

interface Puesto {
  id: string;
  label: string;
  location: string | null;
}

/** El puesto queda registrado en cada entrega. Se guarda en el teléfono
 *  junto a un identificador de dispositivo, que separa dos teléfonos
 *  aunque compartan etiqueta. */
export function ElegirPuesto({ nombre, puestos }: { nombre: string; puestos: Puesto[] }) {
  const router = useRouter();
  const [elegido, setElegido] = useState<Puesto | null>(puestos[0] ?? null);

  function continuar() {
    if (!elegido) return;
    let device = localStorage.getItem("esmun.device");
    if (!device) {
      device = crypto.randomUUID().slice(0, 8);
      localStorage.setItem("esmun.device", device);
    }
    localStorage.setItem("esmun.station", elegido.label);
    router.push("/escanear");
  }

  return (
    <main className="flex min-h-[100dvh] flex-col px-5">
      <div className="pt-safe" />

      <header className="flex h-14 items-center border-b border-line">
        <span className="text-label font-semibold text-fg-secondary">{nombre}</span>
      </header>

      <h1 className="font-plate mt-8 text-title">¿En qué puesto estás?</h1>
      <p className="mt-2 text-sub text-fg-secondary">
        Queda registrada en cada entrega que hagas. Si te mueves de puesto,
        vuelve a esta pantalla.
      </p>

      {puestos.length === 0 ? (
        <p className="mt-8 border border-dashed border-line-control p-5 text-body text-fg-tertiary">
          No hay puestos configurados todavía. Pídele al organizador que los
          cree en la consola.
        </p>
      ) : (
        <ul className="mt-8 flex flex-col gap-3">
          {puestos.map((p) => {
            const activo = elegido?.id === p.id;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setElegido(p)}
                  aria-pressed={activo}
                  className={[
                    "flex h-[72px] w-full items-center justify-between px-5 text-left",
                    activo ? "border-2 border-accent" : "border border-line-control",
                  ].join(" ")}
                >
                  <span className="flex flex-col gap-1">
                    <span className="font-plate text-section">{p.label}</span>
                    {p.location ? (
                      <span className="type-micro text-fg-tertiary">{p.location}</span>
                    ) : null}
                  </span>
                  <span
                    aria-hidden
                    className={[
                      "size-6 shrink-0",
                      activo ? "bg-accent" : "border border-line-control",
                    ].join(" ")}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-auto pb-4 pt-8">
        <Button size="xl" fullWidth onClick={continuar} disabled={!elegido}>
          {elegido ? `Continuar en ${elegido.label}` : "Elige un puesto"}
        </Button>
      </div>
      <div className="pb-safe" />
    </main>
  );
}
