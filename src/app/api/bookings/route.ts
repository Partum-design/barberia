import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DEMO_MODE } from "@/lib/demo";

// POST /api/bookings — bloquea un slot por 10 minutos para iniciar checkout.
// Defensas en capas: rate limit (middleware) → Turnstile → sesión → RPC
// fn_bloquear_slot (OTP verificado + anti-hoarding + exclusion constraint).

async function verifyTurnstile(token: string | undefined, ip: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return DEMO_MODE; // sin llave solo se permite en demo
  if (!token) return false;

  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret, response: token, remoteip: ip }),
  });
  const data = await res.json();
  return data.success === true;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "";
  const body = await req.json().catch(() => null);
  if (!body?.barbero_id || !body?.inicio || !body?.fin) {
    return NextResponse.json({ error: "Parámetros incompletos" }, { status: 400 });
  }

  const humano = await verifyTurnstile(body.turnstile_token, ip);
  if (!humano) {
    return NextResponse.json(
      { error: "Verificación antibots fallida" },
      { status: 403 }
    );
  }

  if (DEMO_MODE) {
    // Sin backend real: simula el bloqueo del slot para la demo pública.
    return NextResponse.json({
      cita_id: `demo-${crypto.randomUUID()}`,
      estado: "bloqueada",
      bloqueo_expira_en: new Date(Date.now() + 10 * 60_000).toISOString(),
      demo: true,
    });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  // La RPC valida OTP, límite de bloqueos simultáneos y solapes.
  const { data: citaId, error } = await supabase.rpc("fn_bloquear_slot", {
    p_barbero_id: body.barbero_id,
    p_inicio: body.inicio,
    p_fin: body.fin,
    p_modalidad: body.modalidad ?? "presencial",
    p_metodo_pago: body.metodo_pago ?? "tarjeta",
  });

  if (error) {
    const conocido =
      error.message.includes("Teléfono no verificado") ||
      error.message.includes("Límite de reservas") ||
      error.message.includes("Barbero no disponible");
    return NextResponse.json(
      { error: conocido ? error.message : "No fue posible reservar el horario" },
      { status: conocido ? 409 : 500 }
    );
  }

  return NextResponse.json({
    cita_id: citaId,
    estado: "bloqueada",
    bloqueo_expira_en: new Date(Date.now() + 10 * 60_000).toISOString(),
  });
}
