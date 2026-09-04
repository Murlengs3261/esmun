"use client";

import { useActionState, useState } from "react";
import { crearParticipante, type EstadoAlta } from "@/lib/actions";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { ROLE_LABEL, type ParticipantRole } from "@/lib/domain/types";

const ROLES: ParticipantRole[] = ["delegado", "mesa", "staff", "prensa", "invitado"];

// Vocabulario corto para que las alertas del escáner sean legibles de un
// vistazo. El campo sigue admitiendo texto libre.
const DIETAS = ["SIN GLUTEN", "ALERGIA AL MANÍ", "VEGETARIANO", "SIN LACTOSA"];

export function FormularioAlta({ foros }: { foros: { id: string; name: string }[] }) {
  const [estado, accion, pendiente] = useActionState<EstadoAlta, FormData>(
    crearParticipante, {},
  );
  const [rol, setRol] = useState<ParticipantRole>("delegado");
  const [dieta, setDieta] = useState("");

  const necesitaForo = rol === "delegado" || rol === "mesa";

  return (
    <form action={accion} className="mt-8 flex flex-col gap-6 pb-16">
      <Field label="Nombre completo" name="full_name" required autoComplete="off"
             placeholder="María Fernanda López" />

      <div className="flex flex-col gap-2">
        <span className="type-micro text-fg-tertiary">Rol</span>
        <div className="flex flex-wrap gap-2">
          {ROLES.map((r) => (
            <button
              key={r} type="button" onClick={() => setRol(r)} aria-pressed={rol === r}
              className={[
                "h-12 px-4 text-label font-semibold",
                rol === r
                  ? "bg-surface-inverse text-fg-on-inverse"
                  : "border border-line-control text-fg-secondary",
              ].join(" ")}
            >
              {ROLE_LABEL[r]}
            </button>
          ))}
        </div>
        <input type="hidden" name="role" value={rol} />
      </div>

      {necesitaForo && (
        <div className="flex flex-col gap-2">
          <label htmlFor="foro" className="type-micro text-fg-tertiary">Foro</label>
          <select
            id="foro" name="forum_id" required
            className="h-14 border border-line-control bg-surface px-4 text-body outline-none"
          >
            <option value="">Elige el foro…</option>
            {foros.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
      )}

      {rol === "delegado" && (
        <Field
          label="Representa a" name="representation" required autoComplete="off"
          placeholder="Francia · Simón Bolívar"
          help="País o personaje, como se escriba en el gafete. Todavía no hay catálogo: se escribe a mano."
        />
      )}

      {rol === "mesa" && (
        <Field label="Cargo" name="position" placeholder="Presidente · Moderador" autoComplete="off" />
      )}

      <div className="flex flex-col gap-2">
        <Field
          label="Restricción alimentaria" name="dietary_notes" autoComplete="off"
          value={dieta} onChange={(e) => setDieta(e.target.value)}
          help="Aparece en rojo en el teléfono del escaneador, justo antes de entregar."
        />
        <div className="flex flex-wrap gap-2">
          {DIETAS.map((d) => (
            <button
              key={d} type="button" onClick={() => setDieta(dieta === d ? "" : d)}
              className={[
                "h-8 px-3 text-label",
                dieta === d ? "bg-surface-inverse text-fg-on-inverse"
                            : "border border-dashed border-line-control text-fg-tertiary",
              ].join(" ")}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <Field label="Código de estudiante (opcional)" name="external_code" autoComplete="off"
             help="Si lo tienes, el importador CSV lo usa como clave y los homónimos dejan de ser un problema." />

      {estado.error && (
        <p className="border-l-[3px] border-duplicate bg-surface p-4 text-sub text-duplicate">
          {estado.error}
        </p>
      )}
      {estado.ok && (
        <p className="border-l-[3px] border-granted bg-surface p-4 text-sub text-granted">
          {estado.ok}
        </p>
      )}

      <Button type="submit" size="xl" fullWidth loading={pendiente}>
        {pendiente ? "Guardando…" : "Registrar"}
      </Button>
    </form>
  );
}
