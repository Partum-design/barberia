// Verificación por SMS con Twilio Verify. Si no hay credenciales, el alta con
// teléfono funciona sin código (el número lo capturó el personal en mostrador).

export const smsDisponible = () =>
  Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_VERIFY_SERVICE_SID);

const e164 = (diezDigitos: string) => `+52${diezDigitos}`;

function autorizacion() {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = process.env;
  return "Basic " + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");
}

export async function enviarCodigo(telefono: string) {
  const res = await fetch(`https://verify.twilio.com/v2/Services/${process.env.TWILIO_VERIFY_SERVICE_SID}/Verifications`, {
    method: "POST",
    headers: { Authorization: autorizacion(), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ To: e164(telefono), Channel: "sms" }),
  });
  return res.ok;
}

export async function codigoValido(telefono: string, codigo: string) {
  const res = await fetch(
    `https://verify.twilio.com/v2/Services/${process.env.TWILIO_VERIFY_SERVICE_SID}/VerificationCheck`,
    {
      method: "POST",
      headers: { Authorization: autorizacion(), "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: e164(telefono), Code: codigo }),
    }
  );
  const data = (await res.json().catch(() => ({}))) as { status?: string };
  return data.status === "approved";
}
