import { ImageResponse } from "next/og";

export const runtime = "edge";

/**
 * Logotipo PNG para el programa de lealtad en Google Wallet, que no acepta
 * SVG. Se sustituye por el logo real con GOOGLE_WALLET_LOGO_URL.
 */
export function GET() {
  const nombre = process.env.NEXT_PUBLIC_NOMBRE_NEGOCIO || "Barbería";
  const inicial = nombre.trim().charAt(0).toUpperCase() || "B";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#14100b",
        }}
      >
        <div
          style={{
            width: 520,
            height: 520,
            borderRadius: 9999,
            border: "18px solid #d7b46a",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#e6c576",
            fontSize: 300,
            fontWeight: 700,
          }}
        >
          {inicial}
        </div>
      </div>
    ),
    { width: 660, height: 660, headers: { "Cache-Control": "public, max-age=86400" } }
  );
}
