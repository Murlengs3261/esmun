"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { Button } from "@/components/ui/Button";
import {
  ensayarImportacion, confirmarImportacion,
  type FilaImportada, type Resumen,
} from "@/lib/acciones-importar";

/** Los campos del sistema y los encabezados que se aceptan para cada uno.
 *  La comparación ignora acentos, mayúsculas y guiones bajos. */
const CAMPOS = [
  { id: "nombre", etiqueta: "Nombre completo", obligatorio: true,
    alias: ["nombre", "nombre completo", "nombres", "participante", "full name", "full_name"] },
  { id: "rol", etiqueta: "Rol", obligatorio: true,
    alias: ["rol", "role", "tipo", "cargo general"] },
  { id: "foro", etiqueta: "Foro", obligatorio: false,
    alias: ["foro", "comite", "comision", "committee", "comite/foro"] },
  { id: "representacion", etiqueta: "Representa a", obligatorio: false,
    alias: ["representa a", "representacion", "pais", "country", "delegacion", "personaje", "representa"] },
  { id: "cargo", etiqueta: "Cargo (mesa)", obligatorio: false,
    alias: ["cargo", "position", "puesto", "cargo mesa"] },
  { id: "dieta", etiqueta: "Restricción alimentaria", obligatorio: false,
    alias: ["dieta", "alergia", "alergias", "restriccion", "restriccion alimentaria", "dietary notes"] },
  { id: "codigo", etiqueta: "Código de estudiante", obligatorio: false,
    alias: ["codigo", "code", "matricula", "carnet", "id", "codigo de estudiante", "external code"] },
] as const;

type CampoId = (typeof CAMPOS)[number]["id"];

const norm = (t: string) =>
  t.toLowerCase().trim()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[_\-.]+/g, " ").replace(/\s+/g, " ");

function autoMapear(encabezados: string[]): Record<CampoId, string> {
  const mapa = {} as Record<CampoId, string>;
  for (const campo of CAMPOS) {
    const hallado = encabezados.find((h) => campo.alias.includes(norm(h) as never));
    mapa[campo.id] = hallado ?? "";
  }
  return mapa;
}

const PLANTILLA =
  "nombre,rol,foro,representa a,cargo,dieta,codigo\n" +
  "María Fernanda López,Delegado,CSI,Francia,,ALERGIA AL MANÍ,E-001\n" +
  "Andrés Castillo,Mesa,ECOSOC,,Presidente,,E-002\n" +
  "Valentina Ortiz,Prensa,Foro Prensa,,,,E-003\n";

