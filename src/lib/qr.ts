"use client";

import QRCode from "qrcode";

/**
 * Nivel Q de corrección de errores: recupera hasta un 25% del código.
 * Un gafete que pasa tres días colgado del cuello se arruga, se mancha y
 * se moja; con nivel L el primer doblez lo deja ilegible.
 */
const OPCIONES = {
  errorCorrectionLevel: "Q" as const,
  margin: 0, // la zona de silencio la pone la tarjeta, no el código
  color: { dark: "#000000", light: "#FFFFFF" },
};

/* ── La tarjeta de referencia ────────────────────────────────────────
   Todo el diseño está calcado de la imagen que aprobó el organizador,
   que mide 512 × 634. Cada medida de abajo está en esos píxeles y se
   escala con `k = ancho / 512`, así el PNG de impresión y la miniatura
   son la misma tarjeta a distinto tamaño. */

const BASE = 512;
const REF = {
  borde: 2,
  qrLado: 322,
  qrArriba: 54,
  reglaY: 426,
  reglaAlto: 2,
  margenTexto: 34,
  nombre: { tam: 34, arriba: 472, interlineado: 41 },
  detalle: { tam: 27, separacion: 56, interlineado: 33 },
  codigo: { tam: 25, separacion: 45 },
  abajo: 43,
};

/** 1024 px de ancho deja el QR a más de 600 ppp sobre 42 mm impresos. */
export const ANCHO_IMPRESION = 1024;
export const ANCHO_MINIATURA = 360;
/** Proporción de la tarjeta, para el hueco mientras se dibuja. */
export const PROPORCION = "256 / 317";

export interface DatosQR {
  token: string;
  nombre: string;
  /** «Delegado · ONUDC 1 Jr · Bolivia» */
  detalle: string;
  codigo?: string | null;
}

/* ── Tipografías ─────────────────────────────────────────────────────
   La tarjeta aprobada se dibujó con la letra del sistema, así que se
   conserva esa: en un Mac sale idéntica a la referencia. Para usar la
   Plex de la consola bastaría con leer `--font-plex-sans` del body. */
const SANS =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';

/** Parte un texto en como mucho `maxLineas`; si aun así no cabe, recorta. */
function repartir(
  ctx: CanvasRenderingContext2D,
  texto: string,
  ancho: number,
  maxLineas: number,
): string[] {
  if (ctx.measureText(texto).width <= ancho) return [texto];

  const palabras = texto.split(" ");
  const lineas: string[] = [];
  let actual = "";

  for (const p of palabras) {
    const prueba = actual ? `${actual} ${p}` : p;
    if (ctx.measureText(prueba).width <= ancho) {
      actual = prueba;
    } else {
      if (actual) lineas.push(actual);
      actual = p;
      if (lineas.length === maxLineas - 1) break;
    }
  }
  if (actual) lineas.push(actual);

  const ultima = lineas[maxLineas - 1];
  if (lineas.length >= maxLineas && ultima && ctx.measureText(ultima).width > ancho) {
    let recorte = ultima;
    while (recorte.length > 1 && ctx.measureText(`${recorte}…`).width > ancho) {
      recorte = recorte.slice(0, -1);
    }
    lineas[maxLineas - 1] = `${recorte}…`;
  }
  return lineas.slice(0, maxLineas);
}

/** Altura de la parte alta de las letras con la fuente activa: sirve
 *  para colocar el texto por su borde superior, como en la referencia. */
function ascenso(ctx: CanvasRenderingContext2D, muestra: string) {
  return ctx.measureText(muestra).actualBoundingBoxAscent;
}

/**
 * Dibuja la tarjeta: el código arriba, una regla, y debajo el nombre con
 * los datos en letra chica. Sin la alerta alimentaria: eso lo ve el
 * escaneador en su pantalla, no tiene por qué ir escrito en un papel que
 * va a pasar por muchas manos.
 */
