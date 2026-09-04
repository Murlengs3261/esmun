"use client";

import { useActionState, useState } from "react";
import { crearUsuario, type ResultadoUsuario } from "@/lib/acciones-usuarios";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { CampoContrasena } from "@/components/admin/CampoContrasena";
import { Credencial } from "@/components/admin/Credencial";

export function NuevoUsuario() {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion, pendiente] = useActionState<ResultadoUsuario, FormData>(
    crearUsuario,
    {},
  );

  if (estado.credencial) {
    return (
      <Credencial
        credencial={estado.credencial}
        onCerrar={() => setAbierto(false)}
      />
    );
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="h-12 shrink-0 bg-accent px-5 font-plate text-section text-fg-on-accent"
      >
        Nueva cuenta
      </button>
    );
  }

  return (
    <form action={accion} className="w-full border border-line bg-surface p-5 lg:p-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-plate text-section">Nueva cuenta</h2>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="text-label font-semibold text-fg-tertiary"
        >
          Cancelar
        </button>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Field
          label="Nombre y apellido"
          name="display_name"
          required
          autoComplete="off"
          placeholder="Ana Solís"
          help="Es lo que aparece en el acta: «entregado por Ana Solís»."
        />
        <Field
          label="Correo"
          name="email"
          type="email"
          required
          autoComplete="off"
          autoCapitalize="none"
          placeholder="ana@eagles.edu"
        />
      </div>

      <fieldset className="mt-6">
        <legend className="type-micro text-fg-tertiary">Rol</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          <label className="flex h-12 cursor-pointer items-center gap-3 border border-line-control px-4 text-label font-semibold has-[:checked]:border-transparent has-[:checked]:bg-surface-inverse has-[:checked]:text-fg-on-inverse">
            <input type="radio" name="role" value="dispatcher" defaultChecked className="sr-only" />
            Escaneador
          </label>
          <label className="flex h-12 cursor-pointer items-center gap-3 border border-line-control px-4 text-label font-semibold has-[:checked]:border-transparent has-[:checked]:bg-surface-inverse has-[:checked]:text-fg-on-inverse">
            <input type="radio" name="role" value="admin" className="sr-only" />
            Administrador
          </label>
        </div>
        <p className="mt-3 max-w-[62ch] text-label text-fg-tertiary">
          Un escaneador solo escanea: no puede ver la lista de participantes,
          ni abrir sesiones, ni anular entregas.
        </p>
      </fieldset>

      <div className="mt-6 max-w-xl">
        <CampoContrasena
          etiqueta="Contraseña"
          ayuda="La eliges tú y se la dictas a esa persona. Puedes cambiarla después cuando quieras, sin necesidad de saber la anterior."
        />
      </div>

      {estado.error ? (
        <p className="mt-6 border-l-[3px] border-duplicate bg-bg-sunken p-4 text-sub text-duplicate">
          {estado.error}
        </p>
      ) : null}

      <Button type="submit" size="lg" loading={pendiente} className="mt-6 lg:px-10">
        {pendiente ? "Creando…" : "Crear cuenta"}
      </Button>
    </form>
  );
}
