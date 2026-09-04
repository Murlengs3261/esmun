"use client";

import { useActionState, useState } from "react";
import { eliminarParticipante, type EstadoAlta } from "@/lib/actions";
import { ROLE_LABEL, type ParticipantRole } from "@/lib/domain/types";

export interface Participante {
  id: string;
  full_name: string;
  role: ParticipantRole;
  representation: string | null;
  position: string | null;
  dietary_notes: string | null;
  qr_token: string | null;
  forums: { name: string; short_name: string } | null;
}

export function FilaParticipante({ p }: { p: Participante }) {
  const [estado, eliminar, pendiente] = useActionState<EstadoAlta, FormData>(
    eliminarParticipante,
    {},
  );
  // Borrar a alguien deja su código sin efecto en el acto. Va en dos
  // pasos para que un toque en el celular no saque a nadie del padrón.
  const [confirmando, setConfirmando] = useState(false);

  const detalle = [ROLE_LABEL[p.role], p.forums?.short_name, p.representation ?? p.position]
    .filter(Boolean)
    .join(" · ");

  return (
    <li>
      <div className="flex items-center justify-between gap-4 px-4 py-3 lg:py-2">
        <div className="min-w-0">
          <p className="truncate text-body font-semibold">{p.full_name}</p>
          <p className="truncate text-label text-fg-tertiary">{detalle}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {p.dietary_notes && (
            <span className="type-micro hidden bg-invalid px-2 py-1 text-invalid-ink sm:inline">
              {p.dietary_notes}
            </span>
          )}
          <span className="type-micro hidden border border-line px-2 py-1 text-fg-tertiary sm:inline">
            {p.qr_token ? "Gafete listo" : "Sin gafete"}
          </span>
          {!confirmando && (
            <button
              type="button"
              onClick={() => setConfirmando(true)}
              aria-label={`Eliminar a ${p.full_name}`}
              className="h-10 px-3 text-label font-semibold text-duplicate"
            >
              Eliminar
            </button>
          )}
        </div>
      </div>

      {confirmando && (
        <form
          action={eliminar}
          className="flex flex-wrap items-center gap-3 border-t border-line bg-surface px-4 py-3"
        >
          <input type="hidden" name="id" value={p.id} />
          <p className="min-w-0 flex-1 text-sub text-fg-secondary">
            ¿Eliminar a <b className="text-fg">{p.full_name}</b>? Su código deja de
            servir en el acto. Si ya recibió comida, sus entregas se conservan en el acta.
          </p>
          <div className="flex items-center gap-2">
            <button
              disabled={pendiente}
              className="h-10 bg-duplicate px-4 text-label font-semibold text-white disabled:bg-[#B9B9CC] disabled:text-[#6F7288]"
            >
              {pendiente ? "Eliminando…" : "Sí, eliminar"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              disabled={pendiente}
              className="h-10 px-3 text-label font-semibold text-fg-tertiary"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {estado.error && (
        <p className="border-t border-line px-4 py-2 text-sub text-duplicate">{estado.error}</p>
      )}
    </li>
  );
}
