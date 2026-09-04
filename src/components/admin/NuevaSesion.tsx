"use client";

import { useActionState, useState } from "react";
import { crearSesion, type EstadoAlta } from "@/lib/actions";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Aviso } from "@/components/admin/Aviso";
import { ROLE_LABEL, type ParticipantRole } from "@/lib/domain/types";

const ROLES: ParticipantRole[] = ["mesa", "delegado", "staff", "prensa", "invitado"];
const TIPOS = [
  { v: "refrigerio", t: "Refrigerio" },
  { v: "almuerzo", t: "Almuerzo" },
  { v: "acreditacion", t: "Acreditación" },
  { v: "otro", t: "Otro" },
];

export function NuevaSesion() {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion, pendiente] = useActionState<EstadoAlta, FormData>(crearSesion, {});
  const [roles, setRoles] = useState<ParticipantRole[]>(["mesa", "delegado", "staff", "prensa"]);

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="h-12 bg-accent px-5 font-plate text-section text-fg-on-accent"
      >
        Nueva sesión
      </button>
    );
  }

  return (
    <form action={accion} className="w-full border border-line bg-surface p-5 lg:p-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-plate text-section">Nueva sesión</h2>
        <button type="button" onClick={() => setAbierto(false)}
                className="text-label font-semibold text-fg-tertiary">
          Cancelar
        </button>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Field label="Nombre" name="name" required autoComplete="off"
               placeholder="Día 1 · Refrigerio de la mañana"
               help="Se ve en el teléfono del escaneador: que se reconozca de un vistazo." />

        <div className="grid grid-cols-2 gap-5">
          <div className="flex flex-col gap-2">
            <label htmlFor="kind" className="type-micro text-fg-tertiary">Tipo</label>
            <select id="kind" name="kind"
                    className="h-14 border border-line-control bg-surface px-4 text-body outline-none">
              {TIPOS.map((t) => <option key={t.v} value={t.v}>{t.t}</option>)}
            </select>
          </div>
          <Field label="Día" name="day_number" type="number" min={1} max={9} placeholder="1" />
        </div>
      </div>

      <fieldset className="mt-6">
        <legend className="type-micro text-fg-tertiary">Quién puede canjear</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {ROLES.map((r) => {
            const activo = roles.includes(r);
            return (
              <label key={r}
                className={[
                  "flex h-12 cursor-pointer items-center px-4 text-label font-semibold",
                  activo ? "bg-surface-inverse text-fg-on-inverse"
                         : "border border-line-control text-fg-secondary",
                ].join(" ")}>
                <input type="checkbox" name="eligible_roles" value={r} checked={activo}
                       onChange={() => setRoles((p) => activo ? p.filter((x) => x !== r) : [...p, r])}
                       className="sr-only" />
                {ROLE_LABEL[r]}
              </label>
            );
          })}
        </div>
        <p className="mt-3 text-label text-fg-tertiary">
          Quien quede fuera y escanee su gafete verá «Rol sin derecho en esta sesión».
        </p>
      </fieldset>

      <div className="mt-6 flex flex-col gap-4">
        <Aviso estado={estado} />
        <Button type="submit" size="lg" loading={pendiente} className="lg:self-start lg:px-10">
          {pendiente ? "Creando…" : "Crear sesión"}
        </Button>
      </div>
    </form>
  );
}
