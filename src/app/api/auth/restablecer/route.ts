import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolverRol } from "@/lib/auth/roles";
import { aplicarNuevaClave, clientePorId, tokenVigente } from "@/lib/auth/restablecer";
import { leerEstado } from "@/lib/datos/servidor";
import { ErrorOperacion } from "@/lib/datos/modelo";
import { dentroDelLimite, ESPERA, ipDe } from "@/lib/limites";

export const dynamic = "force-dynamic";

const responder = (cuerpo: Record<string, unknown>, status = 200) => NextResponse.json(cuerpo, { status });
const NO_FUNCIONA = "Este enlace ya no funciona.";

/**
 * POST /api/auth/restablecer
 *
 *   · validar  → ¿el enlace de la barbería sigue vigente? (no lo gasta)
 *   · guardar  → gasta el enlace, pone la contraseña nueva, cierra las demás
 *                sesiones de la cuenta e inicia sesión aquí.
 *   · registrar_cambio → tras cambiarla con el correo de Supabase, anota la
 *                fecha del cambio (se muestra en "Mi cuenta").
 */
export async function POST(req: NextRequest) {
  const body = ((await req.json().catch(() => null)) ?? {}) as { accion?: string; token?: string; password?: string };
  if (!(await dentroDelLimite(`restablecer:ip:${ipDe(req)}`, 20, 600))) return responder({ error: ESPERA }, 429);

  if (body.accion === "registrar_cambio") {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return responder({ error: "Inicia sesión para continuar." }, 401);
    await createAdminClient().auth.admin.updateUserById(user.id, {
      app_metadata: { ...(user.app_metadata ?? {}), clave_cambiada_en: new Date().toISOString() },
    });
    return responder({ ok: true });
  }

  const token = String(body.token ?? "");

  if (body.accion === "validar") {
    const vigente = await tokenVigente(token);
    if (!vigente) return responder({ error: NO_FUNCIONA }, 410);
    const { estado } = await leerEstado();
    const nombre = clientePorId(estado, vigente.clienteId)?.nombre.split(" ")[0] ?? "";
    return responder({ ok: true, nombre });
  }

  if (body.accion !== "guardar") return responder({ error: "Petición inválida." }, 400);

  const password = String(body.password ?? "");
  if (password.length < 8) return responder({ error: "La contraseña debe tener al menos 8 caracteres." }, 400);

  try {
    const { email } = await aplicarNuevaClave(token, password);
    const supabase = await createClient();
    await supabase.auth.signOut({ scope: "local" }).catch(() => {});
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) return responder({ ok: true, rol: null });
    return responder({ ok: true, rol: resolverRol(data.user) });
  } catch (err) {
    if (err instanceof ErrorOperacion) return responder({ error: err.message }, err.status);
    console.error("Restablecer contraseña:", err);
    return responder({ error: "No se pudo guardar la contraseña. Pide un enlace nuevo a la barbería." }, 500);
  }
}
