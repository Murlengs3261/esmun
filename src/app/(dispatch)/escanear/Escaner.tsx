"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { ReticleFrame } from "@/components/dispatch/ReticleFrame";
import { VerdictPanel } from "@/components/dispatch/VerdictPanel";
import type { ScanVerdict } from "@/lib/domain/types";
import { useAlmacenLocal, useEnLinea } from "@/lib/hooks";
import {
  anotarRechazo, buscarEnPadron, canjearEnServidor, contarPendientes,
  descargarPadron, encolar, esErrorDeRed, limpiarPadron, padronActual,
  registrarSellado, selladoLocal, subirCola,
} from "@/lib/offline";

interface Props {
  sesion: { id: string; name: string; day_number: number | null } | null;
  entregados: number;
}

/** Ventana de silencio local: la cámara dispara varias lecturas por segundo
 *  del mismo código. Ignorarlas sin llamar al servidor evita el 99% del
 *  ruido y hace que la respuesta se sienta inmediata. */
const SILENCIO_MS = 60_000;
/** Cada cuánto se vuelve a bajar el padrón mientras hay señal: alguien
 *  dado de alta durante el evento tiene que poder comer. */
const PADRON_CADA_MS = 10 * 60_000;
/** Cada cuánto se intenta subir la cola. */
const SUBIDA_CADA_MS = 8_000;

