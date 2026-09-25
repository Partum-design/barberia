import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { DESTINO_POR_ROL, resolverRol } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

/**
 * Retorno de OAuth (Google) y de los enlaces mágicos.
 *
 * El proveedor devuelve un `code` de un solo uso; aquí se canjea por la sesión
 * y las cookies se escriben en la respuesta de redirección. El intercambio
 * ocurre en el servidor —flujo PKCE— para que el token de refresco no pase
 * nunca por el JavaScript de la página.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");
  const errorProveedor = url.searchParams.get("error_description") ?? url.searchParams.get("error");

  const origen = process.env.NEXT_PUBLIC_APP_URL ?? url.origin;

  if (errorProveedor) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(errorProveedor)}`, origen)
    );
  }

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=codigo_ausente", origen));
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.redirect(new URL("/login?error=sin_configuracion", origen));
  }

  // La respuesta se crea antes del intercambio: es el objeto sobre el que
  // Supabase escribe las cookies de sesión.
  const respuesta = NextResponse.redirect(new URL("/cuenta", origen));

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (cookies: { name: string; value: string; options?: Record<string, unknown> }[]) => {
        cookies.forEach(({ name, value, options }) => respuesta.cookies.set(name, value, options));
      },
    },
  });

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error?.message ?? "sesion_invalida")}`, origen)
    );
  }

  // Se reutiliza la misma respuesta —la que lleva las cookies de sesión— y
  // sólo se reescribe el destino. Crear una nueva aquí perdería las cookies.
  const destino =
    next && next.startsWith("/") && !next.startsWith("//")
      ? next
      : DESTINO_POR_ROL[resolverRol(data.user)];
  respuesta.headers.set("location", new URL(destino, origen).toString());
  return respuesta;
}
