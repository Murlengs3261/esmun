"use client";

import { useState } from "react";
import { notFound } from "next/navigation";
import { ColaPendiente } from "@/components/dispatch/ColaPendiente";
import {
  buscarEnPadron, descartarConflictos, encolar, padronActual, registrarSellado,
  selladoLocal, todaLaCola, limpiarPadron,
} from "@/lib/offline";

/**
 * Herramienta de revisión, solo en desarrollo: llena la cola local con
 * canjes de prueba para ver la pantalla sin apagar el wifi.
 */
export default function PruebaCola() {
  const [nota, setNota] = useState("");
  if (process.env.NODE_ENV === "production") notFound();

  async function sembrar() {
    const sid = "sesion-de-prueba";
    for (let i = 0; i < 7; i++) {
      const token = `esm-prueba-${i}`;
      if (await selladoLocal(sid, token)) continue;
      const cuando = new Date(Date.now() - (7 - i) * 45_000).toISOString();
      await encolar({
        session_id: sid, qr_token: token, name: `Persona ${i + 1}`,
        detail: "Prueba · Foro", station: "Patio", device_id: "dev1", redeemed_at: cuando,
      });
      await registrarSellado(sid, token, { name: `Persona ${i + 1}`, detail: "Prueba", redeemed_at: cuando });
    }
    localStorage.setItem("esmun.sinSenalDesde", new Date(Date.now() - 6 * 60_000).toISOString());
    const cola = await todaLaCola();
    const padron = await padronActual();
    const repetido = await selladoLocal(sid, "esm-prueba-0");
    const enPadron = await buscarEnPadron(sid, "esm-prueba-0");
    setNota(
      `cola: ${cola.length} · padrón: ${padron ? padron.total : "ninguno"} · ` +
      `duplicado local detectado: ${repetido ? "sí" : "no"} · en padrón: ${enPadron ? "sí" : "no"}`,
    );
  }

  async function vaciar() {
    await descartarConflictos();
    const { openDB } = await import("idb");
    const d = await openDB("esmun-despacho", 1);
    await d.clear("cola");
    await limpiarPadron();
    localStorage.removeItem("esmun.sinSenalDesde");
    setNota("cola y padrón vacíos");
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3">
        <button type="button" onClick={sembrar} className="border-2 border-accent px-3 py-2 text-label font-semibold text-accent">
          Sembrar 7 canjes
        </button>
        <button type="button" onClick={vaciar} className="px-3 py-2 text-label font-semibold text-fg-tertiary">
          Vaciar
        </button>
        {nota && <span className="type-micro text-fg-tertiary">{nota}</span>}
      </div>
      <ColaPendiente />
    </div>
  );
}
