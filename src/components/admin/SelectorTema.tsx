"use client";

import { useState } from "react";
import { useAlmacenLocal } from "@/lib/hooks";

type Tema = "sistema" | "claro" | "oscuro";

const OPCIONES: { valor: Tema; etiqueta: string; nota: string }[] = [
  { valor: "sistema", etiqueta: "Sistema", nota: "Sigue al teléfono o la computadora" },
  { valor: "claro", etiqueta: "Claro", nota: "Para revisar listados con luz" },
  { valor: "oscuro", etiqueta: "Oscuro", nota: "Menos deslumbramiento de noche" },
];

export function SelectorTema() {
  const guardado = useAlmacenLocal("esmun.tema") as Tema | null;
  const [elegido, setElegido] = useState<Tema | null>(null);
  const tema = elegido ?? guardado ?? "sistema";

  function elegir(t: Tema) {
    setElegido(t);
    localStorage.setItem("esmun.tema", t);
    const raiz = document.documentElement;
    if (t === "sistema") raiz.removeAttribute("data-theme");
    else raiz.setAttribute("data-theme", t === "claro" ? "light" : "dark");
  }

  return (
    <div className="flex flex-col gap-3">
      {OPCIONES.map((o) => {
        const activo = tema === o.valor;
        return (
          <button
            key={o.valor}
            type="button"
            onClick={() => elegir(o.valor)}
            aria-pressed={activo}
            className={[
              "flex items-center justify-between gap-4 px-5 py-4 text-left",
              activo ? "border-2 border-accent" : "border border-line-control",
            ].join(" ")}
          >
            <span className="flex flex-col gap-1">
              <span className="text-body font-semibold">{o.etiqueta}</span>
              <span className="text-label text-fg-tertiary">{o.nota}</span>
            </span>
            <span
              aria-hidden
              className={`size-6 shrink-0 ${activo ? "bg-accent" : "border border-line-control"}`}
            />
          </button>
        );
      })}
      <p className="text-label text-fg-tertiary">
        Solo afecta a esta consola y a este dispositivo. La app del escaneador
        se queda siempre oscura: se usa en pasillos con poca luz y con la cámara
        encendida durante horas.
      </p>
    </div>
  );
}
