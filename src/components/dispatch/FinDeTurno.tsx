"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { useAlmacenLocal } from "@/lib/hooks";
import { contarPendientes, limpiarPadron, type Rechazos } from "@/lib/offline";

/**
 * 11 · Fin de turno. Cerrar la sesión pide confirmación escrita y se
 * bloquea mientras haya canjes sin subir: la cola vive en este teléfono
 * y cerrar sesión la dejaría huérfana.
 */

interface Props {
  sesion: { id: string; name: string; day_number: number | null } | null;
  entregados: number;
  primero: string | null;
  ultimo: string | null;
}

const ETIQUETA: Record<string, string> = {
  duplicate: "Ya entregado",
  unknown_token: "QR no reconocido",
  not_eligible: "Rol sin derecho",
  session_closed: "Sesión cerrada",
  sin_red: "Sin señal ni lista",
  fallo: "No registrado",
};

function hora(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function duracion(primero: string | null, ultimo: string | null) {
  if (!primero || !ultimo) return null;
  const min = Math.max(1, Math.round((new Date(ultimo).getTime() - new Date(primero).getTime()) / 60_000));
  return min;
}

export function FinDeTurno({ sesion, entregados, primero, ultimo }: Props) {
  const router = useRouter();
  const puesto = useAlmacenLocal("esmun.station");
  const [pendientes, setPendientes] = useState<number | null>(null);
  // Se lee del almacenamiento del teléfono sin efecto: el valor está bien
  // desde el primer render en el cliente y es nulo en el servidor.
  const rechazosCrudo = useAlmacenLocal(`esmun.rechazos.${sesion?.id ?? "-"}`);
  let rechazos: Rechazos = {};
  try { rechazos = rechazosCrudo ? JSON.parse(rechazosCrudo) : {}; } catch { rechazos = {}; }
  const [confirmando, setConfirmando] = useState(false);
  const [texto, setTexto] = useState("");
  const [cerrando, setCerrando] = useState(false);

  useEffect(() => {
    const cargar = () => contarPendientes().then(setPendientes);
    void cargar();
    const t = setInterval(cargar, 3_000);
    return () => clearInterval(t);
  }, []);

  const totalRechazos = Object.values(rechazos).reduce((a, b) => a + b, 0);
  const minutos = duracion(primero, ultimo);
  const ritmo = minutos && entregados ? (entregados / minutos).toFixed(1).replace(".", ",") : null;

  async function cerrarSesion() {
    if (pendientes !== 0 || texto.trim().toUpperCase() !== "SALIR") return;
    setCerrando(true);
    await limpiarPadron();
    await createClient().auth.signOut();
    router.replace("/ingresar");
    router.refresh();
  }

  return (
    <main className="flex min-h-[100dvh] flex-col px-5">
      <div className="pt-safe" />

      <header className="flex h-14 items-center gap-2 border-b border-line">
        <button
          type="button"
          onClick={() => router.push("/escanear")}
          aria-label="Volver"
          className="-ml-2 flex size-11 items-center justify-center"
        >
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M15 5 L8 12 L15 19" strokeLinecap="square" />
          </svg>
        </button>
        <span className="text-label font-semibold">Fin de turno</span>
      </header>

      <div className="mt-7">
        <h1 className="font-plate text-[28px] leading-tight">{sesion?.name ?? "Ninguna sesión abierta"}</h1>
        <p className="type-micro mt-1 text-fg-tertiary">
          {puesto ?? "Sin puesto"}
          {primero ? ` · ${hora(primero)} – ${hora(ultimo)}` : ""}
        </p>
      </div>

      <div className="mt-7 grid grid-cols-2 gap-3">
        <Metrica etiqueta="Entregados" valor={String(entregados)} />
        <Metrica etiqueta="Rechazos" valor={String(totalRechazos)} />
        <Metrica etiqueta="Duración" valor={minutos ? `${Math.floor(minutos / 60)} h ${String(minutos % 60).padStart(2, "0")} min` : "—"} />
        <Metrica etiqueta="Ritmo" valor={ritmo ? `${ritmo} / min` : "—"} />
      </div>

      {totalRechazos > 0 && (
        <dl className="mt-5 border border-line bg-surface">
          <div className="border-b border-line px-4 py-2">
            <dt className="type-micro text-fg-tertiary">Desglose de rechazos</dt>
          </div>
          {Object.entries(rechazos).map(([k, v]) => (
            <div key={k} className="flex items-center justify-between px-4 py-3 not-last:border-b not-last:border-line">
              <dt className="text-body">{ETIQUETA[k] ?? k}</dt>
              <dd className="font-mono text-label">{v}</dd>
            </div>
          ))}
        </dl>
      )}

      <p className="mt-5 flex items-center gap-3 text-sub text-fg-secondary">
        <span
          aria-hidden
          className={`size-2 shrink-0 ${pendientes === 0 ? "bg-granted" : pendientes === null ? "bg-line-control" : "bg-accent"}`}
        />
        {pendientes === null
          ? "Revisando la cola…"
          : pendientes === 0
            ? "Todo subido. Cola en cero."
            : `${pendientes} ${pendientes === 1 ? "canje" : "canjes"} sin subir. Busca señal antes de cerrar.`}
      </p>

      <div className="mt-auto flex flex-col gap-3 pt-8 pb-4">
        <Button size="lg" variant="secondary" fullWidth onClick={() => router.push("/escanear")}>
          Seguir escaneando
        </Button>
        <Button
          size="xl"
          variant="destructive"
          fullWidth
          subLabel="Pide confirmación escrita"
          onClick={() => setConfirmando(true)}
        >
          Cerrar sesión
        </Button>
      </div>
      <div className="pb-safe" />

      {confirmando && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-end bg-black/60">
          <div className="mx-auto w-full max-w-[390px] bg-bg-base p-5">
            <h2 className="font-plate text-title">¿Cerrar tu sesión?</h2>
            {pendientes ? (
              <p className="mt-3 text-body text-fg-secondary">
                No puedes cerrar con {pendientes} {pendientes === 1 ? "canje" : "canjes"} sin
                subir. Busca señal primero.
              </p>
            ) : (
              <>
                <p className="mt-3 text-body text-fg-secondary">
                  Si cierras en medio del despacho, tendrás que volver a entrar con
                  correo y contraseña, y la fila se detiene. Hay 0 canjes sin subir.
                </p>
                <div className="mt-5">
                  <Field
                    label="Escribe SALIR para confirmar"
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    autoCapitalize="characters"
                    autoComplete="off"
                    autoFocus
                  />
                </div>
              </>
            )}
            <div className="mt-6 flex flex-col gap-3">
              {!pendientes && (
                <Button
                  size="xl"
                  variant="destructive"
                  fullWidth
                  disabled={texto.trim().toUpperCase() !== "SALIR"}
                  loading={cerrando}
                  onClick={cerrarSesion}
                >
                  Cerrar sesión
                </Button>
              )}
              <Button size="lg" variant="secondary" fullWidth onClick={() => setConfirmando(false)}>
                Seguir aquí
              </Button>
            </div>
            <div className="pb-safe" />
          </div>
        </div>
      )}
    </main>
  );
}

function Metrica({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex h-[92px] flex-col justify-between border border-line bg-surface p-4">
      <span className="type-micro text-fg-tertiary">{etiqueta}</span>
      <span className="font-plate text-title leading-none">{valor}</span>
    </div>
  );
}
