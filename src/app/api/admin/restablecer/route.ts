import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { cuentaDeCliente, usuarioPorId } from "@/lib/auth/cuentas";
import { esCorreoInterno } from "@/lib/auth/telefono";
import { anotar, cerrarSesiones, clientePorId, crearEnlace, DIAS_SOLICITUD } from "@/lib/auth/restablecer";
import { leerEstado, sesionDePeticion } from "@/lib/datos/servidor";
import { normalizarTelefono, type Cliente } from "@/lib/datos/modelo";

export const dynamic = "force-dynamic";

// Sección "Restablecer contraseñas" del panel. Sólo administradores: el rol
// se comprueba aquí, en el servidor, no sólo escondiendo el botón.

const responder = (cuerpo: Record<string, unknown>, status = 200) => NextResponse.json(cuerpo, { status });

async function exigirAdmin() {
  const sesion = await sesionDePeticion();
  return sesion?.rol === "admin" ? sesion : null;
}

type EstadoCuenta = "con_clave" | "sin_clave" | "google";

function estadoCuenta(usuario: User | null): EstadoCuenta {
  if (!usuario) return "sin_clave";
  const ids = usuario.identities ?? [];
  if (ids.length > 0 && ids.every((i) => i.provider === "google")) return "google";
  return "con_clave";
}

async function fichaPublica(cliente: Cliente) {
  const cuentaId = cuentaDeCliente(cliente);
  const usuario = cuentaId ? await usuarioPorId(cuentaId) : null;
  const meta = usuario?.app_metadata ?? {};
  return {
    id: cliente.id,
    nombre: cliente.nombre,
    telefono: normalizarTelefono(cliente.telefono),
    correo: usuario?.email && !esCorreoInterno(usuario.email) ? usuario.email : "",
    cuenta: estadoCuenta(usuario),
    clave_cambiada_en: typeof meta.clave_cambiada_en === "string" ? meta.clave_cambiada_en : null,
    acceso_reiniciado_en: typeof meta.acceso_reiniciado_en === "string" ? meta.acceso_reiniciado_en : null,
    ultimo_acceso: usuario?.last_sign_in_at ?? null,
  };
}

/** Las solicitudes con más de 7 días sin atender pasan a "expirada". */
async function expirarViejas() {
  const limite = new Date(Date.now() - DIAS_SOLICITUD * 86_400_000).toISOString();
  await createAdminClient()
    .from("solicitudes_restablecimiento")
    .update({ estado: "expirada" })
    .eq("estado", "pendiente")
    .lt("creada_en", limite);
}

/**
 * GET                → solicitudes pendientes
 * GET ?conteo=1      → sólo cuántas hay (para el menú)
 * GET ?q=texto       → busca clientes por nombre o celular
 * GET ?cliente=id    → estado de la cuenta y su bitácora
 */
export async function GET(req: NextRequest) {
  const sesion = await exigirAdmin();
  if (!sesion) return responder({ error: "Sólo un administrador puede ver esta sección." }, 403);

  const admin = createAdminClient();
  await expirarViejas();
  const params = req.nextUrl.searchParams;

  if (params.get("conteo")) {
    const { count } = await admin
      .from("solicitudes_restablecimiento")
      .select("id", { count: "exact", head: true })
      .eq("estado", "pendiente");
    return responder({ pendientes: count ?? 0 });
  }

  const { estado } = await leerEstado();

  const q = params.get("q")?.trim();
  if (q !== undefined && q !== null && params.has("q")) {
    const texto = q.toLowerCase();
    const digitos = q.replace(/\D/g, "");
    if (texto.length < 2) return responder({ clientes: [] });
    const encontrados = estado.clientes
      .filter(
        (c) =>
          c.nombre.toLowerCase().includes(texto) ||
          (digitos.length >= 3 && normalizarTelefono(c.telefono).includes(digitos))
      )
      .slice(0, 15);
    return responder({ clientes: await Promise.all(encontrados.map(fichaPublica)) });
  }

  const clienteId = params.get("cliente");
  if (clienteId) {
    const cliente = clientePorId(estado, clienteId);
    if (!cliente) return responder({ error: "Cliente no encontrado." }, 404);
    const { data: bitacora } = await admin
      .from("bitacora_restablecimiento")
      .select("accion, actor_nombre, creada_en")
      .eq("cliente_id", clienteId)
      .order("creada_en", { ascending: false })
      .limit(10);
    return responder({ cliente: await fichaPublica(cliente), bitacora: bitacora ?? [] });
  }

  const { data, error } = await admin
    .from("solicitudes_restablecimiento")
    .select("id, cliente_id, creada_en")
    .eq("estado", "pendiente")
    .order("creada_en", { ascending: false })
    .limit(100);
  if (error) return responder({ error: "No se pudieron leer las solicitudes. ¿Ya se aplicó la migración 00008?" }, 500);

  const solicitudes = (data ?? []).map((s) => {
    const c = clientePorId(estado, s.cliente_id);
    return {
      id: s.id,
      cliente_id: s.cliente_id,
      creada_en: s.creada_en,
      nombre: c?.nombre ?? "Cliente eliminado",
      telefono: c ? normalizarTelefono(c.telefono) : "",
    };
  });
  return responder({ solicitudes });
}

