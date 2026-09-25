import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Estado de configuración de cada integración.
 *
 * Sólo se devuelve **si** cada variable está definida, nunca su valor: la
 * pantalla necesita saber qué falta por configurar, y ningún secreto tiene por
 * qué viajar al navegador para responder a eso.
 */
const REQUISITOS: Record<string, string[]> = {
  "google-analytics": [
    "GA4_PROPERTY_ID",
    "GOOGLE_SERVICE_ACCOUNT_EMAIL",
    "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
  ],
  "google-ads": [
    "GOOGLE_ADS_DEVELOPER_TOKEN",
    "GOOGLE_ADS_CUSTOMER_ID",
    "GOOGLE_ADS_CLIENT_ID",
    "GOOGLE_ADS_CLIENT_SECRET",
    "GOOGLE_ADS_REFRESH_TOKEN",
  ],
  "meta-ads": ["META_ADS_ACCOUNT_ID", "META_ADS_ACCESS_TOKEN"],
  stripe: ["STRIPE_SECRET_KEY", "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "STRIPE_WEBHOOK_SECRET"],
  "mercado-pago": ["MERCADOPAGO_ACCESS_TOKEN", "NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY"],
  "google-auth": ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"],
  "google-calendar": ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
  "google-wallet": [
    "GOOGLE_WALLET_ISSUER_ID",
    "GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL",
    "GOOGLE_WALLET_PRIVATE_KEY",
  ],
};

// Wallet puede reutilizar la cuenta de servicio de GA4 en lugar de la suya.
const ALTERNATIVAS: Record<string, string> = {
  GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL: "GOOGLE_SERVICE_ACCOUNT_EMAIL",
  GOOGLE_WALLET_PRIVATE_KEY: "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
};

const definida = (nombre: string) =>
  Boolean(process.env[nombre] || (ALTERNATIVAS[nombre] && process.env[ALTERNATIVAS[nombre]]));

export async function GET() {
  const estado = Object.fromEntries(
    Object.entries(REQUISITOS).map(([id, variables]) => [
      id,
      {
        variables: variables.map((nombre) => ({ nombre, definida: definida(nombre) })),
        conectada: variables.every(definida),
      },
    ])
  );

  return NextResponse.json(estado, { headers: { "Cache-Control": "no-store" } });
}
