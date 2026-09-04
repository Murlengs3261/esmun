"use client";

import { useActionState, useState } from "react";
import {
  cambiarContrasena, cambiarEstadoUsuario, cambiarRolUsuario,
  type ResultadoUsuario,
} from "@/lib/acciones-usuarios";
import { Credencial } from "@/components/admin/Credencial";
import { CampoContrasena } from "@/components/admin/CampoContrasena";
import { APP_ROLE_LABEL } from "@/lib/domain/types";

export interface Usuario {
  id: string;
  display_name: string;
  email: string | null;
  role: "admin" | "dispatcher";
  is_active: boolean;
  entregas: number;
}

export function FilaUsuario({ u, esYo }: { u: Usuario; esYo: boolean }) {
  const [estado, cambiar, pendiente] = useActionState<ResultadoUsuario, FormData>(
    cambiarContrasena,
    {},
  );
  // Un clic suelto aquí invalida la contraseña al instante y no hay vuelta
  // atrás: la vieja ya no sirve. Sobre la propia cuenta, además, te deja
  // fuera. Por eso va en dos pasos.
  const [confirmando, setConfirmando] = useState(false);

  if (estado.credencial) {
    return (
      <li className="border border-line bg-surface p-1">
        <Credencial credencial={estado.credencial} onCerrar={() => location.reload()} />
      </li>
    );
  }

  return (
    <li className="border border-line bg-surface">
      <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:gap-6">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-body font-semibold">{u.display_name}</h2>
            <span
              className={[
                "type-micro px-2 py-1",
                u.role === "admin"
                  ? "bg-surface-inverse text-fg-on-inverse"
                  : "border border-line text-fg-tertiary",
              ].join(" ")}
            >
              {APP_ROLE_LABEL[u.role]}
            </span>
            {!u.is_active && (
              <span className="type-micro bg-duplicate px-2 py-1 text-white">Dado de baja</span>
            )}
            {esYo && <span className="type-micro text-accent">Tú</span>}
          </div>
          <p className="mt-1 break-all font-mono text-label text-fg-tertiary">{u.email}</p>
          {u.entregas > 0 && (
            <p className="mt-1 text-label text-fg-tertiary">
              {u.entregas} entregas a su nombre
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!confirmando && (
            <button
              type="button"
              onClick={() => setConfirmando(true)}
              className="h-12 border-2 border-line-control px-4 text-label font-semibold text-fg-secondary"
            >
              Cambiar contraseña
            </button>
          )}

          {!esYo && (
            <>
              <form action={cambiarRolUsuario}>
                <input type="hidden" name="id" value={u.id} />
                <input
                  type="hidden" name="role"
                  value={u.role === "admin" ? "dispatcher" : "admin"}
                />
                <button className="h-12 px-4 text-label font-semibold text-fg-tertiary">
                  {u.role === "admin" ? "Pasar a escaneador" : "Hacer administrador"}
                </button>
              </form>

              <form action={cambiarEstadoUsuario}>
                <input type="hidden" name="id" value={u.id} />
                <input type="hidden" name="activar" value={u.is_active ? "0" : "1"} />
                <button
                  className={[
                    "h-12 px-4 text-label font-semibold",
                    u.is_active ? "text-duplicate" : "text-granted",
                  ].join(" ")}
                >
                  {u.is_active ? "Dar de baja" : "Reactivar"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      {confirmando && (
        <form action={cambiar} className="border-t border-line p-5">
          <input type="hidden" name="id" value={u.id} />
          <div className="max-w-xl">
            <CampoContrasena
              autoFocus
              etiqueta={`Contraseña nueva para ${u.display_name}`}
              ayuda={
                esYo
                  ? "Es tu propia cuenta: al cambiarla tendrás que volver a entrar con la nueva."
                  : "No hace falta saber la anterior. La vieja deja de servir en cuanto guardes."
              }
            />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              disabled={pendiente}
              className="h-12 bg-accent px-5 font-plate text-section text-fg-on-accent disabled:bg-[#B9B9CC] disabled:text-[#6F7288]"
            >
              {pendiente ? "Guardando…" : "Guardar"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              className="h-12 px-3 text-label font-semibold text-fg-tertiary"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {estado.error && (
        <p className="border-t border-line px-5 py-3 text-sub text-duplicate">{estado.error}</p>
      )}
    </li>
  );
}
