import { NextResponse } from "next/server";
import { sesionDePeticion } from "@/lib/datos/servidor";
import { calendarioDisponible, quitarVinculo, tieneVinculo } from "@/lib/integrations/google-calendar";
import { esCorreoInterno } from "@/lib/auth/telefono";

export const dynamic = "force-dynamic";

/** GET — ¿la sesión tiene su Google Calendar vinculado? */
export async function GET() {
  const sesion = await sesionDePeticion();
  if (!sesion) return NextResponse.json({ vinculado: false, disponible: calendarioDisponible() });
  const vinculo = await tieneVinculo(sesion.id);
  // El correo interno de las cuentas por número no se muestra.
  const email = vinculo?.email && !esCorreoInterno(vinculo.email) ? vinculo.email : null;
  return NextResponse.json({ vinculado: Boolean(vinculo), email, disponible: calendarioDisponible() });
}

/**
 * DELETE — deja de sincronizar sus citas con Google Calendar: borra el vínculo
 * (refresh token) en google_calendario. Los eventos que ya están en su
 * calendario no se tocan.
 */
export async function DELETE() {
  const sesion = await sesionDePeticion();
  if (!sesion) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });
  await quitarVinculo(sesion.id);
  return NextResponse.json({ ok: true });
}
