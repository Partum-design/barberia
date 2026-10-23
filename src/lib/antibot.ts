import { createHmac, timingSafeEqual } from "node:crypto";

// Defensa contra bots y spam en los formularios públicos (reservar sin
// cuenta, crear cuenta, crear contraseña). Tres capas, ninguna molesta a una
// persona real:
//
//   1. Campo trampa: un campo oculto que sólo llenan los bots.
//   2. Ficha del formulario: el servidor firma la hora en que se abrió el
//      formulario. Se rechaza si se envía en menos de 2 s (nadie escribe su
//      nombre y celular tan rápido), si tiene más de 2 h o si la firma no cuadra.
//   3. Cloudflare Turnstile: sólo si existen NEXT_PUBLIC_TURNSTILE_SITE_KEY y
//      TURNSTILE_SECRET_KEY. Sin llaves, las dos capas anteriores bastan.
//
// Se suma al límite de intentos por IP y por número (lib/limites).

const MIN_MS = 2_000;
const MAX_MS = 2 * 60 * 60_000;

function secreto() {
  const base = process.env.ANTIBOT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!base) throw new Error("Falta ANTIBOT_SECRET o SUPABASE_SERVICE_ROLE_KEY");
  // Derivado: la llave de servicio nunca se usa tal cual fuera de Supabase.
  return createHmac("sha256", base).update("antibot-formularios-v1").digest();
}

const firmar = (ts: string) => createHmac("sha256", secreto()).update(ts).digest("base64url");

/** Ficha que el navegador pide al abrir el formulario. */
export function fichaNueva() {
  const ts = String(Date.now());
  return `${ts}.${firmar(ts)}`;
}

export type Antibot = { ficha?: string; trampa?: string; turnstile?: string };

/** Mensaje de error si la petición parece de un bot; null si pasa. */
export async function revisarAntibot(datos: Antibot | undefined, ip: string): Promise<string | null> {
  const generico = "No pudimos verificar el formulario. Recarga la página e inténtalo de nuevo.";
  if (!datos) return generico;
  if (datos.trampa) return generico;

  const [ts, firma] = String(datos.ficha ?? "").split(".");
  if (!ts || !firma) return generico;
  const esperada = Buffer.from(firmar(ts));
  const recibida = Buffer.from(firma);
  if (esperada.length !== recibida.length || !timingSafeEqual(esperada, recibida)) return generico;
  const edad = Date.now() - Number(ts);
  if (!Number.isFinite(edad) || edad < MIN_MS) return "Vas muy rápido. Revisa tus datos y vuelve a confirmar.";
  if (edad > MAX_MS) return "El formulario caducó. Recarga la página e inténtalo de nuevo.";

  const llave = process.env.TURNSTILE_SECRET_KEY;
  if (llave && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) {
    if (!datos.turnstile) return "Completa la verificación de seguridad.";
    try {
      const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: llave, response: datos.turnstile, remoteip: ip }),
      });
      const r = (await res.json()) as { success?: boolean };
      if (!r.success) return "La verificación de seguridad falló. Inténtalo de nuevo.";
    } catch (err) {
      // Si Cloudflare no responde, no se bloquea a los clientes: quedan las
      // otras capas y los límites de intentos.
      console.error("Turnstile no respondió:", err);
    }
  }
  return null;
}
