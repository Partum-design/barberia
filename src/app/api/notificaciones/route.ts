import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sesionDePeticion } from "@/lib/datos/servidor";

export const dynamic = "force-dynamic";

/** GET /api/notificaciones — los últimos avisos de quien pregunta. */
export async function GET() {
  const sesion = await sesionDePeticion();
  if (!sesion) return NextResponse.json({ avisos: [], sinLeer: 0 });
  const { data } = await createAdminClient()
    .from("notificaciones")
    .select("id, titulo, cuerpo, url, leida, creado_en")
    .eq("usuario_id", sesion.id)
    .order("creado_en", { ascending: false })
    .limit(30);
  const avisos = data ?? [];
  return NextResponse.json(
    { avisos, sinLeer: avisos.filter((a) => !a.leida).length },
    { headers: { "Cache-Control": "no-store" } }
  );
}

/** POST /api/notificaciones — marca todos como leídos. */
export async function POST(_req: NextRequest) {
  const sesion = await sesionDePeticion();
  if (!sesion) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });
  await createAdminClient().from("notificaciones").update({ leida: true }).eq("usuario_id", sesion.id).eq("leida", false);
  return NextResponse.json({ ok: true });
}