export function ImportadorCSV() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);

  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null);
  const [encabezados, setEncabezados] = useState<string[]>([]);
  const [crudas, setCrudas] = useState<Record<string, string>[]>([]);
  const [mapa, setMapa] = useState<Record<CampoId, string>>({} as Record<CampoId, string>);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importado, setImportado] = useState(false);
  const [pendiente, iniciar] = useTransition();

  function filas(): FilaImportada[] {
    return crudas.map((c) => {
      const f: FilaImportada = {};
      for (const campo of CAMPOS) {
        const col = mapa[campo.id];
        if (col) f[campo.id] = (c[col] ?? "").trim();
      }
      return f;
    });
  }

  function leer(archivo: File) {
    setError(null);
    setResumen(null);
    setImportado(false);
    setNombreArchivo(archivo.name);

    Papa.parse<Record<string, string>>(archivo, {
      header: true,
      skipEmptyLines: "greedy",
      complete: (r) => {
        const cabeceras = (r.meta.fields ?? []).filter(Boolean);
        if (cabeceras.length === 0) {
          setError("El archivo no tiene fila de encabezados.");
          return;
        }
        const datos = r.data.filter((f) => Object.values(f).some((v) => (v ?? "").trim()));
        if (datos.length === 0) {
          setError("El archivo tiene encabezados pero ninguna fila con datos.");
          return;
        }
        setEncabezados(cabeceras);
        setCrudas(datos);
        setMapa(autoMapear(cabeceras));
      },
      error: () => setError("No se pudo leer el archivo. ¿Es un CSV?"),
    });
  }

  function ensayar() {
    setError(null);
    iniciar(async () => {
      const r = await ensayarImportacion(filas());
      setError(r.error ?? null);
      setResumen(r.resumen ?? null);
    });
  }

  function confirmar() {
    setError(null);
    iniciar(async () => {
      const r = await confirmarImportacion(filas());
      if (r.error) {
        setError(r.error);
        return;
      }
      setResumen(r.resumen ?? null);
      setImportado(true);
      router.refresh();
    });
  }

  function descargarPlantilla() {
    const url = URL.createObjectURL(new Blob(["﻿" + PLANTILLA], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "plantilla-esmun.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const faltanObligatorios = CAMPOS.filter((c) => c.obligatorio && !mapa[c.id]);

  /* ── 1 · Elegir archivo ────────────────────────────────────────────── */
  if (!crudas.length) {
    return (
      <div className="flex flex-col gap-6">
        <div className="border border-dashed border-line-control p-8 text-center">
          <p className="text-body text-fg-secondary">
            Un CSV con una fila de encabezados. Da igual el orden de las
            columnas y cómo se llamen: en el siguiente paso las emparejas.
          </p>
          <input
            ref={input}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) leer(f);
            }}
          />
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button type="button" size="lg" onClick={() => input.current?.click()}>
              Elegir archivo
            </Button>
            <Button type="button" size="lg" variant="secondary" onClick={descargarPlantilla}>
              Descargar plantilla
            </Button>
          </div>
        </div>

        {error && (
          <p className="border-l-[3px] border-duplicate bg-surface p-4 text-sub text-duplicate">
            {error}
          </p>
        )}

        <div className="text-sub text-fg-tertiary">
          <p className="font-semibold text-fg-secondary">Cómo se rellena</p>
          <ul className="mt-2 flex flex-col gap-1">
            <li>· <b>Rol</b>: Delegado, Mesa, Staff, Prensa o Invitado.</li>
            <li>· <b>Foro</b>: el nombre completo o el corto. No importan acentos ni mayúsculas.</li>
            <li>· <b>Representa a</b>: el país o el personaje. Obligatorio para delegados.</li>
            <li>· <b>Código de estudiante</b>: opcional, pero con él puedes reimportar sin duplicar a nadie.</li>
          </ul>
        </div>
      </div>
    );
  }

  /* ── 4 · Importado ─────────────────────────────────────────────────── */
  if (importado && resumen) {
    return (
      <div className="border-2 border-granted bg-surface p-6">
        <p className="type-micro text-granted">Listo</p>
        <h2 className="font-plate mt-3 text-section">
          {resumen.creadas} {resumen.creadas === 1 ? "persona nueva" : "personas nuevas"}
          {resumen.actualizadas > 0 && ` · ${resumen.actualizadas} actualizadas`}
        </h2>
        <p className="mt-3 text-body text-fg-secondary">
          Cada una ya tiene su código QR generado.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button type="button" size="md" onClick={() => router.push("/admin/participantes")}>
            Ver el listado
          </Button>
          <Button
            type="button" size="md" variant="secondary"
            onClick={() => {
              setCrudas([]); setResumen(null); setImportado(false); setNombreArchivo(null);
            }}
          >
            Importar otro archivo
          </Button>
        </div>
      </div>
    );
  }

  /* ── 2 y 3 · Emparejar columnas y revisar ──────────────────────────── */
  return (
    <div className="flex flex-col gap-8">
      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-plate text-section">Empareja las columnas</h2>
          <p className="text-label text-fg-tertiary">
            {nombreArchivo} · {crudas.length} filas
          </p>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CAMPOS.map((campo) => (
            <div key={campo.id} className="flex flex-col gap-2">
              <label htmlFor={`m-${campo.id}`} className="type-micro text-fg-tertiary">
                {campo.etiqueta}
                {campo.obligatorio ? " · obligatorio" : ""}
              </label>
              <select
                id={`m-${campo.id}`}
                value={mapa[campo.id] ?? ""}
                onChange={(e) => {
                  setMapa({ ...mapa, [campo.id]: e.target.value });
                  setResumen(null);
                }}
                className={[
                  "h-12 bg-surface px-3 text-sub outline-none",
                  campo.obligatorio && !mapa[campo.id]
                    ? "border border-duplicate"
                    : "border border-line-control",
                ].join(" ")}
              >
                <option value="">— sin usar —</option>
                {encabezados.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button
            type="button" size="lg" onClick={ensayar}
            loading={pendiente && !resumen}
            disabled={faltanObligatorios.length > 0}
          >
            {faltanObligatorios.length
              ? `Falta emparejar ${faltanObligatorios.map((c) => c.etiqueta).join(" y ")}`
              : "Revisar"}
          </Button>
          <button
            type="button"
            onClick={() => { setCrudas([]); setResumen(null); }}
            className="text-label font-semibold text-fg-tertiary"
          >
            Elegir otro archivo
          </button>
        </div>
      </section>

      {error && (
        <p className="border-l-[3px] border-duplicate bg-surface p-4 text-sub text-duplicate">
          {error}
        </p>
      )}

      {resumen && (
        <section>
          <h2 className="font-plate text-section">Qué va a pasar</h2>

          <dl className="mt-4 grid gap-4 sm:grid-cols-3">
            <Dato etiqueta="Se crean" valor={resumen.creadas} />
            <Dato etiqueta="Se actualizan" valor={resumen.actualizadas} />
            <Dato
              etiqueta="Con error"
              valor={resumen.errores.length}
              tono={resumen.errores.length ? "malo" : undefined}
            />
          </dl>

          {resumen.errores.length > 0 && (
            <div className="mt-6">
              <p className="text-body text-duplicate">
                Corrige estas filas en el archivo y vuelve a subirlo. Mientras
                haya una sola con error, no se importa nada: prefiero eso a
                dejarte media lista cargada.
              </p>
              <ul className="mt-4 border border-line bg-surface">
                {resumen.errores.slice(0, 50).map((e, i) => (
                  <li key={i} className={`flex gap-4 px-4 py-3 ${i ? "border-t border-line" : ""}`}>
                    <span className="shrink-0 font-mono text-label text-fg-tertiary">
                      Fila {e.fila}
                    </span>
                    <span className="text-sub">{e.mensaje}</span>
                  </li>
                ))}
              </ul>
              {resumen.errores.length > 50 && (
                <p className="mt-2 text-label text-fg-tertiary">
                  y {resumen.errores.length - 50} más.
                </p>
              )}
            </div>
          )}

          {resumen.avisos.length > 0 && (
            <div className="mt-6">
              <p className="text-body text-fg-secondary">Avisos, no bloquean:</p>
              <ul className="mt-3 border border-line bg-surface">
                {resumen.avisos.slice(0, 20).map((a, i) => (
                  <li key={i} className={`flex gap-4 px-4 py-3 ${i ? "border-t border-line" : ""}`}>
                    <span className="shrink-0 font-mono text-label text-fg-tertiary">
                      Fila {a.fila}
                    </span>
                    <span className="text-sub text-fg-secondary">{a.mensaje}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {resumen.errores.length === 0 && (
            <Button
              type="button" size="xl" onClick={confirmar} loading={pendiente}
              className="mt-6 lg:px-10"
            >
              {pendiente
                ? "Importando…"
                : `Importar ${resumen.creadas + resumen.actualizadas} personas`}
            </Button>
          )}
        </section>
      )}
    </div>
  );
}

function Dato({
  etiqueta, valor, tono,
}: { etiqueta: string; valor: number; tono?: "malo" }) {
  return (
    <div
      className={[
        "border bg-surface p-5",
        tono === "malo" ? "border-duplicate" : "border-line",
      ].join(" ")}
    >
      <dt className="type-micro text-fg-tertiary">{etiqueta}</dt>
      <dd
        className="font-plate mt-1 text-title"
        style={tono === "malo" ? { color: "var(--state-duplicate)" } : undefined}
      >
        {valor}
      </dd>
    </div>
  );
}
