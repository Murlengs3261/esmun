"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface FilaImportada {
  nombre?: string;
  rol?: string;
  foro?: string;
  representacion?: string;
  cargo?: string;
  dieta?: string;
  codigo?: string;
}

export interface Incidencia {
  fila: number;
  campo: string;
  mensaje: string;
}

export interface Resumen {
  total: number;
  creadas: number;
  actualizadas: number;
  errores: Incidencia[];
  avisos: Incidencia[];
  ensayo: boolean;
}

export interface EstadoImportacion {
  resumen?: Resumen;
  error?: string;
}

/** El ensayo y la importación real llaman a la MISMA función de Postgres.
 *  La vista previa no es una simulación del cliente: es el resultado. */
async function llamar(filas: FilaImportada[], ensayo: boolean): Promise<EstadoImportacion> {
  if (filas.length === 0) return { error: "El archivo no tiene ninguna fila." };
  if (filas.length > 2000) return { error: "Más de 2000 filas de una vez. Pártelo en dos." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("importar_participantes", {
    p_filas: filas,
    p_ensayo: ensayo,
  });

  if (error) return { error: error.message };
  if (!ensayo) revalidatePath("/admin/participantes");
  return { resumen: data as Resumen };
}

export async function ensayarImportacion(filas: FilaImportada[]) {
  return llamar(filas, true);
}

export async function confirmarImportacion(filas: FilaImportada[]) {
  return llamar(filas, false);
}
