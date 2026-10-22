import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sesionDePeticion } from "@/lib/datos/servidor";

export const dynamic = "force-dynamic";

type Suscripcion = { endpoint?: string; keys?: { p256dh?: string; auth?: string } };

/** POST /api/push — guarda la suscripción push de este navegador para la sesión. */
export async function POST(req: NextRequest) {
  const sesion = await sesionDePeticion();
  if (!sesion) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });
  const s = ((await req.json().catch(() => null)) ?? {}) as Suscripcion;
  if (!s.endpoint?.startsWith("https://") || !s.keys?.p256dh || !s.keys?.auth) {
    return NextResponse.json({ error: "Suscripción inválida." }, { status: 400 });
  }
  const { error } = await createAdminClient().from("push_suscripciones").upsert({
    endpoint: s.endpoint,
    usuario_id: sesion.id,
    p256dh: s.keys.p256dh,
    auth: s.keys.auth,
  });
  if (error) return NextResponse.json({ error: "No se pudo guardar." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** DELETE /api/push — deja de mandar avisos a este navegador. */
export async function DELETE(req: NextRequest) {
  const sesion = await sesionDePeticion();
  if (!sesion) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });
  const { endpoint } = ((await req.json().catch(() => null)) ?? {}) as { endpoint?: string };
  if (endpoint) {
    await createAdminClient().from("push_suscripciones").delete().eq("endpoint", endpoint).eq("usuario_id", sesion.id);
  }
  return NextResponse.json({ ok: true });
}
