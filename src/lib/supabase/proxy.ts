import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/** Rutas de la consola de administración. */
const ADMIN_PREFIX = "/admin";
/** Rutas del despachador (grupo (dispatch)). */
const DISPATCH_PATHS = ["/escanear", "/puesto", "/cola", "/turno"];
// Herramienta de revisión de diseño; solo existe en desarrollo.
const DEV_PATHS = ["/vista-previa"];

const PUBLIC_PATHS = ["/ingresar", "/admin/ingresar"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() revalida contra el servidor de Auth. No usar getSession()
  // para decidir permisos: esa lee la cookie sin verificarla.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p);
  const isAdminArea = pathname.startsWith(ADMIN_PREFIX);
  const isDispatchArea = DISPATCH_PATHS.some((p) => pathname.startsWith(p));
  const isDevTool = DEV_PATHS.some((p) => pathname.startsWith(p));

  if (isDevTool && process.env.NODE_ENV !== "production") return response;

  if (!user && (isAdminArea || isDispatchArea) && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = isAdminArea ? "/admin/ingresar" : "/ingresar";
    return NextResponse.redirect(url);
  }

  // La consola de admin exige rol admin. Es una segunda barrera: la
  // primera y verdadera son las políticas RLS de la base de datos.
  if (user && isAdminArea && !isPublic) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, is_active")
      .eq("id", user.id)
      .single();

    if (!profile?.is_active || profile.role !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/escanear";
      return NextResponse.redirect(url);
    }
  }

  return response;
}
