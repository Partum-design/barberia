import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { MODO_LOCAL } from "@/lib/modo";

// POST /api/otp/verify — comprueba el código y marca telefono_verificado.
// En modo local acepta el código 000000.
export async function POST(req: NextRequest) {
  const { telefono, codigo } = (await req.json().catch(() => ({}))) as {
    telefono?: string;
    codigo?: string;
  };

  if (!telefono || !codigo) {
    return NextResponse.json({ error: "Faltan teléfono o código" }, { status: 400 });
  }

  if (MODO_LOCAL || !process.env.TWILIO_ACCOUNT_SID) {
    const ok = codigo === "000000";
    return ok
      ? NextResponse.json({ verificado: true, local: true })
      : NextResponse.json({ error: "Código incorrecto (modo local: usa 000000)" }, { status: 400 });
  }

  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SERVICE_SID } = process.env;
  const res = await fetch(
    `https://verify.twilio.com/v2/Services/${TWILIO_VERIFY_SERVICE_SID}/VerificationCheck`,
    {
      method: "POST",
      headers: {
        Authorization:
          "Basic " + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: telefono, Code: codigo }),
    }
  );
  const data = await res.json();
  if (data.status !== "approved") {
    return NextResponse.json({ error: "Código incorrecto o expirado" }, { status: 400 });
  }

  // Marca el teléfono como verificado en el perfil del usuario autenticado.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("usuarios")
    .update({ telefono, telefono_verificado: true })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: "No fue posible guardar la verificación" }, { status: 500 });
  }
  return NextResponse.json({ verificado: true });
}
