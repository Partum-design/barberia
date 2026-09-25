import { NextResponse } from "next/server";
import { obtenerAnalytics } from "@/lib/integrations/analytics";

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // La firma RS256 del JWT necesita `node:crypto`.

export async function GET() {
  const datos = await obtenerAnalytics();
  return NextResponse.json(datos, {
    headers: {
      // Una cache corta y compartida evita martillear la API cuando varias
      // personas del equipo abren el panel a la vez, sin que los datos se
      // queden viejos de forma perceptible.
      "Cache-Control": "private, max-age=0, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
