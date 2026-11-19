import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { esCorreoInterno } from "@/lib/auth/telefono";

export const dynamic = "force-dynamic";

/**
 * GET /api/cuenta/google — ¿la cuenta de quien pregunta tiene Google ligado
 * como forma de entrar? Para «Cuentas conectadas». Se decide en el servidor
 * con el usuario de Auth, no con lo que diga el navegador.
 *
 * `puede_desvincular`: Supabase no deja quitar la última forma de entrar, así
 * que sólo se ofrece si además tiene número/correo con contraseña.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Inicia sesión para continuar." }, { status: 401 });
  const identidades = user.identities ?? [];
  const google = identidades.find((i) => i.provider === "google");
  const correoGoogle = (google?.identity_data?.email as string | undefined) ?? null;
  return NextResponse.json(
    {
      conectada: Boolean(google),
      email: correoGoogle && !esCorreoInterno(correoGoogle) ? correoGoogle : null,
      puede_desvincular: Boolean(google) && identidades.some((i) => i.provider !== "google"),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
