"use client";

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RedeemResponse, RosterEntry } from "@/lib/domain/types";

/**
 * Modo local del despachador.
 *
 * Al abrir la sesión, el teléfono descarga el padrón de elegibles
 * (`session_roster`, cuatro campos, queda en audit_log). Sin red, cada
 * canje se valida contra ese padrón y contra lo que este mismo teléfono
 * ya selló, y se guarda en una cola. Al volver la señal, la cola sube en
 * orden a `redeem_qr` con la hora original; si el servidor responde que
 * otro puesto ya había entregado, el canje queda marcado como conflicto
 * y no se pierde.
 */

export interface CanjeLocal {
  no: number;
  session_id: string;
  qr_token: string;
  name: string;
  detail: string;
  station: string | null;
  device_id: string | null;
  redeemed_at: string;
  attempts: number;
  last_attempt_at: string | null;
  estado: "pendiente" | "conflicto" | "sesion_cerrada";
  /** Qué dijo el servidor al subirlo, si no fue «habilitado». */
  respuesta?: RedeemResponse;
}

interface Sellado {
  clave: string;
  session_id: string;
  qr_token: string;
  name: string;
  detail: string;
  redeemed_at: string;
}

interface Esquema extends DBSchema {
  padron: { key: string; value: RosterEntry & { session_id: string } };
  cola: { key: number; value: CanjeLocal };
  sellados: { key: string; value: Sellado };
  meta: { key: string; value: unknown };
}

export interface EstadoPadron {
  session_id: string;
  descargado_en: string;
  total: number;
}

export interface ResumenCola {
  pendientes: number;
  conflictos: number;
  masAntiguo: string | null;
  ultimoIntento: string | null;
}

let db: Promise<IDBPDatabase<Esquema>> | null = null;

function abrir() {
  if (!db) {
    db = openDB<Esquema>("esmun-despacho", 1, {
      upgrade(d) {
        d.createObjectStore("padron", { keyPath: "qr_token" });
        d.createObjectStore("cola", { keyPath: "no" });
        d.createObjectStore("sellados", { keyPath: "clave" });
        d.createObjectStore("meta");
      },
    });
  }
  return db;
}

/* ── Padrón ──────────────────────────────────────────────────────────── */

export async function padronActual(): Promise<EstadoPadron | null> {
  const d = await abrir();
  return ((await d.get("meta", "padron")) as EstadoPadron | undefined) ?? null;
}

export async function descargarPadron(supabase: SupabaseClient, sessionId: string) {
  const { data, error } = await supabase.rpc("session_roster");
  if (error) throw error;

  const filas = (data ?? []) as RosterEntry[];
  const d = await abrir();
  const tx = d.transaction(["padron", "meta"], "readwrite");
  await tx.objectStore("padron").clear();
  for (const f of filas) {
    await tx.objectStore("padron").put({ ...f, session_id: sessionId });
  }
  const estado: EstadoPadron = {
    session_id: sessionId,
    descargado_en: new Date().toISOString(),
    total: filas.length,
  };
  await tx.objectStore("meta").put(estado, "padron");
  await tx.done;
  return estado;
}

export async function buscarEnPadron(sessionId: string, token: string) {
  const d = await abrir();
  const fila = await d.get("padron", token);
  return fila && fila.session_id === sessionId ? fila : null;
}

/** Se borra al cerrar la sesión o el turno: fuera de esa ventana, el
 *  teléfono no guarda datos de nadie. */
export async function limpiarPadron() {
  const d = await abrir();
  const tx = d.transaction(["padron", "sellados", "meta"], "readwrite");
  await tx.objectStore("padron").clear();
  await tx.objectStore("sellados").clear();
  await tx.objectStore("meta").delete("padron");
  await tx.done;
}

/* ── Sellados de este teléfono ───────────────────────────────────────── */

const claveSellado = (sessionId: string, token: string) => `${sessionId}:${token}`;

export async function registrarSellado(
  sessionId: string,
  token: string,
  datos: { name: string; detail: string; redeemed_at: string },
) {
  const d = await abrir();
  await d.put("sellados", {
    clave: claveSellado(sessionId, token),
    session_id: sessionId,
    qr_token: token,
    ...datos,
  });
}

export async function selladoLocal(sessionId: string, token: string) {
  const d = await abrir();
  return (await d.get("sellados", claveSellado(sessionId, token))) ?? null;
}

/* ── Cola ────────────────────────────────────────────────────────────── */

export async function encolar(
  canje: Omit<CanjeLocal, "no" | "attempts" | "last_attempt_at" | "estado">,
) {
  const d = await abrir();
  const tx = d.transaction(["cola", "meta"], "readwrite");
  const ultimo = ((await tx.objectStore("meta").get("contador")) as number | undefined) ?? 0;
  const no = ultimo + 1;
  await tx.objectStore("meta").put(no, "contador");
  const fila: CanjeLocal = { ...canje, no, attempts: 0, last_attempt_at: null, estado: "pendiente" };
  await tx.objectStore("cola").put(fila);
  await tx.done;
  return fila;
}

