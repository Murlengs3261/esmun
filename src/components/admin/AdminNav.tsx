"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { salir } from "@/lib/actions";

const DESTINOS = [
  { href: "/admin", label: "Panel", icono: "M3 13h6V3H3v10Zm0 8h6v-6H3v6Zm8 0h10V11H11v10Zm0-18v6h10V3H11Z" },
  { href: "/admin/sesiones", label: "Sesiones", icono: "M3 5h18v4H3V5Zm0 6h18v8H3v-8Z" },
  { href: "/admin/participantes", label: "Participantes", icono: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-8 9a8 8 0 0 1 16 0H4Z" },
  { href: "/admin/qr", label: "QR", icono: "M3 3h8v8H3V3Zm2 2v4h4V5H5Zm8-2h8v8h-8V3Zm2 2v4h4V5h-4ZM3 13h8v8H3v-8Zm2 2v4h4v-4H5Zm8-2h3v3h-3v-3Zm5 0h3v3h-3v-3Zm-5 5h3v3h-3v-3Zm5 0h3v3h-3v-3Z" },
];

// En escritorio cabe como destino propio. En móvil no: seis pestañas dejan
// áreas táctiles por debajo de lo usable, así que se llega desde Ajustes.
const PERSONAL = {
  href: "/admin/personal",
  label: "Personal",
  icono: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 20a7 7 0 0 1 14 0H2Zm15.5 0a8.9 8.9 0 0 0-1.8-5.4A5.5 5.5 0 0 1 22 20h-4.5Z",
};

const AJUSTES = {
  href: "/admin/ajustes",
  label: "Ajustes",
  icono: "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm8-3.5-2.1-.6-.5-1.2 1-1.9-1.7-1.7-1.9 1-1.2-.5L13 4h-2l-.6 2.1-1.2.5-1.9-1L5.6 7.3l1 1.9-.5 1.2L4 11v2l2.1.6.5 1.2-1 1.9 1.7 1.7 1.9-1 1.2.5L11 20h2l.6-2.1 1.2-.5 1.9 1 1.7-1.7-1-1.9.5-1.2L20 13v-1Z",
};

function activoEn(path: string, href: string) {
  return href === "/admin" ? path === "/admin" : path.startsWith(href);
}

function Icono({ d, activo }: { d: string; activo: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5 shrink-0"
      fill={activo ? "currentColor" : "none"}
      stroke={activo ? "none" : "currentColor"}
      strokeWidth="1.8"
    >
      <path d={d} />
    </svg>
  );
}

/** Barra lateral fija en escritorio. Debajo de lg no se renderiza:
 *  ahí manda la barra inferior, que cae bajo el pulgar. */
export function AdminSidebar({
  nombre,
  evento,
  logo,
}: {
  nombre: string;
  evento: string;
  logo: string | null;
}) {
  const path = usePathname();

  return (
    <aside className="sticky top-0 hidden h-[100dvh] w-[248px] shrink-0 flex-col border-r border-line bg-surface lg:flex">
      <div className="flex items-center gap-3 px-6 py-7">
        {logo ? (
          <Image
            src={logo}
            alt=""
            width={40}
            height={40}
            unoptimized
            className="size-10 object-contain"
          />
        ) : (
          <span className="flex size-10 items-center justify-center border-2 border-accent">
            <span className="font-plate text-label text-accent">ES</span>
          </span>
        )}
        <span className="min-w-0">
          <span className="block truncate font-plate text-label">{evento}</span>
          <span className="type-micro block text-fg-tertiary">Consola</span>
        </span>
      </div>

      <nav aria-label="Secciones" className="flex-1 px-3">
        <ul className="flex flex-col gap-1">
          {[...DESTINOS, PERSONAL].map((d) => {
            const activo = activoEn(path, d.href);
            return (
              <li key={d.href}>
                <Link
                  href={d.href}
                  aria-current={activo ? "page" : undefined}
                  className={[
                    "flex h-12 items-center gap-3 px-3 text-label font-semibold",
                    activo
                      ? "bg-accent-subtle text-accent"
                      : "text-fg-secondary hover:bg-bg-sunken",
                  ].join(" ")}
                >
                  <Icono d={d.icono} activo={activo} />
                  {d.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-line p-3">
        <Link
          href={AJUSTES.href}
          aria-current={activoEn(path, AJUSTES.href) ? "page" : undefined}
          className={[
            "flex h-12 items-center gap-3 px-3 text-label font-semibold",
            activoEn(path, AJUSTES.href)
              ? "bg-accent-subtle text-accent"
              : "text-fg-secondary hover:bg-bg-sunken",
          ].join(" ")}
        >
          <Icono d={AJUSTES.icono} activo={activoEn(path, AJUSTES.href)} />
          {AJUSTES.label}
        </Link>

        <div className="mt-2 flex items-center justify-between gap-2 px-3 py-2">
          <span className="min-w-0 truncate text-label text-fg-tertiary">{nombre}</span>
          <form action={salir}>
            <button className="text-label font-semibold text-accent">Salir</button>
          </form>
        </div>
      </div>
    </aside>
  );
}

/** Barra inferior en móvil. Cinco destinos, área táctil de 88 × 56. */
export function AdminTabBar() {
  const path = usePathname();
  const items = [...DESTINOS, AJUSTES];

  return (
    <nav
      aria-label="Secciones"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface lg:hidden"
    >
      <ul className="flex">
        {items.map((d) => {
          const activo = activoEn(path, d.href);
          return (
            <li key={d.href} className="flex-1">
              <Link
                href={d.href}
                aria-current={activo ? "page" : undefined}
                className="flex h-14 flex-col items-center justify-center gap-1"
                style={{ color: activo ? "var(--accent)" : "var(--text-tertiary)" }}
              >
                <Icono d={d.icono} activo={activo} />
                <span className="type-micro">{d.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="pb-safe" />
    </nav>
  );
}
