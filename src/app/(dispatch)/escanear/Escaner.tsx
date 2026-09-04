"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { ReticleFrame } from "@/components/dispatch/ReticleFrame";
import { VerdictPanel } from "@/components/dispatch/VerdictPanel";
import type { RedeemResponse } from "@/lib/domain/types";
import { useAlmacenLocal, useEnLinea } from "@/lib/hooks";

interface Props {
  sesion: { id: string; name: string; day_number: number | null } | null;
  entregados: number;
}

/** Ventana de silencio local: la cámara dispara varias lecturas por segundo
 *  del mismo código. Ignorarlas sin llamar al servidor evita el 99% del
 *  ruido y hace que la respuesta se sienta inmediata. */
const SILENCIO_MS = 60_000;

export function Escaner({ sesion, entregados: inicial }: Props) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const vistos = useRef(new Map<string, number>());
  const ocupado = useRef(false);

  const [entregados, setEntregados] = useState(inicial);
  const [rechazos, setRechazos] = useState(0);
  const [veredicto, setVeredicto] = useState<RedeemResponse | null>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [camara, setCamara] = useState<"pidiendo" | "ok" | "denegada" | "ocupada">("pidiendo");
  const online = useEnLinea();
  const puesto = useAlmacenLocal("esmun.station");

  const canjear = useCallback(async (token: string) => {
    if (ocupado.current) return;

    const ahora = Date.now();
    const ultimo = vistos.current.get(token);
    if (ultimo && ahora - ultimo < SILENCIO_MS) return;

    ocupado.current = true;
    setLeyendo(true);
    vistos.current.set(token, ahora);

    const supabase = createClient();
    const { data, error } = await supabase.rpc("redeem_qr", {
      p_token: token,
      p_station: localStorage.getItem("esmun.station"),
      p_device: localStorage.getItem("esmun.device"),
    });

    setLeyendo(false);
    ocupado.current = false;

    if (error) return;

    const r = data as RedeemResponse;
    setVeredicto(r);
    if (r.status === "granted") setEntregados((n) => n + 1);
    else setRechazos((n) => n + 1);

    navigator.vibrate?.(r.status === "granted" ? 40 : [60, 60, 60]);
  }, []);

  // ── Cámara ───────────────────────────────────────────────────────────
  useEffect(() => {
    let stream: MediaStream | null = null;
    let parar = false;
    let raf = 0;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (parar) return void stream.getTracks().forEach((t) => t.stop());
        setCamara("ok");
        const v = videoRef.current;
        if (!v) return;
        v.srcObject = stream;
        await v.play();

        // BarcodeDetector nativo donde exista (Android Chrome), con
        // respaldo en ZXing para iPhone.
        const Nativo = (window as unknown as { BarcodeDetector?: new (o: object) => {
          detect(s: CanvasImageSource): Promise<{ rawValue: string }[]>;
        } }).BarcodeDetector;

        if (Nativo) {
          const det = new Nativo({ formats: ["qr_code"] });
          const tick = async () => {
            if (parar) return;
            try {
              const found = await det.detect(v);
              if (found[0]?.rawValue) await canjear(found[0].rawValue);
            } catch { /* cuadro ilegible: se ignora y sigue */ }
            raf = requestAnimationFrame(tick);
          };
          raf = requestAnimationFrame(tick);
        } else {
          const { BrowserQRCodeReader } = await import("@zxing/browser");
          const lector = new BrowserQRCodeReader();
          await lector.decodeFromVideoElement(v, (res) => {
            if (res) void canjear(res.getText());
          });
        }
      } catch (e) {
        const nombre = (e as DOMException)?.name;
        setCamara(nombre === "NotReadableError" ? "ocupada" : "denegada");
      }
    })();

    return () => {
      parar = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [canjear]);

  if (!sesion) {
    return <EnEspera puesto={puesto} online={online} />;
  }

  return (
    <main className="flex min-h-[100dvh] flex-col">
      <div className="pt-safe" />

      {/* Barra superior — 56, fija */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-line bg-surface px-5">
        <div className="min-w-0">
          <p className="truncate text-label font-semibold">{sesion.name}</p>
          <p className="type-micro text-fg-tertiary">
            {sesion.day_number ? `Día ${sesion.day_number}` : "ESMUN"}
            {puesto ? ` · ${puesto}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="font-plate text-section leading-none">{entregados}</p>
            <p className="type-micro text-fg-tertiary">Turno</p>
          </div>
          <span
            aria-label={online ? "En línea" : "Sin conexión"}
            className={`size-2 ${online ? "bg-granted" : "bg-invalid"}`}
          />
        </div>
      </header>

      {/* Banda de conexión — índigo, no ámbar: no es un error, es un modo */}
      {!online && (
        <div className="flex h-12 shrink-0 items-center justify-between bg-accent px-5 text-fg-on-accent">
          <span className="flex items-center gap-2 text-label font-semibold">
            <span aria-hidden className="size-3.5 border-[3px] border-current" />
            Modo local · sigue escaneando
          </span>
        </div>
      )}

      {/* Visor — elástico entre 45% y 55% del alto */}
      <div className="relative flex h-[50dvh] max-h-[55dvh] min-h-[45dvh] shrink-0 items-center justify-center overflow-hidden bg-bg-sunken">
        <video
          ref={videoRef}
          playsInline
          muted
          className="absolute inset-0 size-full object-cover"
        />
        {camara === "ok" ? (
          <ReticleFrame reading={leyendo} />
        ) : (
          <div className="relative z-10 px-5 text-center">
            <p className="text-body text-fg-secondary">
              {camara === "pidiendo"
                ? "Pidiendo acceso a la cámara…"
                : camara === "ocupada"
                  ? "Otra aplicación está usando la cámara. Ciérrala y vuelve a intentar."
                  : "La app necesita la cámara para leer los gafetes. Ábrele el permiso en los ajustes del teléfono."}
            </p>
          </div>
        )}
      </div>

      {/* Zona de veredicto — en reposo, la instrucción */}
      <section className="flex flex-1 flex-col justify-center px-5">
        <h1 className="font-plate text-title">Apunta al gafete</h1>
        <p className="mt-2 text-body text-fg-secondary">
          Encuadra el código dentro del marco. Se lee solo; no tienes que tocar nada.
        </p>
        <p className="mt-5 text-body">
          <span className="font-plate text-verdict">{entregados}</span>{" "}
          <span className="text-fg-tertiary">
            entregados en este turno{rechazos ? ` · ${rechazos} rechazos` : ""}
          </span>
        </p>
      </section>

      <div className="px-5 pb-4">
        <Button size="xl" variant="secondary" fullWidth onClick={() => router.push("/turno")}>
          Terminar turno
        </Button>
      </div>
      <div className="pb-safe" />

      {veredicto && (
        <VerdictPanel
          result={veredicto}
          onContinue={() => {
            setVeredicto(null);
            router.refresh();
          }}
        />
      )}
    </main>
  );
}

/* ── 03 · En espera ──────────────────────────────────────────────────── */
function EnEspera({ puesto, online }: { puesto: string | null; online: boolean }) {
  const router = useRouter();

  // Sin botón de recargar: se actualiza sola.
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 20_000);
    return () => clearInterval(t);
  }, [router]);

  return (
    <main className="flex min-h-[100dvh] flex-col px-5">
      <div className="pt-safe" />
      <header className="flex h-14 items-center justify-between border-b border-line">
        <span className="text-label font-semibold text-fg-secondary">{puesto ?? "Sin puesto"}</span>
        <span className={`size-2 ${online ? "bg-granted" : "bg-invalid"}`} />
      </header>

      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="flex size-[120px] items-center justify-center border-2 border-dashed border-line-control">
          <span className="size-14 animate-pulse bg-accent-subtle" />
        </div>
        <h1 className="font-plate mt-8 text-title">Ninguna entrega abierta</h1>
        <p className="mt-3 max-w-[300px] text-body text-fg-secondary">
          La cámara se enciende sola en cuanto el organizador abra la sesión.
          No tienes que hacer nada.
        </p>
      </div>
      <div className="pb-safe" />
    </main>
  );
}
