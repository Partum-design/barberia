import { NextResponse, type NextRequest } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientePorTelefono, cuentaDeCliente, usuarioPorId } from "@/lib/auth/cuentas";
import { esCorreoInterno, pareceTelefono } from "@/lib/auth/telefono";
import { DIAS_SOLICITUD, pistaDeCorreo } from "@/lib/auth/restablecer";
import { leerEstado } from "@/lib/datos/servidor";
import { normalizarTelefono } from "@/lib/datos/modelo";
import { dentroDelLimite, ESPERA, ipDe } from "@/lib/limites";

export const dynamic = "force-dynamic";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Respuesta =
  | { estado: "correo"; pista: string }
  | { estado: "solicitud"; telefono: string }
  | { estado: "no_existe" }
  | { estado: "sin_clave" }
  | { estado: "google"; pista: string };

const responder = (cuerpo: Respuesta | { error: string }, status = 200) => NextResponse.json(cuerpo, { status });

/** Envía el correo de Supabase Auth (plantilla supabase/templates/recuperar-contrasena.html). */
async function enviarCorreo(email: string, origen: string) {
  const supabase = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, flowType: "implicit" },
  });
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origen}/restablecer` });
  if (error) throw error;
}

const soloGoogle = (identidades: { provider: string }[] | undefined) =>
  (identidades ?? []).length > 0 && (identidades ?? []).every((i) => i.provider === "google");

/**
 * POST /api/auth/recuperar — "¿Olvidaste tu contraseña?".
 *
 *   · Correo registrado        → correo con enlace de un solo uso (30 min).
 *   · Celular con correo real  → el mismo correo, a la dirección de la cuenta.
 *   · Celular sin correo       → solicitud para que la barbería la atienda.
 *   · No existe                → se dice tal cual (el dueño lo permite).
 *
 * Límite: 5 solicitudes por hora por IP y 3 por cuenta.
 */
export async function POST(req: NextRequest) {
  const body = ((await req.json().catch(() => null)) ?? {}) as { identificador?: string };
  const valor = String(body.identificador ?? "").trim();
  if (!valor) return responder({ error: "Escribe tu celular o correo." }, 400);
  const esCorreo = valor.includes("@");
  if (esCorreo ? !EMAIL.test(valor) : !pareceTelefono(valor) || normalizarTelefono(valor).length !== 10) {
    return responder({ error: "Escribe un celular de 10 dígitos o un correo válido." }, 400);
  }

  if (!(await dentroDelLimite(`recuperar:ip:${ipDe(req)}`, 5, 3600))) return responder({ error: ESPERA }, 429);

  const origen = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;
  const admin = createAdminClient();

  try {
    if (esCorreo) {
      const email = valor.toLowerCase();
      const { data } = await admin.rpc("fn_usuario_por_correo", { p_email: email });
      const fila = (Array.isArray(data) ? data[0] : data) as { id: string } | undefined;
      if (!fila || esCorreoInterno(email)) return responder({ estado: "no_existe" });
      if (!(await dentroDelLimite(`recuperar:cuenta:${fila.id}`, 3, 3600))) return responder({ error: ESPERA }, 429);
      await enviarCorreo(email, origen);
      return responder({ estado: "correo", pista: pistaDeCorreo(email) });
    }

    const telefono = normalizarTelefono(valor);
    const { estado } = await leerEstado();
    const cliente = clientePorTelefono(estado, telefono);
    if (!cliente) return responder({ estado: "no_existe" });
    if (!(await dentroDelLimite(`recuperar:cuenta:${cliente.id}`, 3, 3600))) return responder({ error: ESPERA }, 429);

    const cuentaId = cuentaDeCliente(cliente);
    const usuario = cuentaId ? await usuarioPorId(cuentaId) : null;
    // Lo registraron en la barbería o reservó con su número: aún no tiene
    // contraseña, la crea al entrar con su número.
    if (!usuario) return responder({ estado: "sin_clave" });

    if (usuario.email && !esCorreoInterno(usuario.email)) {
      if (soloGoogle(usuario.identities)) return responder({ estado: "google", pista: pistaDeCorreo(usuario.email) });
      await enviarCorreo(usuario.email, origen);
      return responder({ estado: "correo", pista: pistaDeCorreo(usuario.email) });
    }

    // Sólo celular: se avisa a la barbería (sin duplicar una solicitud abierta).
    const desde = new Date(Date.now() - DIAS_SOLICITUD * 86_400_000).toISOString();
    const { data: abierta } = await admin
      .from("solicitudes_restablecimiento")
      .select("id")
      .eq("cliente_id", cliente.id)
      .eq("estado", "pendiente")
      .gte("creada_en", desde)
      .limit(1);
    if (!abierta?.length) {
      const { error } = await admin
        .from("solicitudes_restablecimiento")
        .insert({ cliente_id: cliente.id, usuario_id: usuario.id });
      if (error) throw error;
    }
    return responder({ estado: "solicitud", telefono });
  } catch (err) {
    console.error("Recuperar contraseña:", err);
    const mensaje = err instanceof Error ? err.message : "";
    if (/rate limit|too many|seconds/i.test(mensaje)) return responder({ error: ESPERA }, 429);
    return responder({ error: "No pudimos completar la solicitud. Intenta de nuevo o llama a la barbería." }, 500);
  }
}
