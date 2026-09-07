"use client";

import { useState } from "react";
import { notFound } from "next/navigation";
import { VerdictPanel } from "@/components/dispatch/VerdictPanel";
import { VistaPreviaQR } from "@/components/admin/VistaPreviaQR";
import Link from "next/link";
import type { ScanVerdict } from "@/lib/domain/types";

/**
 * Herramienta de revisión, no una pantalla del producto.
 * Existe solo en desarrollo: permite ver los cuatro veredictos sin tener
 * que montar sesión, participantes y gafetes cada vez que se toca el diseño.
 */

const AYER = new Date(Date.now() - 3 * 60_000).toISOString();

const CASOS: { id: string; etiqueta: string; nota: string; r: ScanVerdict }[] = [
  {
    id: "granted",
    etiqueta: "Habilitado",
    nota: "Verde · cuadrado · centrado · auto-avance 1,2 s",
    r: {
      status: "granted",
      name: "María Fernanda López",
      detail: "CSI · Francia",
      role: "delegado",
      diet: null,
      redeemed_at: new Date().toISOString(),
    },
  },
  {
    id: "diet",
    etiqueta: "Con alerta alimentaria",
    nota: "La alergia domina sobre el nombre · sin auto-avance",
    r: {
      status: "granted",
      name: "Sebastián Mejía",
      detail: "ONU Mujeres · Kenia",
      role: "delegado",
      diet: "ALERGIA AL MANÍ",
      redeemed_at: new Date().toISOString(),
    },
  },
  {
    id: "duplicate",
    etiqueta: "Ya entregado",
    nota: "Rojo · círculo · arriba-izquierda · bloqueo de 2 s",
    r: {
      status: "duplicate",
      name: "Diego Ramírez",
      detail: "SOCHUM 1 · Brasil",
      redeemed_at: AYER,
      station: "Puesto 2",
      by: "Ana Solís",
    },
  },
  {
    id: "unknown",
    etiqueta: "Código no reconocido",
    nota: "Ámbar · trama 45° · abajo-derecha",
    r: { status: "unknown_token" },
  },
  {
    id: "not_eligible",
    etiqueta: "Rol sin derecho",
    nota: "Muestra el nombre: hay que devolverle el gafete a alguien",
    r: { status: "not_eligible", name: "Valentina Ortiz", role: "prensa" },
  },
  {
    id: "closed",
    etiqueta: "Sesión cerrada",
    nota: "Mismo ámbar, distinto texto",
    r: { status: "session_closed", closed_at: AYER },
  },
  {
    id: "offline",
    etiqueta: "Habilitado sin red",
    nota: "Igual al verde, con «Guardado en el teléfono»",
    r: {
      status: "granted",
      name: "Lucía Paredes",
      detail: "PNUMA · Chile",
      diet: null,
      redeemed_at: new Date().toISOString(),
      offline: true,
    },
  },
  {
    id: "sin_red",
    etiqueta: "Sin señal ni lista",
    nota: "Índigo · no es un veredicto sobre la persona",
    r: { status: "sin_red" },
  },
  {
    id: "fallo",
    etiqueta: "Error que no es de red",
    nota: "Ámbar · muestra lo que dijo el servidor",
    r: { status: "fallo", message: "Sin sesión válida" },
  },
];

export default function VistaPrevia() {
  const [abierto, setAbierto] = useState<ScanVerdict | null>(null);
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="flex min-h-[100dvh] flex-col px-5">
      <div className="pt-safe" />

      <div className="mt-8 self-start border-2 border-accent px-4 py-3">
        <span className="font-plate text-section text-accent">ESMUN</span>
      </div>

      <h1 className="font-plate mt-6 text-title">Revisión de veredictos</h1>
      <p className="mt-2 text-sub text-fg-secondary">
        Solo en desarrollo. Toca uno para verlo a pantalla completa, como lo ve
        el despachador.
      </p>

      <ul className="mt-8 flex flex-col gap-3 pb-12">
        {CASOS.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => setAbierto(c.r)}
              className="flex w-full flex-col gap-1 border border-line-control px-5 py-4 text-left"
            >
              <span className="font-plate text-section">{c.etiqueta}</span>
              <span className="text-label text-fg-tertiary">{c.nota}</span>
            </button>
          </li>
        ))}
      </ul>

      <h2 className="font-plate text-title">Cola pendiente</h2>
      <p className="mt-2 text-sub text-fg-secondary">
        La pantalla de la cola con datos de prueba en este navegador.
      </p>
      <Link
        href="/vista-previa/cola"
        className="mt-4 mb-10 flex h-14 items-center justify-center border-2 border-line-control font-plate text-section"
      >
        Abrir la prueba de cola
      </Link>

      <h2 className="font-plate text-title">Imagen del QR</h2>
      <p className="mt-2 text-sub text-fg-secondary">
        Lo que se descarga: el código con el nombre y los datos en letra
        chica debajo.
      </p>
      <VistaPreviaQR />

      <div className="pb-safe" />

      {abierto && <VerdictPanel result={abierto} onContinue={() => setAbierto(null)} />}
    </main>
  );
}
