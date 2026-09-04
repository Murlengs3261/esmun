import type { EstadoAlta } from "@/lib/actions";

export function Aviso({ estado }: { estado: EstadoAlta }) {
  if (!estado.error && !estado.ok) return null;
  const malo = Boolean(estado.error);
  return (
    <p
      role="status"
      className={[
        "border-l-[3px] bg-surface p-4 text-sub",
        malo ? "border-duplicate text-duplicate" : "border-granted text-granted",
      ].join(" ")}
    >
      {estado.error ?? estado.ok}
    </p>
  );
}
