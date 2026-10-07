import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolverRol } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/sesion — ¿el servidor ve la sesión que acaba de abrir el
 * navegador? El login lo consulta antes de redirigir: si las cookies no
 * llegaron, el middleware devolvería a /login sin explicar nada.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return NextResponse.json(
    { rol: user ? resolverRol(user) : null },
    { headers: { "Cache-Control": "no-store" } }
  );
}
