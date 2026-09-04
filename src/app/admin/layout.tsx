import type { Metadata } from "next";

export const metadata: Metadata = { title: "ESMUN · Consola" };

/** La consola sigue el tema del sistema, al revés que el despachador:
 *  se usa sentado, con tiempo y con luz. */
export default function AdminRoot({ children }: { children: React.ReactNode }) {
  return <div className="min-h-[100dvh] bg-bg-base text-fg">{children}</div>;
}