export async function todaLaCola(): Promise<CanjeLocal[]> {
  const d = await abrir();
  return (await d.getAll("cola")).sort((a, b) => a.no - b.no);
}

export async function resumenCola(): Promise<ResumenCola> {
  const filas = await todaLaCola();
  const pend = filas.filter((f) => f.estado === "pendiente");
  const intentos = filas.map((f) => f.last_attempt_at).filter(Boolean) as string[];
  return {
    pendientes: pend.length,
    conflictos: filas.length - pend.length,
    masAntiguo: pend[0]?.redeemed_at ?? null,
    ultimoIntento: intentos.length ? intentos.sort().at(-1)! : null,
  };
}

export async function contarPendientes() {
  return (await resumenCola()).pendientes;
}

/** Los conflictos ya quedaron registrados en el servidor como intento de
 *  duplicado; borrarlos del teléfono no pierde información. */
export async function descartarConflictos() {
  const d = await abrir();
  const tx = d.transaction("cola", "readwrite");
  for (const f of await tx.store.getAll()) {
    if (f.estado !== "pendiente") await tx.store.delete(f.no);
  }
  await tx.done;
}

/* ── Red ─────────────────────────────────────────────────────────────── */

/** supabase-js devuelve el fallo de red como un error más; se distingue
 *  porque no trae código de Postgres y el mensaje habla de fetch. */
export function esErrorDeRed(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  if (error.code && error.code !== "") return false;
  const m = (error.message ?? "").toLowerCase();
  return (
    m.includes("fetch") || m.includes("network") || m.includes("load failed") ||
    m.includes("abort") || m.includes("timeout") || m === ""
  );
}

const TIEMPO_MAX_MS = 8_000;

function senalDeTiempo() {
  try {
    return AbortSignal.timeout(TIEMPO_MAX_MS);
  } catch {
    const c = new AbortController();
    setTimeout(() => c.abort(), TIEMPO_MAX_MS);
    return c.signal;
  }
}

/** `redeem_qr` con tope de tiempo: una llamada colgada en un wifi malo
 *  no puede dejar la fila detenida. */
export async function canjearEnServidor(
  supabase: SupabaseClient,
  args: { p_token: string; p_station: string | null; p_device: string | null; p_redeemed_at?: string },
) {
  try {
    const { data, error } = await supabase.rpc("redeem_qr", args).abortSignal(senalDeTiempo());
    return { data: data as RedeemResponse | null, error };
  } catch (e) {
    return { data: null, error: { code: "", message: e instanceof Error ? e.message : "abort" } };
  }
}

export interface ResultadoSubida {
  subidos: number;
  quedan: number;
  /** false si se cortó por falta de red. */
  red: boolean;
}

/** Sube la cola en orden. Se detiene en el primer fallo de red y deja el
 *  resto para el siguiente intento. */
export async function subirCola(supabase: SupabaseClient): Promise<ResultadoSubida> {
  const d = await abrir();
  const pendientes = (await todaLaCola()).filter((f) => f.estado === "pendiente");
  let subidos = 0;

  for (const f of pendientes) {
    const { data, error } = await canjearEnServidor(supabase, {
      p_token: f.qr_token,
      p_station: f.station,
      p_device: f.device_id,
      p_redeemed_at: f.redeemed_at,
    });

    if (error) {
      await d.put("cola", {
        ...f,
        attempts: f.attempts + 1,
        last_attempt_at: new Date().toISOString(),
      });
      if (esErrorDeRed(error)) {
        return { subidos, quedan: pendientes.length - subidos, red: false };
      }
      continue; // un error que no es de red: se reintenta en la siguiente pasada
    }

    if (data?.status === "granted") {
      await d.delete("cola", f.no);
      subidos += 1;
    } else if (data?.status === "session_closed") {
      await d.put("cola", { ...f, estado: "sesion_cerrada", respuesta: data, last_attempt_at: new Date().toISOString() });
    } else if (data) {
      await d.put("cola", { ...f, estado: "conflicto", respuesta: data, last_attempt_at: new Date().toISOString() });
    }
  }

  const quedan = (await todaLaCola()).filter((f) => f.estado === "pendiente").length;
  return { subidos, quedan, red: true };
}

/* ── Contadores locales del turno ────────────────────────────────────── */

export type Rechazos = Record<string, number>;

export function leerRechazos(sessionId: string): Rechazos {
  try {
    return JSON.parse(localStorage.getItem(`esmun.rechazos.${sessionId}`) ?? "{}");
  } catch {
    return {};
  }
}

export function anotarRechazo(sessionId: string, status: string) {
  const r = leerRechazos(sessionId);
  r[status] = (r[status] ?? 0) + 1;
  try {
    localStorage.setItem(`esmun.rechazos.${sessionId}`, JSON.stringify(r));
  } catch { /* sin almacenamiento: el contador solo vive en memoria */ }
  return r;
}
