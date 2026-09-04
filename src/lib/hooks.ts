"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Lecturas de cosas que viven fuera de React (la red, localStorage).
 * Con useSyncExternalStore en vez de useEffect + setState: el valor está
 * bien desde el primer render y no dispara un render en cascada.
 */

function suscribirRed(avisar: () => void) {
  window.addEventListener("online", avisar);
  window.addEventListener("offline", avisar);
  return () => {
    window.removeEventListener("online", avisar);
    window.removeEventListener("offline", avisar);
  };
}

/** En el servidor se asume que hay conexión: la alternativa sería
 *  renderizar «sin conexión» y corregirlo al hidratar, que parpadea. */
export function useEnLinea() {
  return useSyncExternalStore(
    suscribirRed,
    () => navigator.onLine,
    () => true,
  );
}

const sinSuscripcion = () => () => {};

export function useAlmacenLocal(clave: string): string | null {
  const leer = useCallback(() => {
    try {
      return localStorage.getItem(clave);
    } catch {
      return null;
    }
  }, [clave]);

  return useSyncExternalStore(sinSuscripcion, leer, () => null);
}

/** Un reloj que avanza a saltos. Sirve para calcular ritmos sin llamar a
 *  Date.now() durante el render, que no es puro. */
export function useReloj(intervaloMs: number) {
  const suscribir = useCallback(
    (avisar: () => void) => {
      const t = setInterval(avisar, intervaloMs);
      return () => clearInterval(t);
    },
    [intervaloMs],
  );

  return useSyncExternalStore(
    suscribir,
    () => Math.floor(Date.now() / intervaloMs),
    () => 0,
  );
}
