"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  componerQR, componerQRVista, nombreArchivo, descargar, PROPORCION,
  type DatosQR,
} from "@/lib/qr";
import { ROLE_LABEL, type ParticipantRole } from "@/lib/domain/types";

export interface PersonaQR {
  id: string;
  full_name: string;
  role: ParticipantRole;
  representation: string | null;
  position: string | null;
  dietary_notes: string | null;
  external_code: string | null;
  qr_token: string;
  foro: string | null;
  foro_corto: string | null;
}

const POR_TANDA = 40;

const norm = (t: string) =>
  t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Lo que va impreso debajo del código. La alerta alimentaria queda
 *  fuera a propósito: eso lo ve el escaneador en su pantalla, no tiene
 *  por qué ir escrito en un papel que pasa por muchas manos. */
function datosDe(p: PersonaQR): DatosQR {
  return {
    token: p.qr_token,
    nombre: p.full_name,
    detalle: [ROLE_LABEL[p.role], p.foro_corto, p.representation ?? p.position]
      .filter(Boolean)
      .join(" · "),
    codigo: p.external_code,
  };
}

export function PanelQR({
  personas,
  foros,
}: {
  personas: PersonaQR[];
  foros: { id: string; name: string; short_name: string }[];
}) {
  const [busqueda, setBusqueda] = useState("");
  const [foro, setForo] = useState("");
  const [rol, setRol] = useState<ParticipantRole | "">("");
  // El número de tarjetas visibles se guarda junto a la firma de los
  // filtros: si la firma cambia, vuelve solo a la primera tanda. Sin
  // efecto, que dispararía un render en cascada.
  const [tanda, setTanda] = useState({ firma: "", visibles: POR_TANDA });
  const [vistas, setVistas] = useState<Record<string, string>>({});
  const [empaquetando, setEmpaquetando] = useState<number | null>(null);
  const urls = useRef<string[]>([]);

  // Cada vista previa es un object URL; sin esto se acumulan en memoria.
  useEffect(() => {
    const creadas = urls.current;
    return () => creadas.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  const filtradas = useMemo(() => {
    const q = norm(busqueda.trim());
    return personas.filter((p) => {
      if (foro && p.foro !== foro) return false;
      if (rol && p.role !== rol) return false;
      if (!q) return true;
      return (
        norm(p.full_name).includes(q) ||
        norm(p.representation ?? "").includes(q) ||
        norm(p.external_code ?? "").includes(q)
      );
    });
  }, [personas, busqueda, foro, rol]);

  const firma = `${busqueda}|${foro}|${rol}`;
  const visibles = tanda.firma === firma ? tanda.visibles : POR_TANDA;

  // Se compone solo lo que está en pantalla, y queda cacheado: volver a
  // un filtro anterior no lo vuelve a dibujar.
  useEffect(() => {
    let vivo = true;
    const pendientes = filtradas.slice(0, visibles).filter((p) => !vistas[p.id]);
    if (pendientes.length === 0) return;

    (async () => {
      const nuevas: Record<string, string> = {};
      for (const p of pendientes) {
        const url = await componerQRVista(datosDe(p));
        urls.current.push(url);
        nuevas[p.id] = url;
      }
      if (vivo) setVistas((prev) => ({ ...prev, ...nuevas }));
    })();

    return () => { vivo = false; };
  }, [filtradas, visibles, vistas]);

  async function descargarUna(p: PersonaQR) {
    const blob = await componerQR(datosDe(p));
    descargar(blob, nombreArchivo([p.full_name, p.foro, p.representation ?? p.position]));
  }

  async function descargarTodas() {
    setEmpaquetando(0);
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();

    for (let i = 0; i < filtradas.length; i++) {
      const p = filtradas[i];
      const blob = await componerQR(datosDe(p));
      // Una carpeta por foro: 350 archivos sueltos no los ordena nadie.
      const carpeta = (p.foro ?? "Sin foro").replace(/[/\\:*?"<>|]/g, "-");
      zip.folder(carpeta)!
         .file(nombreArchivo([p.full_name, p.representation ?? p.position]), blob);
      setEmpaquetando(i + 1);
    }

    const salida = await zip.generateAsync({ type: "blob" });
    descargar(salida, `QR ESMUN - ${filtradas.length} personas.zip`);
    setEmpaquetando(null);
  }

  const hayFiltro = Boolean(busqueda || foro || rol);

  return (
    <div className="flex flex-col gap-8">
      {/* ── Filtros ──────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, representación o código"
            className="h-12 border border-line-control bg-surface px-4 text-body outline-none focus:border-b-2 focus:border-b-accent"
          />
          <select
            value={foro}
            onChange={(e) => setForo(e.target.value)}
            aria-label="Filtrar por foro"
            className="h-12 border border-line-control bg-surface px-3 text-sub outline-none"
          >
            <option value="">Todos los foros</option>
            {foros.map((f) => (
              <option key={f.id} value={f.name}>{f.name}</option>
            ))}
          </select>
          <select
            value={rol}
            onChange={(e) => setRol(e.target.value as ParticipantRole | "")}
            aria-label="Filtrar por rol"
            className="h-12 border border-line-control bg-surface px-3 text-sub outline-none"
          >
            <option value="">Todos los roles</option>
            {(Object.keys(ROLE_LABEL) as ParticipantRole[]).map((r) => (
              <option key={r} value={r}>{ROLE_LABEL[r]}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <p className="text-sub text-fg-secondary">
            <b className="text-fg">{filtradas.length}</b>
            {filtradas.length === 1 ? " persona" : " personas"}
            {hayFiltro ? ` de ${personas.length}` : ""}
          </p>

          {hayFiltro && (
            <button
              type="button"
              onClick={() => { setBusqueda(""); setForo(""); setRol(""); }}
              className="text-label font-semibold text-accent"
            >
              Quitar filtros
            </button>
          )}

          <div className="ml-auto">
            <Button
              type="button"
              size="md"
              onClick={descargarTodas}
              disabled={filtradas.length === 0 || empaquetando !== null}
              loading={empaquetando !== null}
            >
              {empaquetando !== null
                ? `Generando ${empaquetando} de ${filtradas.length}…`
                : `Descargar ${filtradas.length} en ZIP`}
            </Button>
          </div>
        </div>

        <p className="max-w-[70ch] text-label text-fg-tertiary">
          Lo que ves en cada tarjeta es exactamente el PNG que se descarga:
          el código con el nombre y los datos en letra chica debajo. La
          restricción alimentaria no va impresa a propósito — esa la ve el
          escaneador en su pantalla al leer el código.
        </p>
      </section>

      {/* ── Rejilla ──────────────────────────────────────────────────── */}
      {filtradas.length === 0 ? (
        <p className="border border-dashed border-line-control p-6 text-body text-fg-tertiary">
          {personas.length === 0
            ? "Todavía no hay nadie registrado. Cada persona recibe su código en cuanto la das de alta."
            : "Ningún resultado con esos filtros."}
        </p>
      ) : (
        <>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtradas.slice(0, visibles).map((p) => (
              <li key={p.id} className="flex flex-col bg-surface">
                <div className="bg-white">
                  {vistas[p.id] ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={vistas[p.id]}
                      alt={`Código QR de ${p.full_name}, ${datosDe(p).detalle}`}
                      className="w-full"
                    />
                  ) : (
                    <div className="w-full animate-pulse bg-[#ECECF4]" style={{ aspectRatio: PROPORCION }} />
                  )}
                </div>

                {p.dietary_notes && (
                  <p className="type-micro border border-t-0 border-line bg-invalid px-4 py-2 text-invalid-ink">
                    {p.dietary_notes} · no va impreso
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => descargarUna(p)}
                  className="h-12 border border-t-0 border-line text-label font-semibold text-accent"
                >
                  Descargar PNG
                </button>
              </li>
            ))}
          </ul>

          {visibles < filtradas.length && (
            <Button
              type="button"
              size="lg"
              variant="secondary"
              onClick={() => setTanda({ firma, visibles: visibles + POR_TANDA })}
              className="self-center px-10"
            >
              Mostrar {Math.min(POR_TANDA, filtradas.length - visibles)} más
            </Button>
          )}
        </>
      )}
    </div>
  );
}
