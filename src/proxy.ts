import { NextResponse, type NextRequest } from "next/server";

/** Next 16: el convenio `middleware` se renombró a `proxy`. */
export async function proxy(request: NextRequest) {
  try {
    // Carga diferida: si el módulo de Supabase no arranca en el servidor,
    // el error cae en el catch de abajo en vez de tumbar el proxy entero.
    const { updateSession } = await import("@/lib/supabase/proxy");
    return await updateSession(request);
  } catch (e) {
    // Un fallo aquí tumba todas las rutas. Decir cuál fue ahorra adivinar
    // en los registros de Vercel; no lleva claves ni datos de nadie.
    const detalle = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    return new NextResponse(`ESMUN: error al iniciar la sesión.\n\n${detalle}`, {
      status: 500,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)",
  ],
};
