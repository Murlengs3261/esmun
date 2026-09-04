"use client";

import { useActionState } from "react";
import { guardarEvento, type EstadoAlta } from "@/lib/actions";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Aviso } from "@/components/admin/Aviso";

export function DatosEvento({
  nombre, inicio, fin,
}: { nombre: string; inicio: string; fin: string }) {
  const [estado, accion, pendiente] = useActionState<EstadoAlta, FormData>(guardarEvento, {});

  return (
    <form action={accion} className="flex flex-col gap-5">
      <Field label="Nombre del evento" name="name" defaultValue={nombre} required />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Empieza" name="starts_on" type="date" defaultValue={inicio} required />
        <Field label="Termina" name="ends_on" type="date" defaultValue={fin} required />
      </div>
      <Aviso estado={estado} />
      <Button type="submit" size="lg" loading={pendiente} className="sm:self-start sm:px-10">
        {pendiente ? "Guardando…" : "Guardar"}
      </Button>
    </form>
  );
}