/**
 * POST { accion: "generar", clienteId }   → enlace de un solo uso (30 min)
 * POST { accion: "reiniciar", clienteId } → bloquea el acceso actual: pone
 *      una contraseña que nadie conoce y cierra sus sesiones. Para cuando
 *      alguien más "reclamó" la cuenta con el número del cliente.
 */
export async function POST(req: NextRequest) {
  const sesion = await exigirAdmin();
  if (!sesion) return responder({ error: "Sólo un administrador puede restablecer contraseñas." }, 403);

  const body = ((await req.json().catch(() => null)) ?? {}) as { accion?: string; clienteId?: string };
  const { estado } = await leerEstado();
  const cliente = body.clienteId ? clientePorId(estado, body.clienteId) : null;
  if (!cliente) return responder({ error: "Cliente no encontrado." }, 404);
  const admin = createAdminClient();
  const actor = { id: sesion.id, nombre: sesion.nombre };

  if (body.accion === "generar") {
    if (normalizarTelefono(cliente.telefono).length !== 10 && !cuentaDeCliente(cliente)) {
      return responder({ error: "Este cliente no tiene un celular de 10 dígitos. Corrígelo en Clientes." }, 409);
    }
    const origen = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;
    try {
      const { enlace, expira } = await crearEnlace(cliente, sesion.id, origen);
      await admin
        .from("solicitudes_restablecimiento")
        .update({ estado: "atendida", atendida_por: sesion.id === "sistema" ? null : sesion.id, atendida_en: new Date().toISOString() })
        .eq("cliente_id", cliente.id)
        .eq("estado", "pendiente");
      await anotar(cliente.id, "generar_enlace", actor, { expira_en: expira.toISOString() });
      return responder({
        enlace,
        expira_en: expira.toISOString(),
        nombre: cliente.nombre,
        telefono: normalizarTelefono(cliente.telefono),
      });
    } catch (err) {
      console.error("Generar enlace:", err);
      return responder({ error: "No se pudo generar el enlace. ¿Ya se aplicó la migración 00008?" }, 500);
    }
  }

  if (body.accion === "reiniciar") {
    const cuentaId = cuentaDeCliente(cliente);
    const usuario = cuentaId ? await usuarioPorId(cuentaId) : null;
    if (!usuario) return responder({ error: "Este cliente aún no tiene contraseña: no hay acceso que reiniciar." }, 409);
    const ahora = new Date().toISOString();
    const { error } = await admin.auth.admin.updateUserById(usuario.id, {
      password: randomBytes(24).toString("base64url"),
      app_metadata: { ...(usuario.app_metadata ?? {}), acceso_reiniciado_en: ahora },
    });
    if (error) return responder({ error: "No se pudo reiniciar el acceso." }, 500);
    await cerrarSesiones(usuario.id);
    await admin.from("tokens_restablecimiento").update({ usado_en: ahora }).eq("cliente_id", cliente.id).is("usado_en", null);
    await anotar(cliente.id, "reiniciar_acceso", actor);
    return responder({ ok: true });
  }

  return responder({ error: "Petición inválida." }, 400);
}
