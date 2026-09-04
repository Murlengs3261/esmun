"use client";

import { forwardRef } from "react";

type Variant = "primary" | "secondary" | "destructive" | "ghost";
type Size = "sm" | "md" | "lg" | "xl";

interface Props extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  loading?: boolean;
  /** Micro bajo la etiqueta: «Pide confirmación escrita», «y otras 6». */
  subLabel?: string;
  children: React.ReactNode;
}

const HEIGHT: Record<Size, string> = {
  sm: "h-10",  // 40
  md: "h-12",  // 48
  lg: "h-14",  // 56
  xl: "h-16",  // 64 — la acción única del scanner
};

const VARIANT: Record<Variant, string> = {
  primary: "bg-accent text-fg-on-accent",
  secondary: "bg-transparent text-fg border-2 border-line-control",
  destructive: "bg-duplicate text-white",
  ghost: "bg-transparent text-fg-tertiary",
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "primary", size = "lg", fullWidth, loading, subLabel, children, className = "", disabled, ...rest },
  ref,
) {
  // En lg/xl la etiqueta va en tipografía de placa; en sm/md, en cuerpo.
  const big = size === "lg" || size === "xl";
  const type = big
    ? "font-plate text-section tracking-[0.04em]"
    : "text-body font-semibold";

  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={[
        "relative inline-flex flex-col items-center justify-center gap-0.5 px-5",
        "select-none transition-[filter,transform] duration-[80ms] ease-out",
        "active:brightness-[0.92] active:scale-[0.99]",
        "disabled:bg-[#B9B9CC] disabled:text-[#6F7288] disabled:border-transparent disabled:active:scale-100",
        HEIGHT[size],
        VARIANT[variant],
        type,
        fullWidth ? "w-full" : "",
        className,
      ].join(" ")}
      {...rest}
    >
      <span className="leading-none">{children}</span>
      {subLabel ? (
        <span className="type-micro opacity-70 leading-none normal-case tracking-[0.09em]">
          {subLabel}
        </span>
      ) : null}

      {/* Cargando: barra indeterminada al pie, sin spinner ni cambio de alto */}
      {loading ? (
        <span
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-black/15"
        >
          <span className="block h-full w-1/3 animate-[slide_1100ms_ease-in-out_infinite] bg-current opacity-80" />
        </span>
      ) : null}

      <style>{`@keyframes slide{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}`}</style>
    </button>
  );
});
