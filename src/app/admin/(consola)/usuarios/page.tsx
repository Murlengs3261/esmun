import { permanentRedirect } from "next/navigation";

/** La sección se llamaba «Usuarios». Se queda el redirección para que no
 *  se rompan enlaces guardados ni el historial del navegador. */
export default function Usuarios() {
  permanentRedirect("/admin/personal");
}
