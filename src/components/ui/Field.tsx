"use client";

import { useId, useState } from "react";

interface Props extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  label: string;
  help?: string;
  error?: string;
  /** Acción a la derecha del campo: «Ver» / «Ocultar». */
  trailing?: React.ReactNode;
}

/** La etiqueta va ENCIMA en micro mayúsculas, nunca flotante:
 *  una etiqueta que se mueve al escribir es una que hay que releer. */
export function Field({ label, help, error, trailing, className = "", ...rest }: Props) {
  const id = useId();
  const [focused, setFocused] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="type-micro text-fg-tertiary">
        {label}
      </label>

      <div
        className={[
          "relative flex h-14 items-center bg-surface",
          error ? "border border-duplicate" : "border border-line-control",
          focused && !error ? "border-b-2 border-b-accent" : "",
        ].join(" ")}
      >
        <input
          id={id}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || help ? `${id}-msg` : undefined}
          className={[
            "h-full w-full bg-transparent px-4 text-body text-fg outline-none",
            "placeholder:text-fg-disabled",
            trailing ? "pr-20" : "",
            className,
          ].join(" ")}
          {...rest}
        />
        {trailing ? <div className="absolute right-2">{trailing}</div> : null}
      </div>

      {error ? (
        <p id={`${id}-msg`} className="flex items-start gap-2 text-label text-duplicate">
          <span aria-hidden className="mt-0.5 inline-block size-4 shrink-0 bg-duplicate" />
          {error}
        </p>
      ) : help ? (
        <p id={`${id}-msg`} className="text-label text-fg-tertiary">
          {help}
        </p>
      ) : null}
    </div>
  );
}
