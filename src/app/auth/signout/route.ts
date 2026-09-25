import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export const dynamic = "force-dynamic";

/**
 * Cierre de sesión del lado del servidor: revoca la sesión en Supabase y borra
 * las cookies. Es POST a propósito —un GET podría dispararse desde una imagen
 * o un prefetch y cerrar la sesión sin que el usuario lo pidiera.
 */
export async function POST(req: NextRequest) {
  const origen = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
  const respuesta = NextResponse.redirect(new URL("/", origen), { status: 303 });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return respuesta;

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (cookies: { name: string; value: string; options?: Record<string, unknown> }[]) => {
        cookies.forEach(({ name, value, options }) => respuesta.cookies.set(name, value, options));
      },
    },
  });

  await supabase.auth.signOut();
  return respuesta;
}
