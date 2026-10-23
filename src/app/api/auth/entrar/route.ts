import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolverRol } from "@/lib/auth/roles";
import { clientePorTelefono, cuentaDeCliente, usuarioPorId } from "@/lib/auth/cuentas";
import { correoDeTelefono, pareceTelefono } from "@/lib/auth/telefono";
import { leerEstado } from "@/lib/datos/servidor";
import { normalizarTelefono } from "@/lib/datos/modelo";
import { bloqueadoHasta, dentroDelLimite, ESPERA, ipDe, olvidarFallos, registrarFallo } from "@/lib/limites";

export const dynamic = "force-dynamic";

/** Fallos seguidos antes de pausar la cuenta, y cuánto dura la pausa. */
const FALLOS_MAX = 5;
const PAUSA_SEG = 5 * 60;

const responder = (cuerpo: Record<string, unknown>, status = 200) => NextResponse.json(cuerpo, { status });

/** Correo con el que la cuenta inicia sesión en Supabase Auth. */
async function correoDeAcceso(identificador: string): Promise<string | null> {
  const valor = identificador.trim();
  if (valor.includes("@")) return valor.toLowerCase();
  if (!pareceTelefono(valor)) return null;
  const telefono = normalizarTelefono(valor);
  const { estado } = await leerEstado();
  const cliente = clientePorTelefono(estado, telefono);
  const cuentaId = cliente ? cuentaDeCliente(cliente) : null;
  const usuario = cuentaId ? await usuarioPorId(cuentaId) : null;
  // Si dio de alta un correo, entra con él aunque escriba su número.
  return usuario?.email ?? correoDeTelefono(telefono);
}

/**
 * POST /api/auth/entrar — inicio de sesión con contraseña (celular o correo).
 *
 * Se hace en el servidor para poder limitar los intentos: 10 por minuto por
 * IP y, tras 5 contraseñas incorrectas seguidas, la cuenta espera 5 minutos.
 * Las cookies de sesión se escriben en esta misma respuesta.
 */
export async function POST(req: NextRequest) {
  const body = ((await req.json().catch(() => null)) ?? {}) as { identificador?: string; password?: string };
  const identificador = String(body.identificador ?? "");
  const password = String(body.password ?? "");
  if (!identificador.trim()) return responder({ error: "Escribe tu celular o correo." }, 400);
  if (!password) return responder({ error: "Escribe tu contraseña." }, 400);

  if (!(await dentroDelLimite(`entrar:ip:${ipDe(req)}`, 10, 60))) {
    return responder({ error: `Demasiados intentos. ${ESPERA}` }, 429);
  }

  const email = await correoDeAcceso(identificador);
  if (!email) return responder({ error: "Escribe un celular de 10 dígitos o un correo válido." }, 400);

  const claveFallos = `fallos:${email}`;
  const pausa = await bloqueadoHasta(claveFallos);
  if (pausa) {
    const minutos = Math.max(1, Math.ceil((pausa.getTime() - Date.now()) / 60_000));
    return responder(
      {
        error: `Escribiste mal la contraseña varias veces. Espera ${minutos} ${minutos === 1 ? "minuto" : "minutos"} o recupérala.`,
        bloqueado: true,
      },
      429
    );
  }

  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" }).catch(() => {});
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    if (/email not confirmed/i.test(error?.message ?? "")) {
      return responder({ error: "Tu correo aún no está confirmado. Revisa tu bandeja de entrada." }, 401);
    }
    const bloqueo = await registrarFallo(claveFallos, FALLOS_MAX, PAUSA_SEG);
    return responder(
      bloqueo
        ? { error: "Escribiste mal la contraseña 5 veces. Espera 5 minutos o recupérala.", bloqueado: true }
        : { error: "La contraseña no es correcta." },
      bloqueo ? 429 : 401
    );
  }

  await olvidarFallos(claveFallos);
  return responder({ rol: resolverRol(data.user) });
}
