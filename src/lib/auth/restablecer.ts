import { createHash, randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { cuentaDeCliente, SISTEMA, usuarioPorId } from "@/lib/auth/cuentas";
import { correoDeTelefono } from "@/lib/auth/telefono";
import { ejecutarOperacion, leerEstado } from "@/lib/datos/servidor";
import { ErrorOperacion, normalizarTelefono, type Cliente, type Estado } from "@/lib/datos/modelo";

// Enlaces de restablecimiento que genera la barbería para clientes sin correo.
// Sólo servidor: usa la llave service_role y nunca guarda el token en claro.

/** Minutos que vale un enlace. */
export const VIGENCIA_MIN = 30;
/** Días tras los que una solicitud sin atender pasa a "expirada". */
export const DIAS_SOLICITUD = 7;

export const hashDe = (token: string) => createHash("sha256").update(token).digest("hex");

/** 32 bytes aleatorios en base64url: el token que viaja en el enlace. */
function tokenNuevo() {
  return randomBytes(32).toString("base64url");
}

export function enlaceDeRestablecer(origen: string, token: string) {
  return `${origen}/restablecer?token=${encodeURIComponent(token)}`;
}

/**
 * Crea un enlace de un solo uso para la ficha del cliente. Los enlaces
 * anteriores de esa ficha que no se usaron quedan anulados.
 */
export async function crearEnlace(cliente: Cliente, creadoPor: string | null, origen: string) {
  const admin = createAdminClient();
  const cuentaId = cuentaDeCliente(cliente);
  const usuario = cuentaId ? await usuarioPorId(cuentaId) : null;

  const ahora = new Date();
  const anular = await admin
    .from("tokens_restablecimiento")
    .update({ usado_en: ahora.toISOString() })
    .eq("cliente_id", cliente.id)
    .is("usado_en", null);
  if (anular.error) throw new Error(anular.error.message);

  const token = tokenNuevo();
  const expira = new Date(ahora.getTime() + VIGENCIA_MIN * 60_000);
  const { error } = await admin.from("tokens_restablecimiento").insert({
    hash: hashDe(token),
    cliente_id: cliente.id,
    usuario_id: usuario?.id ?? null,
    expira_en: expira.toISOString(),
    creado_por: creadoPor && creadoPor !== "sistema" ? creadoPor : null,
  });
  if (error) throw new Error(error.message);
  return { enlace: enlaceDeRestablecer(origen, token), expira };
}

/** ¿El token sigue vigente? No lo gasta: sirve para avisar antes de escribir. */
export async function tokenVigente(token: string) {
  if (!token || token.length < 20) return null;
  const { data, error } = await createAdminClient()
    .from("tokens_restablecimiento")
    .select("cliente_id, expira_en, usado_en")
    .eq("hash", hashDe(token))
    .maybeSingle();
  if (error || !data || data.usado_en || new Date(data.expira_en).getTime() <= Date.now()) return null;
  return { clienteId: data.cliente_id as string };
}

export function clientePorId(estado: Estado, id: string) {
  return estado.clientes.find((c) => c.id === id) ?? null;
}

/**
 * Gasta el token y deja la contraseña nueva. Si la ficha aún no tenía cuenta
 * (la registraron en la barbería o reservó sólo con su número), se la crea.
 * Cierra todas las sesiones que la cuenta tuviera abiertas.
 * Devuelve el correo con el que ahora inicia sesión.
 */
export async function aplicarNuevaClave(token: string, password: string): Promise<{ email: string; clienteId: string }> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("fn_consumir_token_restablecimiento", { p_hash: hashDe(token) });
  if (error) throw new Error(error.message);
  const fila = (Array.isArray(data) ? data[0] : data) as { cliente_id: string; usuario_id: string | null } | undefined;
  if (!fila) throw new ErrorOperacion("Este enlace ya no funciona.", 410);

  const { estado } = await leerEstado();
  const cliente = clientePorId(estado, fila.cliente_id);
  if (!cliente) throw new ErrorOperacion("La cuenta de este enlace ya no existe.", 404);

  const ahora = new Date().toISOString();
  const cuentaId = cuentaDeCliente(cliente) ?? fila.usuario_id;
  const usuario = cuentaId ? await usuarioPorId(cuentaId) : null;

  if (usuario) {
    const { error: err } = await admin.auth.admin.updateUserById(usuario.id, {
      password,
      app_metadata: { ...(usuario.app_metadata ?? {}), clave_cambiada_en: ahora },
    });
    if (err) throw new Error(err.message);
    await cerrarSesiones(usuario.id);
    return { email: usuario.email ?? correoDeTelefono(cliente.telefono), clienteId: cliente.id };
  }

  // Sin cuenta todavía: se crea con su número, igual que al activar el acceso.
  const telefono = normalizarTelefono(cliente.telefono);
  if (telefono.length !== 10) throw new ErrorOperacion("Esta ficha no tiene un celular de 10 dígitos.", 409);
  const email = correoDeTelefono(telefono);
  const { data: creado, error: err } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { rol: "cliente", cliente_id: cliente.id, clave_cambiada_en: ahora },
    user_metadata: { full_name: cliente.nombre, telefono },
  });
  if (err || !creado.user) throw new Error(err?.message ?? "No se pudo crear el acceso.");
  try {
    await ejecutarOperacion({ tipo: "vincularCuentaCliente", clienteId: cliente.id, cuentaId: creado.user.id }, SISTEMA);
  } catch (e) {
    await admin.auth.admin.deleteUser(creado.user.id);
    throw e;
  }
  return { email, clienteId: cliente.id };
}

export async function cerrarSesiones(usuarioId: string) {
  const { error } = await createAdminClient().rpc("fn_cerrar_sesiones", { p_usuario: usuarioId });
  if (error) console.error("No se pudieron cerrar las sesiones:", error.message);
}

export async function anotar(clienteId: string, accion: string, actor: { id: string; nombre: string } | null, detalle: Record<string, unknown> = {}) {
  const { error } = await createAdminClient().from("bitacora_restablecimiento").insert({
    cliente_id: clienteId,
    accion,
    actor: actor && actor.id !== "sistema" ? actor.id : null,
    actor_nombre: actor?.nombre ?? null,
    detalle,
  });
  if (error) console.error("No se pudo anotar en la bitácora:", error.message);
}

/** "juan.perez@gmail.com" → "j***@gmail.com" */
export function pistaDeCorreo(email: string) {
  const [usuario, dominio] = email.split("@");
  return `${usuario.charAt(0)}***@${dominio}`;
}
