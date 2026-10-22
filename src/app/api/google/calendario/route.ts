import { NextResponse } from "next/server";
import { sesionDePeticion } from "@/lib/datos/servidor";
import { calendarioDisponible, quitarVinculo, tieneVinculo } from "@/lib/integrations/google-calendar";

export const dynamic = "force-dynamic";

/** GET — ¿la sesión tiene su Google Calendar vinculado? */
export async function GET() {
  const sesion = await sesionDePeticion();
  if (!sesion) return NextResponse.json({ vinculado: false, disponible: calendarioDisponible() });
  const vinculo = await tieneVinculo(sesion.id);
  return NextResponse.json({ vinculado: Boolean(vinculo), email: vinculo?.email ?? null, disponible: calendarioDisponible() });
}

/** DELETE — deja de sincronizar sus citas con Google Calendar. */
export async function DELETE() {
  const sesion = await sesionDePeticion();
  if (!sesion) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });
  await quitarVinculo(sesion.id);
  return NextResponse.json({ ok: true });
}
