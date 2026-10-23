import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { esCorreoInterno } from "@/lib/auth/telefono";

export const dynamic = "force-dynamic";

/**
 * GET /api/cuenta/acceso — datos de acceso de quien pregunta, para "Mi cuenta":
 * su correo (si tiene uno real), el que está por confirmar y la fecha del
 * último cambio de contraseña.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Inicia sesión para continuar." }, { status: 401 });
  const meta = user.app_metadata ?? {};
  const real = (correo?: string | null) => (correo && !esCorreoInterno(correo) ? correo : "");
  return NextResponse.json(
    {
      correo: real(user.email),
      correo_pendiente: real(user.new_email),
      con_clave: (user.identities ?? []).some((i) => i.provider === "email"),
      clave_cambiada_en: typeof meta.clave_cambiada_en === "string" ? meta.clave_cambiada_en : null,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
