import { after, NextResponse, type NextRequest } from "next/server";
import { idsDeAdmins, notificar } from "@/lib/notificaciones/servidor";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientePorTelefono, cuentaDeCliente, SISTEMA, usuarioPorId } from "@/lib/auth/cuentas";
import { correoDeTelefono, esCorreoInterno } from "@/lib/auth/telefono";
import { codigoValido, enviarCodigo, smsDisponible } from "@/lib/auth/sms";
import { ejecutarOperacion, leerEstado } from "@/lib/datos/servidor";
import { celularValido, normalizarTelefono, nuevoId, numeroDeTarjeta } from "@/lib/datos/modelo";
import { dentroDelLimite, ESPERA, ipDe } from "@/lib/limites";
import { revisarAntibot, type Antibot } from "@/lib/antibot";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/telefono — acceso de clientes con su número de celular.
 *
 *   · consultar → ¿ese número ya tiene contraseña (entrar), lo dio de alta el
 *     personal y es su primera vez (activar) o no lo conocemos (nuevo)?
 *   · activar   → primera vez de un cliente registrado en mostrador: crea su
 *     contraseña y le abre una cuenta unida a su ficha (citas, sellos, tarjeta).
 *   · registrar → cliente nuevo que se da de alta sólo con su número.
 *
 * La cuenta usa un correo interno derivado del número. El inicio de sesión
 * con contraseña pasa por /api/auth/entrar, que limita los intentos.
 *
 * Límite: 10 consultas por minuto por IP (se permite decir si un número ya es
 * cliente, así que hay que frenar a quien pruebe números en serie).
 */
type Peticion = {
  accion?: "consultar" | "activar" | "registrar";
  telefono?: string;
  password?: string;
  codigo?: string;
  nombre?: string;
  antibot?: Antibot;
};

const error = (mensaje: string, status = 400) => NextResponse.json({ error: mensaje }, { status });

/** "juan.perez@gmail.com" → "ju•••@gmail.com" */
function pistaDeCorreo(email: string) {
  const [usuario, dominio] = email.split("@");
  return `${usuario.slice(0, 2)}•••@${dominio}`;
}

