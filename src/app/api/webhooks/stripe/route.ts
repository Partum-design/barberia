import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";

// POST /api/webhooks/stripe — confirma pagos de citas y suscripciones SaaS.
// El body debe leerse crudo para verificar la firma.
export async function POST(req: NextRequest) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secretKey || !webhookSecret) {
    return NextResponse.json({ error: "Stripe no configurado" }, { status: 503 });
  }

  const stripe = new Stripe(secretKey);
  const payload = await req.text();
  const signature = req.headers.get("stripe-signature");

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature ?? "", webhookSecret);
  } catch {
    return NextResponse.json({ error: "Firma inválida" }, { status: 400 });
  }

  const admin = createAdminClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const citaId = session.metadata?.cita_id;
      if (!citaId) break;

      // 1) Registra el pago como pagado
      await admin
        .from("pagos")
        .update({ estado: "pagado", pagado_en: new Date().toISOString() })
        .eq("cita_id", citaId);

      // 2) Confirma la cita y desactiva la expiración del bloqueo.
      //    El trigger de fidelización se dispara después, al marcarla 'asistida'.
      await admin
        .from("citas")
        .update({ estado: "confirmada", bloqueo_expira_en: null })
        .eq("id", citaId)
        .in("estado", ["bloqueada", "pendiente_pago"]);
      break;
    }

    case "charge.refunded": {
      const charge = event.data.object;
      const intentId =
        typeof charge.payment_intent === "string"
          ? charge.payment_intent
          : charge.payment_intent?.id;
      if (intentId) {
        await admin
          .from("pagos")
          .update({ estado: "reembolsado" })
          .eq("stripe_payment_intent_id", intentId);
      }
      break;
    }

    case "invoice.paid": {
      // Suscripción SaaS de la barbería al corriente
      const invoice = event.data.object;
      const subId =
        typeof invoice.subscription === "string"
          ? invoice.subscription
          : invoice.subscription?.id;
      if (subId) {
        await admin
          .from("barberias")
          .update({ suscripcion_activa: true })
          .eq("stripe_subscription_id", subId);
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
