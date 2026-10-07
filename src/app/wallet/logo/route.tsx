import { ImageResponse } from "next/og";

export const runtime = "edge";

/**
 * Logotipo PNG para el programa de lealtad en Google Wallet, que no acepta
 * SVG: las iniciales de CortMart sobre su naranja. Se sustituye por el
 * logo real con GOOGLE_WALLET_LOGO_URL.
 */
export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          // Wallet muestra el logo recortado en círculo: fondo naranja a sangre
          background: "#f7931e",
          color: "#120802",
          fontSize: 270,
          letterSpacing: -6,
          // Satori no trae negritas: el trazo se engrosa con sombras
          textShadow: "4px 0 0 #120802, -4px 0 0 #120802, 0 4px 0 #120802, 0 -4px 0 #120802, 3px 3px 0 #120802, -3px -3px 0 #120802, 3px -3px 0 #120802, -3px 3px 0 #120802",
        }}
      >
        CM
      </div>
    ),
    { width: 660, height: 660, headers: { "Cache-Control": "public, max-age=86400" } }
  );
}
