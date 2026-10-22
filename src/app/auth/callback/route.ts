import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { after } from "next/server";
import { DESTINO_POR_ROL, resolverRol, sesionDesdeUsuario } from "@/lib/auth/roles";
import { prepararCuentaGoogle, usuarioPorId } from "@/lib/auth/cuentas";
import { guardarVinculo, sincronizarProximas } from "@/lib/integrations/google-calendar";
import { leerEstado } from "@/lib/datos/servidor";

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
  const conCalendario = url.searchParams.get("calendario") === "1";
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

  // Entró o vinculó con Google: se le asigna rol de cliente (si es nuevo) y se
  // une con su ficha de la barbería.
  let usuario = data.user;
  const conGoogle = (usuario.identities ?? []).some((i) => i.provider === "google");
  if (conGoogle) {
    try {
      await prepararCuentaGoogle(usuario);
      usuario = (await usuarioPorId(usuario.id)) ?? usuario;
    } catch (err) {
      console.error("No se pudo preparar la cuenta de Google:", err);
    }
  }

  // Permiso de calendario: el refresh token sólo llega en este momento.
  const refresh = data.session?.provider_refresh_token;
  if (conCalendario && refresh) {
    const sesion = sesionDesdeUsuario(usuario);
    await guardarVinculo(sesion.id, refresh, usuario.email ?? null);
    after(async () => {
      const { estado } = await leerEstado();
      await sincronizarProximas(sesion.id, estado, origen);
    });
  }

  // Se reutiliza la misma respuesta —la que lleva las cookies de sesión— y
  // sólo se reescribe el destino. Crear una nueva aquí perdería las cookies.
  const destinoBase =
    next && next.startsWith("/") && !next.startsWith("//")
      ? next
      : DESTINO_POR_ROL[resolverRol(usuario)];
  const destino = conCalendario
    ? `${destinoBase}${destinoBase.includes("?") ? "&" : "?"}calendario=${refresh ? "ok" : "sin_permiso"}`
    : destinoBase;
  respuesta.headers.set("location", new URL(destino, origen).toString());
  return respuesta;
}
