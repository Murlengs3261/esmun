"use client";

import { useEffect, useState } from "react";
import { componerQRVista, PROPORCION, type DatosQR } from "@/lib/qr";

/** Solo para revisar el diseño de la imagen. Incluye el caso feo a
 *  propósito: si aguanta ese nombre y ese país, aguanta los 350. */
const CASOS: DatosQR[] = [
  {
    token: "esm-6c24dfj0a1b2c3d4e5f60718293a4b5c",
    nombre: "Mauricio Lengstorff",
    detalle: "Delegado · ONUDC 1 Jr · Bolivia",
    codigo: "6c24-DFJ",
  },
  {
    token: "esm-aa11bb22cc33dd44ee55ff6677889900",
    nombre: "María Fernanda Villalobos-Echeverría",
    detalle: "Delegado · C. de Seguridad · República Democrática del Congo",
    codigo: "E-118",
  },
  {
    token: "esm-99887766554433221100ffeeddccbbaa",
    nombre: "Ana Solís",
    detalle: "Mesa · ECOSOC · Presidente",
    codigo: null,
  },
];

export function VistaPreviaQR() {
  const [urls, setUrls] = useState<string[]>([]);

  useEffect(() => {
    let vivo = true;
    const creadas: string[] = [];
    (async () => {
      for (const c of CASOS) {
        const u = await componerQRVista(c);
        creadas.push(u);
      }
      if (vivo) setUrls(creadas);
    })();
    return () => {
      vivo = false;
      creadas.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  return (
    <ul className="mt-6 flex flex-col gap-4 pb-8">
      {CASOS.map((c, i) => (
        <li key={c.token} className="bg-white">
          {urls[i] ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={urls[i]} alt={c.nombre} className="w-full" />
          ) : (
            <div className="w-full animate-pulse bg-[#ECECF4]" style={{ aspectRatio: PROPORCION }} />
          )}
        </li>
      ))}
    </ul>
  );
}
