import { NextResponse } from "next/server";
import { fichaNueva } from "@/lib/antibot";

export const dynamic = "force-dynamic";

/** GET /api/antibot — ficha firmada para el formulario que se acaba de abrir. */
export function GET() {
  return NextResponse.json({ ficha: fichaNueva() }, { headers: { "Cache-Control": "no-store" } });
}
