import { NextResponse, type NextRequest } from "next/server";

/**
 * Logotipo del programa de lealtad en Google Wallet: el monograma CM en blanco
 * sobre negro (public/marca/logo-cm-wallet.png). Se conserva esta ruta para
 * los pases que ya apuntan aquí; se sustituye con GOOGLE_WALLET_LOGO_URL.
 */
export function GET(req: NextRequest) {
  return NextResponse.redirect(new URL("/marca/logo-cm-wallet.png", req.url), 308);
}
