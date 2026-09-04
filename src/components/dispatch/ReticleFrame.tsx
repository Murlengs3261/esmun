"use client";

/** 240 × 240, cuatro esquinas de 40 con trazo 4. Sin animación de barrido:
 *  el barrido sugiere que el usuario debe esperar, y aquí la lectura es
 *  instantánea. En estado «leyendo» las esquinas se cierran en rectángulo. */
export function ReticleFrame({ reading = false }: { reading?: boolean }) {
  const corner = "absolute size-10 border-accent";
  return (
    <div
      aria-hidden
      className={[
        "pointer-events-none relative size-60 transition-[border-color] duration-[120ms]",
        reading ? "border-4 border-accent" : "",
      ].join(" ")}
    >
      {!reading && (
        <>
          <span className={`${corner} left-0 top-0 border-l-4 border-t-4`} />
          <span className={`${corner} right-0 top-0 border-r-4 border-t-4`} />
          <span className={`${corner} bottom-0 left-0 border-b-4 border-l-4`} />
          <span className={`${corner} bottom-0 right-0 border-b-4 border-r-4`} />
        </>
      )}
    </div>
  );
}
