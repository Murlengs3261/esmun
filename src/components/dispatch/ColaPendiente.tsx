"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useReloj } from "@/lib/hooks";
import { descartarConflictos, todaLaCola, type CanjeLocal } from "@/lib/offline";

/**
 * 10 · Cola pendiente. Sin botones peligrosos: no hay «reintentar»,
 * «vaciar» ni «forzar subida». La cola sube sola desde el escáner.
 */

const MAX_FILAS = 5;

function hora(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("es", { hour12: false });
}

function haceCuanto(iso: string | null, ahora: number) {
  if (!iso) return null;
  const s = Math.max(0, Math.round((ahora - new Date(iso).getTime()) / 1000));
  if (s < 60) return `hace ${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m} min`;
  return `hace ${Math.floor(m / 60)} h ${m % 60} min`;
}

function motivo(c: CanjeLocal) {
  if (c.estado === "sesion_cerrada") return "la sesión ya estaba cerrada al subir";
  const r = c.respuesta;
  if (r?.status === "duplicate") {
    return `ya entregado ${hora(r.redeemed_at)}${r.by ? ` por ${r.by}` : ""}${r.station ? ` · ${r.station}` : ""}`;
  }
  if (r?.status === "not_eligible") return "rol sin derecho en esta sesión";
  if (r?.status === "unknown_token") return "código no reconocido por el servidor";
  return "el servidor no lo aceptó";
}

export function ColaPendiente() {
  const router = useRouter();
  const [filas, setFilas] = useState<CanjeLocal[] | null>(null);
  const ahora = useReloj(1_000) * 1_000;

  const cargar = useCallback(() => todaLaCola().then(setFilas), []);

  useEffect(() => {
    void cargar();
    const t = setInterval(cargar, 3_000);
    return () => clearInterval(t);
  }, [cargar]);

  let sinSenalDesde: string | null = null;
  try { sinSenalDesde = localStorage.getItem("esmun.sinSenalDesde"); } catch { /* sin almacenamiento */ }

  const pendientes = (filas ?? []).filter((f) => f.estado === "pendiente");
  const conflictos = (filas ?? []).filter((f) => f.estado !== "pendiente");
  const ultimoIntento = (filas ?? [])
    .map((f) => f.last_attempt_at)
    .filter((x): x is string => Boolean(x))
    .sort()
    .at(-1) ?? null;

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
        <span className="text-label font-semibold">Cola pendiente</span>
      </header>

      {filas === null ? (
        <div className="mt-8 h-16 w-24 animate-pulse bg-surface" />
      ) : (
        <>
          <div className="mt-8">
            <p className="font-plate text-[64px] leading-none">{pendientes.length}</p>
            <p className="mt-2 text-body text-fg-secondary">
              {pendientes.length === 0
                ? "Nada pendiente"
                : pendientes.length === 1 ? "canje esperando subir" : "canjes esperando subir"}
            </p>
          </div>

          {pendientes.length === 0 ? (
            <p className="mt-6 text-body text-fg-secondary">
              Todos los canjes de este turno ya están en el sistema.
            </p>
          ) : (
            <>
              <dl className="mt-6 border border-line bg-surface">
                <Fila k="Más antiguo" v={hora(pendientes[0].redeemed_at)} />
                <Fila k="Sin señal desde" v={sinSenalDesde ? `${haceCuanto(sinSenalDesde, ahora)}` : "—"} />
                <Fila k="Último intento" v={ultimoIntento ? `${haceCuanto(ultimoIntento, ahora)}` : "En espera"} />
              </dl>

              <ul className="mt-6 border border-line">
                {pendientes.slice(0, MAX_FILAS).map((c, i) => (
                  <li
                    key={c.no}
                    className={`flex h-[52px] items-center justify-between px-4 ${i ? "border-t border-line" : ""}`}
                  >
                    <span className="text-body">Canje #{c.no}</span>
                    <span className="font-mono text-label text-fg-tertiary">{hora(c.redeemed_at)}</span>
                  </li>
                ))}
                {pendientes.length > MAX_FILAS && (
                  <li className="flex h-[52px] items-center border-t border-line px-4 text-label text-fg-tertiary">
                    y {pendientes.length - MAX_FILAS} más
                  </li>
                )}
              </ul>

              <p className="mt-6 border-l-[3px] border-accent pl-4 text-sub text-fg-secondary">
                No hay nada que tocar aquí. En cuanto vuelva la señal se suben en
                orden y este número baja a cero. No cierres la app: la cola vive
                en este teléfono.
              </p>
            </>
          )}

          {conflictos.length > 0 && (
            <section className="mt-8">
              <h2 className="text-label font-semibold">
                {conflictos.length === 1
                  ? "1 canje no se registró"
                  : `${conflictos.length} canjes no se registraron`}
              </h2>
              <p className="mt-1 text-sub text-fg-tertiary">
                Quedaron anotados en el sistema como intento. Si alguien reclama,
                mándalo con el organizador.
              </p>
              <ul className="mt-3 border border-line">
                {conflictos.map((c, i) => (
                  <li key={c.no} className={`px-4 py-3 ${i ? "border-t border-line" : ""}`}>
                    <p className="text-body">Canje #{c.no} · {hora(c.redeemed_at)}</p>
                    <p className="text-label text-fg-tertiary">{motivo(c)}</p>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={async () => { await descartarConflictos(); await cargar(); }}
                className="mt-3 text-label font-semibold text-fg-tertiary"
              >
                Quitar de esta lista
              </button>
            </section>
          )}
        </>
      )}

      <div className="mt-auto pt-8 pb-4">
        <Button size="xl" fullWidth onClick={() => router.push("/escanear")}>
          Volver a escanear
        </Button>
      </div>
      <div className="pb-safe" />
    </main>
  );
}

function Fila({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between border-t border-line px-4 py-3 first:border-t-0">
      <dt className="text-label text-fg-tertiary">{k}</dt>
      <dd className="font-mono text-label">{v}</dd>
    </div>
  );
}
