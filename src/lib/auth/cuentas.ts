import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolverRol } from "@/lib/auth/roles";
export { correoDeTelefono, esCorreoInterno } from "@/lib/auth/telefono";
import { ejecutarOperacion, leerEstado } from "@/lib/datos/servidor";
import { normalizarTelefono, nuevoId, numeroDeTarjeta, type Cliente, type Estado, type Sesion } from "@/lib/datos/modelo";

// Cuentas de acceso de los clientes: alta con teléfono, enlace con Google y
// el vínculo entre la cuenta de Supabase Auth y la ficha del cliente.

/** Sesión del propio servidor para operaciones internas (vincular cuentas). */
export const SISTEMA: Sesion = { rol: "admin", id: "sistema", nombre: "Sistema", subtitulo: "Sistema" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function clientePorTelefono(estado: Estado, telefono: string): Cliente | null {
  const t = normalizarTelefono(telefono);
  if (t.length !== 10) return null;
  return estado.clientes.find((c) => normalizarTelefono(c.telefono) === t) ?? null;
}

/** Id de la cuenta de acceso del cliente, si ya la activó. */
export function cuentaDeCliente(cliente: Cliente): string | null {
  if (cliente.cuenta_id) return cliente.cuenta_id;
  return UUID.test(cliente.id) ? cliente.id : null;
}

export async function usuarioPorId(id: string): Promise<User | null> {
  if (!UUID.test(id)) return null;
  const { data, error } = await createAdminClient().auth.admin.getUserById(id);
  return error ? null : data.user;
}

/**
 * Tras entrar con Google: deja la cuenta como cliente (si no tenía rol) y la
 * une con su ficha. Si en mostrador ya lo habían registrado con ese correo, se
 * usa esa ficha; si no, se le crea una con su tarjeta de lealtad.
 */
export async function prepararCuentaGoogle(user: User): Promise<void> {
  const admin = createAdminClient();
  const meta = user.app_metadata ?? {};
  if (!meta.rol) {
    await admin.auth.admin.updateUserById(user.id, { app_metadata: { ...meta, rol: "cliente" } });
    meta.rol = "cliente";
  }
  if (resolverRol({ app_metadata: meta }) !== "cliente") return;

  const { estado } = await leerEstado();
  const fichaId = typeof meta.cliente_id === "string" ? meta.cliente_id : user.id;
  const ficha = estado.clientes.find((c) => c.id === fichaId);
  const nombre =
    (user.user_metadata?.full_name as string) || (user.user_metadata?.name as string) || user.email?.split("@")[0] || "Cliente";

  if (ficha) {
    if (!ficha.google || !ficha.cuenta_id) {
      await ejecutarOperacion(
        { tipo: "vincularCuentaCliente", clienteId: ficha.id, cuentaId: user.id, google: true, email: user.email ?? "" },
        SISTEMA
      );
    }
    return;
  }

  // ¿Ya lo habían dado de alta en mostrador con ese correo y sin cuenta?
  const email = user.email?.toLowerCase() ?? "";
  const deMostrador = email
    ? estado.clientes.find((c) => c.email.trim().toLowerCase() === email && !cuentaDeCliente(c))
    : undefined;
  if (deMostrador) {
    await admin.auth.admin.updateUserById(user.id, { app_metadata: { ...meta, cliente_id: deMostrador.id } });
    await ejecutarOperacion(
      { tipo: "vincularCuentaCliente", clienteId: deMostrador.id, cuentaId: user.id, google: true, email },
      SISTEMA
    );
    return;
  }

  await ejecutarOperacion(
    {
      tipo: "registrarCliente",
      cliente: { id: user.id, nombre, telefono: "", email, creado_en: new Date().toISOString(), google: true },
      tarjetaId: nuevoId("tlc"),
      numeroTarjeta: numeroDeTarjeta(new Set(estado.tarjetas.map((t) => t.numero))),
    },
    { rol: "cliente", id: user.id, nombre, subtitulo: "Cliente" }
  );
}