export function Escaner({ sesion, entregados: inicial }: Props) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const vistos = useRef(new Map<string, number>());
  const ocupado = useRef(false);

  const [entregados, setEntregados] = useState(inicial);
  const [rechazos, setRechazos] = useState(0);
  const [veredicto, setVeredicto] = useState<ScanVerdict | null>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [camara, setCamara] = useState<"pidiendo" | "ok" | "denegada" | "ocupada">("pidiendo");
  const online = useEnLinea();
  const puesto = useAlmacenLocal("esmun.station");

  // La red puede decir «en línea» con un wifi que no responde. Por eso
  // el modo local se decide también por la última llamada que falló.
  const [redCaida, setRedCaida] = useState(false);
  const redCaidaRef = useRef(false);
  const [cola, setCola] = useState(0);
  const [aviso, setAviso] = useState<"subiendo" | "subido" | null>(null);
  const sesionId = sesion?.id ?? null;

  const modoLocal = !online || redCaida;

  const marcarRed = useCallback((caida: boolean) => {
    redCaidaRef.current = caida;
    setRedCaida(caida);
    try {
      if (caida) {
        if (!localStorage.getItem("esmun.sinSenalDesde")) {
          localStorage.setItem("esmun.sinSenalDesde", new Date().toISOString());
        }
      } else {
        localStorage.removeItem("esmun.sinSenalDesde");
      }
    } catch { /* sin almacenamiento */ }
  }, []);

  const refrescarCola = useCallback(async () => {
    setCola(await contarPendientes());
  }, []);

  /** Canje contra el padrón del teléfono. Solo detecta los duplicados de
   *  este mismo dispositivo; los de otros puestos los detecta el servidor
   *  al subir la cola y quedan como conflicto. */
  const canjeLocal = useCallback(async (token: string): Promise<ScanVerdict> => {
    if (!sesionId) return { status: "session_closed", closed_at: null };

    const padron = await padronActual();
    if (!padron || padron.session_id !== sesionId) return { status: "sin_red" };

    const fila = await buscarEnPadron(sesionId, token);
    if (!fila) return { status: "unknown_token" };

    const previo = await selladoLocal(sesionId, token);
    if (previo) {
      return {
        status: "duplicate",
        name: previo.name,
        detail: previo.detail,
        redeemed_at: previo.redeemed_at,
        station: puesto,
        by: "este teléfono",
      };
    }

    const ahora = new Date().toISOString();
    await encolar({
      session_id: sesionId,
      qr_token: token,
      name: fila.name,
      detail: fila.detail,
      station: puesto,
      device_id: localStorage.getItem("esmun.device"),
      redeemed_at: ahora,
    });
    await registrarSellado(sesionId, token, { name: fila.name, detail: fila.detail, redeemed_at: ahora });
    await refrescarCola();

    return {
      status: "granted",
      name: fila.name,
      detail: fila.detail,
      diet: fila.diet,
      redeemed_at: ahora,
      offline: true,
    };
  }, [sesionId, puesto, refrescarCola]);

  const canjear = useCallback(async (token: string) => {
    if (ocupado.current) return;

    const ahora = Date.now();
    const ultimo = vistos.current.get(token);
    if (ultimo && ahora - ultimo < SILENCIO_MS) return;

    ocupado.current = true;
    setLeyendo(true);
    vistos.current.set(token, ahora);

    let r: ScanVerdict;
    if (!navigator.onLine || redCaidaRef.current) {
      r = await canjeLocal(token);
    } else {
      const supabase = createClient();
      const { data, error } = await canjearEnServidor(supabase, {
        p_token: token,
        p_station: localStorage.getItem("esmun.station"),
        p_device: localStorage.getItem("esmun.device"),
      });

      if (!error && data) {
        r = data;
        if (r.status === "granted" && sesionId) {
          await registrarSellado(sesionId, token, {
            name: r.name, detail: r.detail, redeemed_at: r.redeemed_at,
          });
        }
      } else if (esErrorDeRed(error)) {
        marcarRed(true);
        r = await canjeLocal(token);
      } else {
        r = { status: "fallo", message: error?.message ?? "Sin respuesta" };
        // Un código que no pudo registrarse tiene que poder volver a leerse.
        vistos.current.delete(token);
      }
    }

    if (r.status === "sin_red") vistos.current.delete(token);

    setLeyendo(false);
    ocupado.current = false;
    setVeredicto(r);

    if (r.status === "granted") {
      setEntregados((n) => n + 1);
    } else {
      setRechazos((n) => n + 1);
      if (sesionId) anotarRechazo(sesionId, r.status);
    }

    navigator.vibrate?.(r.status === "granted" ? 40 : [60, 60, 60]);
  }, [canjeLocal, marcarRed, sesionId]);

  // ── Padrón local ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!sesionId) {
      // Sesión cerrada: el padrón se va del teléfono si no queda nada por subir.
      contarPendientes().then((n) => { if (n === 0) void limpiarPadron(); });
      return;
    }
    if (!online) return;

    let vivo = true;
    const bajar = async () => {
      const actual = await padronActual();
      const viejo =
        !actual ||
        actual.session_id !== sesionId ||
        Date.now() - new Date(actual.descargado_en).getTime() > PADRON_CADA_MS;
      if (!viejo) return;
      try {
        await descargarPadron(createClient(), sesionId);
      } catch { /* sin padrón se sigue en línea; se reintenta en el siguiente ciclo */ }
    };
    void bajar();
    const t = setInterval(() => { if (vivo) void bajar(); }, PADRON_CADA_MS);
    return () => { vivo = false; clearInterval(t); };
  }, [sesionId, online]);

  // ── Subida de la cola ────────────────────────────────────────────────
  useEffect(() => {
    let vivo = true;
    contarPendientes().then((n) => { if (vivo) setCola(n); });
    return () => { vivo = false; };
  }, []);

  useEffect(() => {
    if (!online) return;
    let vivo = true;
    let enCurso = false;

    const intentar = async () => {
      if (enCurso || !vivo) return;
      const pendientes = await contarPendientes();
      if (pendientes === 0 && !redCaidaRef.current) return;

      enCurso = true;
      if (pendientes > 0) setAviso("subiendo");
      const res = await subirCola(createClient());
      enCurso = false;
      if (!vivo) return;

      setCola(res.quedan);
      if (res.red) {
        marcarRed(false);
        if (res.quedan === 0 && pendientes > 0) {
          setAviso("subido");
          setTimeout(() => { if (vivo) setAviso(null); }, 2_000);
          router.refresh(); // el contador del turno lo lleva el servidor
        } else if (res.quedan === 0) {
          setAviso(null);
        }
      } else {
        marcarRed(true);
        setAviso(null);
      }
    };

    void intentar();
    const t = setInterval(intentar, SUBIDA_CADA_MS);
    return () => { vivo = false; clearInterval(t); };
  }, [online, marcarRed, router]);

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
    return <EnEspera puesto={puesto} online={online} cola={cola} />;
  }

  const hayCola = cola > 0;

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
            aria-label={modoLocal ? "Sin conexión" : "En línea"}
            className={`size-2 ${modoLocal ? "bg-invalid" : "bg-granted"}`}
          />
        </div>
      </header>

      {/* Banda de conexión — índigo, no ámbar: no es un error, es un modo.
          Permanente mientras dure; nunca un toast. */}
      {(modoLocal || hayCola || aviso) && (
        <div
          role="status"
          className="flex h-12 shrink-0 items-center justify-between bg-accent px-5 text-fg-on-accent"
        >
          <span className="flex items-center gap-2 text-label font-semibold">
            <span aria-hidden className="size-3.5 border-[3px] border-current" />
            {modoLocal
              ? "Modo local · sigue escaneando"
              : aviso === "subido"
                ? "Todo subido"
                : `Volvió la señal · subiendo ${cola}`}
          </span>
          {modoLocal && hayCola && (
            <span className="type-micro opacity-80">{cola} en cola</span>
          )}
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
        {modoLocal ? (
          <>
            <h1 className="font-plate text-title">Todo funciona igual</h1>
            <p className="mt-2 text-body text-fg-secondary">
              El teléfono guarda cada canje y valida los duplicados con la
              lista que descargó al abrir la sesión. Cuando vuelva el wifi,
              sube solo.
            </p>
          </>
        ) : (
          <>
            <h1 className="font-plate text-title">Apunta al gafete</h1>
            <p className="mt-2 text-body text-fg-secondary">
              Encuadra el código dentro del marco. Se lee solo; no tienes que tocar nada.
            </p>
          </>
        )}
        <p className="mt-5 text-body">
          <span className="font-plate text-verdict">{entregados}</span>{" "}
          <span className="text-fg-tertiary">
            entregados en este turno{rechazos ? ` · ${rechazos} rechazos` : ""}
          </span>
        </p>
      </section>

      <div className="px-5 pb-4">
        {modoLocal || hayCola ? (
          <Button size="xl" variant="secondary" fullWidth onClick={() => router.push("/cola")}>
            Ver cola pendiente
          </Button>
        ) : (
          <Button size="xl" variant="secondary" fullWidth onClick={() => router.push("/turno")}>
            Terminar turno
          </Button>
        )}
      </div>
      <div className="pb-safe" />

      {veredicto && (
        <VerdictPanel
          result={veredicto}
          onContinue={() => {
            setVeredicto(null);
            if (!modoLocal) router.refresh();
          }}
        />
      )}
    </main>
  );
}

/* ── 03 · En espera ──────────────────────────────────────────────────── */
function EnEspera({ puesto, online, cola }: { puesto: string | null; online: boolean; cola: number }) {
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
        {cola > 0 && (
          <button
            type="button"
            onClick={() => router.push("/cola")}
            className="mt-6 border-2 border-accent px-4 py-3 text-label font-semibold text-accent"
          >
            {cola} {cola === 1 ? "canje" : "canjes"} sin subir · ver cola
          </button>
        )}
      </div>
      <div className="pb-safe" />
    </main>
  );
}
