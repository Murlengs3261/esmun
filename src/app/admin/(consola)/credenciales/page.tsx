import { permanentRedirect } from "next/navigation";

/** «Gafetes» pasó a ser «QR». El diseño del gafete impreso vendrá encima
 *  de esta misma pantalla cuando estén los archivos. */
export default function Credenciales() {
  permanentRedirect("/admin/qr");
}
