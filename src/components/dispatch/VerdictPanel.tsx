"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { RedeemResponse, ScanVerdict } from "@/lib/domain/types";

/**
 * El contrato de diferenciación no es estético: un 8% de los hombres no
 * distingue rojo de verde y el pasillo tiene mala luz. Cada estado cambia
 * COLOR, FORMA, ÍCONO, POSICIÓN DEL BLOQUE y VERBO — cinco señales, de las
 * cuales cuatro sobreviven sin ver color.
 *
 *   granted      verde   · cuadrado · centrado        · «Entrégale»
 *   granted+diet verde   · bloque blanco dominante    · la alergia manda
 *   duplicate    rojo    · círculo  · arriba-izquierda · «No entregar»
 *   inválido     ámbar   · trama 45° · abajo-derecha   · «Revisa»
 */

const LOCK_MS = {
  granted: 0,
  granted_diet: 800,
  duplicate: 2000,
  invalid: 600,
  sin_red: 0,
} as const;

const AUTO_ADVANCE_MS = 1200;

function hora(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("es", { hour12: false });
}

interface Props {
  result: ScanVerdict;
  station?: string | null;
  onContinue: () => void;
}

export function VerdictPanel({ result, onContinue }: Props) {
  const diet = result.status === "granted" ? result.diet : null;
  const kind =
    result.status === "granted" ? (diet ? "granted_diet" : "granted")
    : result.status === "duplicate" ? "duplicate"
    : result.status === "sin_red" ? "sin_red"
    : "invalid";

  const lockMs: number = LOCK_MS[kind];
  const [locked, setLocked] = useState(lockMs > 0);
  const [remaining, setRemaining] = useState(lockMs);

  // Bloqueo con progreso visible. En 'duplicate' son 2 s obligatorios: si
  // el despachador cierra sin leer, entrega comida dos veces.
  useEffect(() => {
    if (lockMs <= 0) return;
    const t0 = performance.now();
    let raf = 0;
    const tick = () => {
      const rest = Math.max(0, lockMs - (performance.now() - t0));
      setRemaining(rest);
      if (rest <= 0) setLocked(false);
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [lockMs]);

  // Auto-avance solo en el habilitado limpio: la mano lleva comida.
  useEffect(() => {
    if (kind !== "granted") return;
    const t = setTimeout(onContinue, AUTO_ADVANCE_MS);
    return () => clearTimeout(t);
  }, [kind, onContinue]);

  // Sin señal no es un veredicto sobre la persona: va en índigo, como la
  // banda de conexión, y no en ámbar.
  const bg =
    kind === "duplicate" ? "var(--state-duplicate)"
    : kind === "invalid" ? "var(--state-invalid)"
    : kind === "sin_red" ? "var(--accent)"
    : "var(--state-granted)";

  const body =
    kind === "duplicate" ? "var(--on-duplicate-body)"
    : kind === "invalid" ? "var(--on-invalid-body)"
    : "var(--on-granted-body)";

  const label =
    kind === "duplicate" ? "var(--on-duplicate-label)"
    : kind === "invalid" ? "var(--on-invalid-label)"
    : "var(--on-granted-label)";

  return (
    <div
      data-verdict={kind}
      role="alert"
      aria-live="assertive"
      className="fixed inset-0 z-50 flex flex-col text-white"
      style={{ background: bg }}
    >
      <div className="pt-safe" />

      <div className="flex min-h-0 flex-1 flex-col px-5">
        {result.status === "granted" && !diet && (
          <Granted result={result} bodyColor={body} labelColor={label} />
        )}
        {result.status === "granted" && diet && (
          <GrantedDiet result={result} diet={diet} bodyColor={body} />
        )}
        {result.status === "duplicate" && (
          <Duplicate result={result} bodyColor={body} labelColor={label} />
        )}
        {(result.status === "unknown_token" ||
          result.status === "not_eligible" ||
          result.status === "session_closed" ||
          result.status === "fallo") && (
          <Invalid result={result} bodyColor={body} labelColor={label} />
        )}
        {result.status === "sin_red" && <SinRed />}
      </div>

      <div className="px-5 pb-4">
        <Button
          size="xl"
          fullWidth
          onClick={onContinue}
          disabled={locked}
          className="relative overflow-hidden !text-[color:var(--btn-ink)] disabled:!bg-white/15 disabled:!text-white"
          style={
            {
              background: kind === "duplicate" ? "var(--state-duplicate-ink)" : "#FFFFFF",
              ["--btn-ink" as string]: bg,
            } as React.CSSProperties
          }
        >
          {locked ? (
            <>
              <span
                data-progress
                aria-hidden
                className="absolute inset-y-0 left-0 bg-white/25"
                style={{ width: `${(1 - remaining / lockMs) * 100}%` }}
              />
              <span className="relative">
                Espera {Math.ceil(lockMs / 1000)} s · {(remaining / 1000).toFixed(1)}
              </span>
            </>
          ) : kind === "granted" ? (
            "Continuar"
          ) : kind === "granted_diet" ? (
            "Leí la alerta · continuar"
          ) : (
            "Volver a escanear"
          )}
        </Button>
      </div>
      <div className="pb-safe" />
    </div>
  );
}

/* ── 05 · Habilitado ─────────────────────────────────────────────────── */
function Granted({
  result, bodyColor, labelColor,
}: { result: Extract<RedeemResponse, { status: "granted" }>; bodyColor: string; labelColor: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      {/* Cuadrado 96 — la forma de este estado */}
      <div className="flex size-24 items-center justify-center border-4 border-white">
        <svg viewBox="0 0 24 24" className="size-12" fill="none" stroke="currentColor" strokeWidth="3">
          <path d="M4 12.5 L9.5 18 L20 6.5" strokeLinecap="square" />
        </svg>
      </div>

      <p className="font-plate mt-6 text-verdict tracking-[0.02em]">Entrégale</p>

      <div className="mt-8 h-px w-full bg-white/30" />

      <p className="mt-6 text-name font-semibold text-balance">{result.name}</p>
      <p className="mt-3 text-body" style={{ color: bodyColor }}>{result.detail}</p>
      <p className="type-micro mt-3" style={{ color: labelColor }}>
        {result.role ? `${result.role} · ` : ""}Sin restricciones alimentarias
      </p>

      <p className="stamp type-micro mt-8 border-2 border-white/50 px-3 py-1.5" style={{ color: labelColor }}>
        {result.offline ? "Guardado en el teléfono" : "Sellado"} {hora(result.redeemed_at)}
      </p>
    </div>
  );
}

/* ── 06 · Habilitado con alerta alimentaria ──────────────────────────── */
function GrantedDiet({
  result, diet, bodyColor,
}: { result: Extract<RedeemResponse, { status: "granted" }>; diet: string; bodyColor: string }) {
  return (
    <div className="flex flex-1 flex-col justify-center">
      {/* La alerta domina: es el único momento en que este dato existe */}
      <div className="border-y-8 border-[#0E0F1A] bg-white px-4 py-4 text-fg">
        <p className="type-micro flex items-center gap-2 text-[#0E0F1A]">
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 3 L22 20 H2 Z M12 9 v5 M12 17 v.5" strokeLinecap="square" />
          </svg>
          Atención antes de entregar
        </p>
        <p className="font-plate mt-2 text-verdict text-[#0E0F1A]">{diet}</p>
        <p className="mt-2 text-sub text-[#41455F]">
          Entrégale la bolsa marcada con cinta azul.
        </p>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center border-[3px] border-white">
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M4 12.5 L9.5 18 L20 6.5" strokeLinecap="square" />
          </svg>
        </span>
        <p className="font-plate text-title">Habilitado</p>
      </div>

      <p className="mt-5 text-name font-semibold text-balance">{result.name}</p>
      <p className="mt-2 text-body" style={{ color: bodyColor }}>{result.detail}</p>

      <p className="stamp type-micro mt-6 self-start border-2 border-white/50 px-3 py-1.5">
        {result.offline ? "Guardado en el teléfono" : "Sellado"} {hora(result.redeemed_at)}
      </p>
    </div>
  );
}

/* ── 07 · Ya entregado ───────────────────────────────────────────────── */
function Duplicate({
  result, bodyColor, labelColor,
}: { result: Extract<RedeemResponse, { status: "duplicate" }>; bodyColor: string; labelColor: string }) {
  return (
    <div className="flex flex-1 flex-col justify-start pt-6 text-left">
      <div className="flex items-center gap-4">
        {/* Círculo con barra diagonal — la forma de este estado */}
        <span className="relative flex size-16 shrink-0 items-center justify-center rounded-full border-[6px] border-white">
          <span className="absolute h-[6px] w-11 rotate-45 bg-white" />
        </span>
        <p className="font-plate text-verdict tracking-[0.02em]">No entregar</p>
      </div>

      <p className="mt-6 text-name font-semibold text-balance">{result.name}</p>
      <p className="mt-2 text-body" style={{ color: bodyColor }}>{result.detail}</p>

      {/* Cuño de doble borde: el gesto expresivo del sistema */}
      <div className="stamp stamp-duplicate mt-7 inline-block self-start border-[3px] border-double border-white/60 px-4 py-3">
        <p className="type-micro" style={{ color: labelColor }}>Ya sellado en esta sesión</p>
        <p className="font-plate mt-1 text-title">{hora(result.redeemed_at)}</p>
        <p className="mt-1 text-sub" style={{ color: bodyColor }}>
          por {result.by ?? "—"}{result.station ? ` · ${result.station}` : ""}
        </p>
      </div>

      <p className="mt-7 text-body" style={{ color: bodyColor }}>
        Esta persona ya recibió su comida. Si insiste, mándala con el organizador:
        solo él puede anular una entrega.
      </p>
    </div>
  );
}

/* ── 08 · QR no válido ───────────────────────────────────────────────── */
function Invalid({
  result, bodyColor, labelColor,
}: { result: ScanVerdict; bodyColor: string; labelColor: string }) {
  const titular =
    result.status === "unknown_token" ? "Código no reconocido"
    : result.status === "not_eligible" ? "Rol sin derecho en esta sesión"
    : result.status === "fallo" ? "No se pudo registrar"
    : "La sesión ya está cerrada";

  const cuerpo =
    result.status === "unknown_token"
      ? "Este QR no pertenece a ESMUN. Puede ser el carnet del colegio o un código de otro evento."
      : result.status === "not_eligible"
        ? `${result.name} · ${result.role ?? "otro rol"}. Esta sesión no incluye a ese rol.`
        : result.status === "fallo"
          ? `El servidor respondió: ${result.message}. Vuelve a escanear; si sigue, avisa al organizador.`
          : "El organizador cerró la entrega. Ya no se pueden registrar canjes.";

  return (
    <div className="flex flex-1 flex-col">
      {/* Trama diagonal 45°: la marca de este estado, legible sin color */}
      <div
        aria-hidden
        className="-mx-5 h-14 shrink-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, var(--state-invalid-ink) 0 12px, transparent 12px 24px)",
        }}
      />

      <div className="flex flex-1 flex-col items-end justify-end pb-6 text-right">
        <div className="flex items-center gap-4">
          <p className="font-plate text-verdict tracking-[0.02em]">Revisa</p>
          <span className="flex size-16 shrink-0 items-center justify-center border-4 border-white font-plate text-title">
            ?
          </span>
        </div>

        <p className="mt-6 text-name font-semibold text-balance">{titular}</p>
        <p className="mt-3 max-w-[300px] text-body" style={{ color: bodyColor }}>{cuerpo}</p>
        {result.status !== "fallo" && (
          <p className="mt-6 text-sub" style={{ color: labelColor }}>
            Pídele el gafete de ESMUN o mándala con el organizador.
          </p>
        )}
      </div>
    </div>
  );
}

/* ── 09b · Sin señal y sin lista local ───────────────────────────────── */
function SinRed() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <span aria-hidden className="size-16 border-[6px] border-white" />
      <p className="font-plate mt-6 text-verdict tracking-[0.02em]">Sin señal</p>
      <p className="mt-6 max-w-[300px] text-body text-white/85">
        El teléfono no alcanzó a descargar la lista de esta sesión y ahora no
        hay conexión. No se registró nada.
      </p>
      <p className="mt-4 max-w-[300px] text-sub text-white/70">
        Acércate a donde haya señal, espera a que la banda azul desaparezca y
        vuelve a escanear este gafete.
      </p>
    </div>
  );
}
