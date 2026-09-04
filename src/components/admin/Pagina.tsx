/** Envoltura común de la consola. Concentra el ancho de lectura y los
 *  márgenes para que móvil y escritorio no se desalineen entre pantallas. */
export function Pagina({
  eyebrow, titulo, descripcion, acciones, ancho = "normal", children,
}: {
  eyebrow?: React.ReactNode;
  titulo: string;
  descripcion?: string;
  acciones?: React.ReactNode;
  ancho?: "angosto" | "normal" | "ancho";
  children: React.ReactNode;
}) {
  const max =
    ancho === "angosto" ? "max-w-2xl" : ancho === "ancho" ? "max-w-6xl" : "max-w-4xl";

  return (
    <main className={`mx-auto w-full ${max} px-5 pb-16 pt-8 lg:px-10 lg:pt-12`}>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          {eyebrow ? <p className="type-micro text-accent">{eyebrow}</p> : null}
          <h1 className="font-plate mt-3 text-title lg:text-[34px]">{titulo}</h1>
          {descripcion ? (
            <p className="mt-2 max-w-[62ch] text-body text-fg-secondary">{descripcion}</p>
          ) : null}
        </div>
        {acciones}
      </header>
      <div className="mt-8 flex flex-col gap-10 lg:mt-10 lg:gap-12">{children}</div>
    </main>
  );
}

export function Seccion({
  titulo, nota, children,
}: { titulo: string; nota?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="border-b border-line pb-3">
        <h2 className="font-plate text-section">{titulo}</h2>
        {nota ? <p className="mt-1 max-w-[62ch] text-sub text-fg-tertiary">{nota}</p> : null}
      </div>
      {children}
    </section>
  );
}
