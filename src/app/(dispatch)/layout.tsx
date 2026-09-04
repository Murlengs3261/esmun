import type { Metadata } from "next";

export const metadata: Metadata = { title: "ESMUN · Despacho" };

/**
 * La app del despachador es oscura SIEMPRE, sin seguir el tema del
 * sistema: se usa en pasillos con poca luz, a las 7 de la mañana, con la
 * cámara abierta seis horas seguidas.
 *
 * En escritorio no se estira: se encuadra a 390 px, que es el ancho para
 * el que está diseñada. Un escáner a 1400 px de ancho no existe.
 */
export default function DispatchLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-theme="dark" data-kiosk className="min-h-[100dvh] bg-bg-sunken">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[390px] flex-col bg-bg-base text-fg lg:border-x lg:border-line">
        {children}
      </div>
    </div>
  );
}
