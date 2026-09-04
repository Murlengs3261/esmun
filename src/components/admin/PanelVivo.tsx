"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ParticipantRole } from "@/lib/domain/types";
import { useReloj } from "@/lib/hooks";

interface Sesion {
  id: string;
  name: string;
  day_number: number | null;
  opened_at: string | null;
  eligible_roles: ParticipantRole[];
}

interface Fila {
  id: string;
  nombre: string;
  detalle: string;
  hora: string;
  quien: string;
  puesto: string | null;
  nueva: boolean;
}

/** Se suscribe a redemptions por Realtime: cada canje aparece sin recargar.
 *  La política RLS aplica igual aquí — solo un admin recibe todo. */
export function PanelVivo({ sesion, elegibles }: { sesion: Sesion; elegibles: number }) {
  const [filas, setFilas] = useState<Fila[]>([]);
  const [entregados, setEntregados] = useState(0);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let vivo = true;

    async function traer() {
      const { data } = await supabase
        .from("redemptions")
        .select(
          "id, redeemed_at, station_label, participants(full_name, role, position, representation, forums(name, short_name)), profiles!redemptions_dispatched_by_fkey(display_name)",
        )
        .eq("session_id", sesion.id)
        .is("voided_at", null)
        .order("redeemed_at", { ascending: false })
        .limit(50);

      if (!vivo) return;

      type Cruda = {
        id: string;
        redeemed_at: string;
        station_label: string | null;
        participants: {
          full_name: string; role: string; position: string | null;
          representation: string | null; forums: { short_name: string } | null;
        } | null;
        profiles: { display_name: string } | null;
      };

      const mapeadas = ((data ?? []) as unknown as Cruda[]).map((r) => ({
        id: r.id,
        nombre: r.participants?.full_name ?? "—",
        detalle: [r.participants?.forums?.short_name,
                  r.participants?.representation ?? r.participants?.position]
                 .filter(Boolean).join(" · "),
        hora: new Date(r.redeemed_at).toLocaleTimeString("es", { hour12: false }),
        quien: r.profiles?.display_name ?? "—",
        puesto: r.station_label,
        nueva: false,
      }));

      setFilas(mapeadas);
      setEntregados(mapeadas.length);
      setCargando(false);
    }

    traer();

    const canal = supabase
      .channel(`panel-${sesion.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "redemptions", filter: `session_id=eq.${sesion.id}` },
        () => traer(),
      )
      .subscribe();

    // Respaldo por si el socket se cae en una red inestable.
    const t = setInterval(traer, 15_000);

    return () => {
      vivo = false;
      clearInterval(t);
      supabase.removeChannel(canal);
    };
  }, [sesion.id]);

  const pct = elegibles ? Math.round((entregados / elegibles) * 100) : 0;

  // Avanza cada 30 s. Llamar a Date.now() en el render no es puro y el
  // ritmo tampoco necesita precisión de milisegundo.
  const marca = useReloj(30_000) * 30_000;
  const minutos = sesion.opened_at
    ? Math.max(1, (marca - new Date(sesion.opened_at).getTime()) / 60000)
    : 1;
  const ritmo = (entregados / minutos).toFixed(1).replace(".", ",");

  return (
    <div>
      <div className="flex items-center gap-2 border-l-4 border-granted bg-surface px-4 py-3">
        <span className="type-micro text-granted">En curso</span>
        <span className="text-label font-semibold">{sesion.name}</span>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-start">
      <div className="border border-line bg-surface p-5 lg:p-6">
        <p className="type-micro text-fg-tertiary">Entregados</p>
        <p className="mt-1 flex items-baseline gap-2">
          <span className="font-plate text-display lg:text-hero">{entregados}</span>
          <span className="font-plate text-title text-fg-tertiary">/ {elegibles}</span>
        </p>
        <div className="mt-4 h-1.5 w-full bg-line">
          <div className="h-full bg-accent transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-4 flex gap-6">
          <span className="text-sub text-fg-secondary">
            Faltan <b className="text-fg">{Math.max(0, elegibles - entregados)}</b>
          </span>
          <span className="text-sub text-fg-secondary">
            Ritmo <b className="text-fg">{ritmo}</b> / min
          </span>
        </div>
      </div>

      <div className="mt-8 lg:mt-0">
      <h2 className="font-plate text-section">Entregas</h2>

      {cargando ? (
        <div className="mt-3 flex flex-col gap-px">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[62px] animate-pulse bg-bg-sunken" />
          ))}
        </div>
      ) : filas.length === 0 ? (
        <p className="mt-3 border border-dashed border-line-control p-5 text-body text-fg-tertiary">
          Nadie ha pasado todavía. Cada escaneo aparece aquí solo, sin recargar.
        </p>
      ) : (
        <ul className="mt-3 border border-line bg-surface">
          {filas.map((f, i) => (
            <li
              key={f.id}
              className={[
                "flex items-center justify-between gap-4 px-4 py-3",
                i ? "border-t border-line" : "",
                i === 0 ? "border-l-[3px] border-l-accent" : "",
              ].join(" ")}
            >
              <div className="min-w-0">
                <p className="truncate text-body font-semibold">{f.nombre}</p>
                <p className="truncate text-label text-fg-tertiary">
                  {f.detalle} · {f.quien}
                  {f.puesto ? ` · ${f.puesto}` : ""}
                </p>
              </div>
              <span className="shrink-0 font-mono text-label text-fg-secondary">{f.hora}</span>
            </li>
          ))}
        </ul>
      )}
      </div>
      </div>
    </div>
  );
}
