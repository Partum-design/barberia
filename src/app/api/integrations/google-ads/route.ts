import { NextResponse } from "next/server";
import { obtenerAds } from "@/lib/integrations/google-ads";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const datos = await obtenerAds();
  return NextResponse.json(datos, {
    headers: {
      "Cache-Control": "private, max-age=0, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
