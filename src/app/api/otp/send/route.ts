import { NextRequest, NextResponse } from "next/server";
import { MODO_LOCAL } from "@/lib/modo";

// POST /api/otp/send — envía un código de verificación por SMS/WhatsApp
// usando Twilio Verify. En modo local devuelve éxito sin enviar nada.
export async function POST(req: NextRequest) {
  const { telefono, canal } = (await req.json().catch(() => ({}))) as {
    telefono?: string;
    canal?: "sms" | "whatsapp";
  };

  if (!telefono || !/^\+\d{10,15}$/.test(telefono)) {
    return NextResponse.json(
      { error: "Teléfono inválido. Usa formato E.164, ej. +5215512345678" },
      { status: 400 }
    );
  }

  if (MODO_LOCAL || !process.env.TWILIO_ACCOUNT_SID) {
    return NextResponse.json({ enviado: true, local: true });
  }

  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SERVICE_SID } = process.env;
  const res = await fetch(
    `https://verify.twilio.com/v2/Services/${TWILIO_VERIFY_SERVICE_SID}/Verifications`,
    {
      method: "POST",
      headers: {
        Authorization:
          "Basic " + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: telefono, Channel: canal ?? "sms" }),
    }
  );

  if (!res.ok) {
    return NextResponse.json({ error: "No fue posible enviar el código" }, { status: 502 });
  }
  return NextResponse.json({ enviado: true });
}