export async function POST(req: NextRequest) {
  const body = ((await req.json().catch(() => null)) ?? {}) as Peticion;
  const telefono = normalizarTelefono(body.telefono ?? "");
  if (telefono.length !== 10) return error("Escribe un celular de 10 dígitos.");
  if (!(await dentroDelLimite(`telefono:ip:${ipDe(req)}`, 10, 60))) {
    return error(`Demasiadas consultas. ${ESPERA}`, 429);
  }

  const { estado } = await leerEstado();
  const cliente = clientePorTelefono(estado, telefono);
  const cuentaId = cliente ? cuentaDeCliente(cliente) : null;
  const usuario = cuentaId ? await usuarioPorId(cuentaId) : null;
  const sms = smsDisponible();

  if (body.accion === "consultar") {
    if (usuario) {
      // Cuenta sólo de Google (sin contraseña): se le pide entrar con Google.
      const soloGoogle = (usuario.identities ?? []).length > 0 && (usuario.identities ?? []).every((i) => i.provider === "google");
      if (soloGoogle && usuario.email && !esCorreoInterno(usuario.email)) {
        return NextResponse.json({ estado: "correo", pista: pistaDeCorreo(usuario.email), google: true });
      }
      // Tiene contraseña: entra con su número aunque haya agregado un correo.
      return NextResponse.json({ estado: "entrar" });
    }
    const estadoNumero = cliente ? "activar" : "nuevo";
    if (sms) await enviarCodigo(telefono);
    return NextResponse.json({ estado: estadoNumero, sms });
  }

  if (body.accion !== "activar" && body.accion !== "registrar") return error("Petición inválida.");

  // Crear contraseña o cuenta: además del límite por IP, filtro antibot.
  const bot = await revisarAntibot(body.antibot, ipDe(req));
  if (bot) return error(bot, 403);

  const password = body.password ?? "";
  if (password.length < 8) return error("La contraseña debe tener al menos 8 caracteres.");
  if (sms && !(body.codigo && (await codigoValido(telefono, body.codigo.trim())))) {
    return error("El código no es correcto o ya expiró.");
  }

  const admin = createAdminClient();

  if (body.accion === "activar") {
    if (!cliente) return error("No encontramos ese número. Crea tu cuenta.", 404);
    if (usuario) return error("Ese número ya tiene contraseña. Inicia sesión.", 409);
    // Pocos intentos por número: frena a quien quiera adueñarse de una cuenta ajena.
    if (!(await dentroDelLimite(`activar:tel:${telefono}`, 3, 3600))) return error(`Demasiados intentos. ${ESPERA}`, 429);

    const { data, error: err } = await admin.auth.admin.createUser({
      email: correoDeTelefono(telefono),
      password,
      email_confirm: true,
      app_metadata: { rol: "cliente", cliente_id: cliente.id, clave_cambiada_en: new Date().toISOString() },
      user_metadata: { full_name: cliente.nombre, telefono },
    });
    if (err || !data.user) {
      const yaExiste = /already|registered|exists/i.test(err?.message ?? "");
      return error(yaExiste ? "Ese número ya tiene contraseña. Inicia sesión." : "No se pudo crear tu acceso.", yaExiste ? 409 : 500);
    }
    try {
      await ejecutarOperacion({ tipo: "vincularCuentaCliente", clienteId: cliente.id, cuentaId: data.user.id }, SISTEMA);
    } catch (e) {
      await admin.auth.admin.deleteUser(data.user.id);
      console.error(e);
      return error("No se pudo activar tu acceso. Intenta de nuevo.", 500);
    }
    // La barbería se entera: si el cliente dice que no fue él, se reinicia
    // su acceso desde Panel → Restablecer contraseñas.
    after(async () => {
      await notificar(await idsDeAdmins(), {
        titulo: "Un cliente creó su contraseña",
        cuerpo: `${cliente.nombre} (${telefono.slice(0, 2)} ${telefono.slice(2, 6)} ${telefono.slice(6)}) activó su cuenta en la app.`,
        url: "/dashboard/admin/restablecer",
      }).catch(() => {});
    });
    return NextResponse.json({ ok: true, nombre: cliente.nombre.split(" ")[0] }, { status: 201 });
  }

  // registrar: cliente nuevo sólo con su número
  if (cliente) return error("Ese número ya está registrado. Inicia sesión.", 409);
  if (!celularValido(telefono)) return error("Escribe un celular válido de 10 dígitos (sin lada del país).");
  const nombre = body.nombre?.trim().replace(/\s+/g, " ") ?? "";
  if (nombre.length < 2) return error("Escribe tu nombre.");

  const { data, error: err } = await admin.auth.admin.createUser({
    email: correoDeTelefono(telefono),
    password,
    email_confirm: true,
    app_metadata: { rol: "cliente", clave_cambiada_en: new Date().toISOString() },
    user_metadata: { full_name: nombre, telefono },
  });
  if (err || !data.user) {
    const yaExiste = /already|registered|exists/i.test(err?.message ?? "");
    return error(yaExiste ? "Ese número ya tiene cuenta. Inicia sesión." : "No se pudo crear la cuenta.", yaExiste ? 409 : 500);
  }
  try {
    await ejecutarOperacion(
      {
        tipo: "registrarCliente",
        cliente: { id: data.user.id, nombre, telefono, email: "", creado_en: new Date().toISOString() },
        tarjetaId: nuevoId("tlc"),
        numeroTarjeta: numeroDeTarjeta(new Set(estado.tarjetas.map((t) => t.numero))),
      },
      { rol: "cliente", id: data.user.id, nombre, subtitulo: "Cliente" }
    );
  } catch (e) {
    await admin.auth.admin.deleteUser(data.user.id);
    console.error(e);
    return error("No se pudo crear la cuenta. Intenta de nuevo.", 500);
  }
  return NextResponse.json({ ok: true, nombre: nombre.split(" ")[0] }, { status: 201 });
}
