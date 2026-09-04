"use client";

import { useId, useState } from "react";
import { generarSugerencia } from "@/lib/sugerir";

/**
 * Se muestra en claro por defecto. No es descuido: quien la escribe es el
 * admin poniéndosela a otra persona, y va a tener que dictarla o
 * apuntarla. Ocultarla con puntitos solo sirve para escribirla mal.
 */
export function CampoContrasena({
  name = "password",
  etiqueta = "Contraseña",
  ayuda,
  valorInicial = "",
  autoFocus,
}: {
  name?: string;
  etiqueta?: string;
  ayuda?: string;
  valorInicial?: string;
  autoFocus?: boolean;
}) {
  const id = useId();
  const [valor, setValor] = useState(valorInicial);
  const [oculta, setOculta] = useState(false);
  const corta = valor.length > 0 && valor.length < 6;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="type-micro text-fg-tertiary">
        {etiqueta}
      </label>

      <div className="flex gap-2">
        <div
          className={[
            "flex h-14 flex-1 items-center bg-surface",
            corta ? "border border-duplicate" : "border border-line-control",
          ].join(" ")}
        >
          <input
            id={id}
            name={name}
            type={oculta ? "password" : "text"}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus={autoFocus}
            required
            minLength={6}
            className="h-full w-full bg-transparent px-4 font-mono text-body text-fg outline-none"
          />
          <button
            type="button"
            onClick={() => setOculta((o) => !o)}
            className="h-12 shrink-0 px-3 text-label font-semibold text-accent"
          >
            {oculta ? "Ver" : "Ocultar"}
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            setValor(generarSugerencia());
            setOculta(false);
          }}
          className="h-14 shrink-0 border-2 border-line-control px-4 text-label font-semibold text-fg-secondary"
        >
          Sugerir
        </button>
      </div>

      {corta ? (
        <p className="text-label text-duplicate">
          Necesita al menos 6 caracteres. Van {valor.length}.
        </p>
      ) : ayuda ? (
        <p className="max-w-[62ch] text-label text-fg-tertiary">{ayuda}</p>
      ) : null}
    </div>
  );
}