export async function componerQR(d: DatosQR, ancho = ANCHO_IMPRESION): Promise<Blob> {
  const k = ancho / BASE;
  const px = (n: number) => Math.round(n * k);

  const borde = Math.max(1, px(REF.borde));
  const margenTexto = px(REF.margenTexto);
  const anchoTexto = ancho - margenTexto * 2;

  const fNombre = `600 ${px(REF.nombre.tam)}px ${SANS}`;
  const fDetalle = `400 ${px(REF.detalle.tam)}px ${SANS}`;
  const fCodigo = `500 ${px(REF.codigo.tam)}px ${MONO}`;

  if (typeof document !== "undefined" && document.fonts?.ready) {
    await document.fonts.ready;
  }

  // Primera pasada: repartir el texto y calcular dónde cae cada línea.
  const medidor = document.createElement("canvas").getContext("2d")!;
  medidor.font = fNombre;
  const lineasNombre = repartir(medidor, d.nombre, anchoTexto, 2);
  medidor.font = fDetalle;
  const lineasDetalle = d.detalle ? repartir(medidor, d.detalle, anchoTexto, 2) : [];

  let cursor = px(REF.nombre.arriba);
  const arribaNombre = cursor;
  cursor += (lineasNombre.length - 1) * px(REF.nombre.interlineado);

  let arribaDetalle = 0;
  if (lineasDetalle.length) {
    cursor += px(REF.detalle.separacion);
    arribaDetalle = cursor;
    cursor += (lineasDetalle.length - 1) * px(REF.detalle.interlineado);
  }

  let arribaCodigo = 0;
  if (d.codigo) {
    cursor += px(lineasDetalle.length ? REF.codigo.separacion : REF.detalle.separacion);
    arribaCodigo = cursor;
  }

  // El pie se mide desde la línea base del último renglón.
  let baseFinal: number;
  if (d.codigo) {
    medidor.font = fCodigo;
    baseFinal = arribaCodigo + ascenso(medidor, "D") + medidor.measureText(d.codigo).actualBoundingBoxDescent;
  } else if (lineasDetalle.length) {
    medidor.font = fDetalle;
    const ultima = lineasDetalle[lineasDetalle.length - 1];
    baseFinal = arribaDetalle + ascenso(medidor, "D") + medidor.measureText(ultima).actualBoundingBoxDescent;
  } else {
    medidor.font = fNombre;
    const ultima = lineasNombre[lineasNombre.length - 1];
    baseFinal = arribaNombre + ascenso(medidor, "l") + medidor.measureText(ultima).actualBoundingBoxDescent;
  }
  const alto = Math.round(baseFinal + px(REF.abajo));

  const lienzo = document.createElement("canvas");
  lienzo.width = ancho;
  lienzo.height = alto;
  const ctx = lienzo.getContext("2d")!;

  // Fondo y marco
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, ancho, alto);
  ctx.fillStyle = "#DCDCE8";
  ctx.fillRect(0, 0, ancho, borde);
  ctx.fillRect(0, alto - borde, ancho, borde);
  ctx.fillRect(0, 0, borde, alto);
  ctx.fillRect(ancho - borde, 0, borde, alto);

  // El código, centrado
  const ladoQR = px(REF.qrLado);
  const png = await QRCode.toDataURL(d.token, { ...OPCIONES, width: ladoQR });
  const img = new Image();
  img.src = png;
  await img.decode();
  ctx.imageSmoothingEnabled = false; // los módulos deben quedar con filo
  ctx.drawImage(img, Math.round((ancho - ladoQR) / 2), px(REF.qrArriba), ladoQR, ladoQR);

  // Regla de lado a lado
  ctx.fillStyle = "#DCDCE8";
  ctx.fillRect(0, px(REF.reglaY), ancho, Math.max(1, px(REF.reglaAlto)));

  ctx.textBaseline = "alphabetic";

  // Nombre
  ctx.fillStyle = "#14162A";
  ctx.font = fNombre;
  const subeNombre = ascenso(ctx, "l");
  lineasNombre.forEach((linea, i) => {
    ctx.fillText(linea, margenTexto, arribaNombre + i * px(REF.nombre.interlineado) + subeNombre);
  });

  // Rol · foro · representación
  if (lineasDetalle.length) {
    ctx.fillStyle = "#5A5E7A";
    ctx.font = fDetalle;
    const sube = ascenso(ctx, "D");
    lineasDetalle.forEach((linea, i) => {
      ctx.fillText(linea, margenTexto, arribaDetalle + i * px(REF.detalle.interlineado) + sube);
    });
  }

  // Código de estudiante
  if (d.codigo) {
    ctx.fillStyle = "#5A5E7A";
    ctx.font = fCodigo;
    ctx.fillText(d.codigo, margenTexto, arribaCodigo + ascenso(ctx, "D"));
  }

  return await new Promise<Blob>((resolver) =>
    lienzo.toBlob((b) => resolver(b!), "image/png"),
  );
}

/** Versión para pintar en pantalla: lo mismo, pero como object URL. */
export async function componerQRVista(d: DatosQR, ancho = ANCHO_MINIATURA) {
  const blob = await componerQR(d, ancho);
  return URL.createObjectURL(blob);
}

/** Caracteres que rompen el sistema de archivos en macOS y Windows. Los
 *  acentos se conservan: los dos los manejan bien. */
export function nombreArchivo(partes: (string | null | undefined)[]) {
  const limpio = partes
    .filter((p) => p && p.trim())
    .map((p) => p!.trim().replace(/[/\\:*?"<>|]/g, "-"))
    .join(" - ")
    .replace(/\s+/g, " ");
  return `QR - ${limpio}.png`;
}

export function descargar(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}
