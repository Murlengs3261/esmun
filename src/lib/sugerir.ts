/** Sugerencia legible en voz alta: una palabra corriente, un separador y
 *  tres dígitos. Un estudiante voluntario la va a leer de un papel a las
 *  siete de la mañana, no la va a memorizar. */
const PALABRAS = [
  "delta", "pino", "cobre", "lienzo", "faro", "duna", "ambar", "nieve",
  "roble", "cardo", "brisa", "coral", "menta", "sauce", "vela", "trigo",
];

export function generarSugerencia() {
  const n = crypto.getRandomValues(new Uint32Array(2));
  const palabra = PALABRAS[n[0] % PALABRAS.length];
  const numero = String(100 + (n[1] % 900));
  return `esmun-${palabra}${numero}`;
}
