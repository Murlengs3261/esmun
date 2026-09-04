"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reordenarSesiones, type EstadoAlta } from "@/lib/actions";
import { Aviso } from "@/components/admin/Aviso";
import { ROLE_LABEL, type ParticipantRole, type SessionState } from "@/lib/domain/types";

export interface FilaSesion {
  id: string;
  name: string;
  state: SessionState;
  day_number: number | null;
  eligible_roles: ParticipantRole[];
  opened_at: string | null;
  closed_at: string | null;
  canjes: number;
}

const ESTADO: Record<SessionState, { texto: string; clase: string }> = {
  draft: { texto: "Programada", clase: "border border-dashed border-line-control text-fg-tertiary" },
  open: { texto: "Abierta", clase: "bg-granted text-white" },
  closed: { texto: "Cerrada", clase: "border border-line text-fg-tertiary" },
};

function hora(iso: string | null) {
  return iso ? new Date(iso).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" }) : null;
}

export function ListaSesiones({
  sesiones,
  onAbrir,
  onCerrar,
  onBorrar,
}: {
  sesiones: FilaSesion[];
  onAbrir: (fd: FormData) => void;
  onCerrar: (fd: FormData) => void;
  onBorrar: (fd: FormData) => void;
}) {
  const router = useRouter();
  const [, iniciar] = useTransition();
  const [orden, moverOptimista] = useOptimistic(
    sesiones,
    (actual: FilaSesion[], mov: { desde: number; hasta: number }) => {
      const copia = [...actual];
      const [x] = copia.splice(mov.desde, 1);
      copia.splice(mov.hasta, 0, x);
      return copia;
    },
  );
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [estado, setEstado] = useState<EstadoAlta>({});
  const hayAbierta = orden.some((s) => s.state === "open");

  function mover(desde: number, hasta: number) {
    if (hasta < 0 || hasta >= orden.length) return;
    const copia = [...orden];
    const [x] = copia.splice(desde, 1);
    copia.splice(hasta, 0, x);

    iniciar(async () => {
      moverOptimista({ desde, hasta });
      const r = await reordenarSesiones(copia.map((s) => s.id));
      setEstado(r.error ? r : {});
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {estado.error ? <Aviso estado={estado} /> : null}
      <ul className="flex flex-col gap-3">
      {orden.map((s, i) => {
        const e = ESTADO[s.state];
        const borrable = s.state !== "open" && s.canjes === 0;

        return (
          <li key={s.id} className="border border-line bg-surface">
            <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:gap-6">
              {/* Reordenar — flechas en vez de arrastrar: funciona con el
                  pulgar, con teclado y con lector de pantalla. */}
              <div className="flex shrink-0 gap-1 lg:flex-col">
                <button
                  type="button"
                  onClick={() => mover(i, i - 1)}
                  disabled={i === 0}
                  aria-label={`Subir ${s.name}`}
                  className="flex size-12 items-center justify-center border border-line-control text-fg-secondary disabled:border-line disabled:text-fg-disabled lg:size-8"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => mover(i, i + 1)}
                  disabled={i === orden.length - 1}
                  aria-label={`Bajar ${s.name}`}
                  className="flex size-12 items-center justify-center border border-line-control text-fg-secondary disabled:border-line disabled:text-fg-disabled lg:size-8"
                >
                  ↓
                </button>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-body font-semibold text-balance">{s.name}</h2>
                  <span className={`type-micro shrink-0 px-2 py-1 ${e.clase}`}>{e.texto}</span>
                </div>
                <p className="mt-1 text-label text-fg-tertiary">
                  {s.eligible_roles.map((r) => ROLE_LABEL[r]).join(" · ")}
                </p>
                {(s.opened_at || s.canjes > 0) && (
                  <p className="mt-2 font-mono text-label text-fg-secondary">
                    {hora(s.opened_at) ? `Abierta ${hora(s.opened_at)}` : ""}
                    {hora(s.closed_at) ? ` · Cerrada ${hora(s.closed_at)}` : ""}
                    {s.canjes > 0 ? ` · ${s.canjes} entregas` : ""}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {s.state === "open" ? (
                  <form action={onCerrar}>
                    <input type="hidden" name="id" value={s.id} />
                    <button className="h-12 bg-duplicate px-5 font-plate text-section text-white">
                      Cerrar
                    </button>
                  </form>
                ) : s.state === "closed" ? (
                  <span className="text-label text-fg-tertiary">No se puede reabrir</span>
                ) : (
                  <form action={onAbrir}>
                    <input type="hidden" name="id" value={s.id} />
                    <button
                      disabled={hayAbierta}
                      className="h-12 bg-accent px-5 font-plate text-section text-fg-on-accent disabled:bg-[#B9B9CC] disabled:text-[#6F7288]"
                    >
                      {hayAbierta ? "Hay otra abierta" : "Abrir"}
                    </button>
                  </form>
                )}

                {borrable &&
                  (confirmando === s.id ? (
                    <span className="flex items-center gap-2">
                      <form action={onBorrar}>
                        <input type="hidden" name="id" value={s.id} />
                        <button className="h-12 border-2 border-duplicate px-4 text-label font-semibold text-duplicate">
                          Sí, borrar
                        </button>
                      </form>
                      <button
                        type="button"
                        onClick={() => setConfirmando(null)}
                        className="h-12 px-3 text-label font-semibold text-fg-tertiary"
                      >
                        Cancelar
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmando(s.id)}
                      className="h-12 px-4 text-label font-semibold text-fg-tertiary"
                    >
                      Borrar
                    </button>
                  ))}
              </div>
            </div>
          </li>
        );
      })}
      </ul>
    </div>
  );
}
