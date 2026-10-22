import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "edge";

/**
 * Ícono de la app: las iniciales de CortMart sobre su naranja. `?t=` es el
 * tamaño y `?m=1` la versión "maskable" (con margen para el recorte de Android).
 */
export function GET(req: NextRequest) {
  const t = Math.min(1024, Math.max(48, Number(req.nextUrl.searchParams.get("t")) || 512));
  const maskable = req.nextUrl.searchParams.get("m") === "1";
  const letra = Math.round(t * (maskable ? 0.32 : 0.42));
  const borde = Math.max(1, Math.round(t / 160));
  const sombra = [`${borde}px 0 0 #120802`, `-${borde}px 0 0 #120802`, `0 ${borde}px 0 #120802`, `0 -${borde}px 0 #120802`].join(", ");
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "radial-gradient(circle at 30% 25%, #ffb347, #f7931e 55%, #c25e0a)",
          borderRadius: maskable ? 0 : Math.round(t * 0.22),
          color: "#120802",
          fontSize: letra,
          letterSpacing: -Math.round(t / 90),
          textShadow: sombra,
        }}
      >
        CM
      </div>
    ),
    { width: t, height: t, headers: { "Cache-Control": "public, max-age=604800, immutable" } }
  );
}
