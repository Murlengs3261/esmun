import { ColaPendiente } from "@/components/dispatch/ColaPendiente";

/** La cola vive en el teléfono (IndexedDB); esta página solo la muestra. */
export default function Cola() {
  return <ColaPendiente />;
}
