import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const TIPOS: EmailOtpType[] = ["email_change", "email", "signup"];

/**
 * Botón del correo "Confirma tu correo" (plantilla cambiar-correo.html). Usa
 * token_hash, así que funciona aunque se abra en otro teléfono o navegador.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const origen = process.env.NEXT_PUBLIC_APP_URL ?? url.origin;
  const tokenHash = url.searchParams.get("token_hash");
  const tipo = url.searchParams.get("type") as EmailOtpType | null;
  if (!tokenHash || !tipo || !TIPOS.includes(tipo)) {
    return NextResponse.redirect(new URL("/cuenta?correo=error", origen));
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: tipo });
  return NextResponse.redirect(new URL(`/cuenta?correo=${error ? "error" : "ok"}`, origen));
}
