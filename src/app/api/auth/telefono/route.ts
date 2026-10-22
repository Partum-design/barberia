import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientePorTelefono, cuentaDeCliente, SISTEMA, usuarioPorId } from "@/lib/auth/cuentas";
import { correoDeTelefono, esCorreoInterno } from "@/lib/auth/telefono";
import { codigoValido, enviarCodigo, smsDisponible } from "@/lib/auth/sms";
import { ejecutarOperacion, leerEstado } from "@/lib/datos/servidor";
import { normalizarTelefono, nuevoId, numeroDeTarjeta } from "@/lib/datos/modelo";

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
 * La cuenta usa un correo interno derivado del número, así que el navegador
 * inicia sesión por su cuenta con signInWithPassword: el servidor nunca
 * maneja la contraseña de nadie más que al crearla.
 */
type Peticion = {
  accion?: "consultar" | "activar" | "registrar";
  telefono?: string;
  password?: string;
  codigo?: string;
  nombre?: string;
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
  if (telefono.length !== 10) return error("Escribe tu número a 10 dígitos.");

  const { estado } = await leerEstado();
  const cliente = clientePorTelefono(estado, telefono);
  const cuentaId = cliente ? cuentaDeCliente(cliente) : null;
  const usuario = cuentaId ? await usuarioPorId(cuentaId) : null;
  const sms = smsDisponible();

  if (body.accion === "consultar") {
    if (usuario) {
      // Cuenta con correo real (se registró con correo y luego dio su número):
      // se le pide entrar con su correo, sin revelarlo completo.
      if (usuario.email && !esCorreoInterno(usuario.email)) {
        const soloGoogle = (usuario.identities ?? []).every((i) => i.provider === "google");
        return NextResponse.json({ estado: "correo", pista: pistaDeCorreo(usuario.email), google: soloGoogle });
      }
      // Correo interno (derivado del número con el que se dio de alta).
      return NextResponse.json({ estado: "entrar", correo: usuario.email });
    }
    const estadoNumero = cliente ? "activar" : "nuevo";
    if (sms) await enviarCodigo(telefono);
    return NextResponse.json({ estado: estadoNumero, sms });
  }

  if (body.accion !== "activar" && body.accion !== "registrar") return error("Petición inválida.");

  const password = body.password ?? "";
  if (password.length < 8) return error("La contraseña debe tener al menos 8 caracteres.");
  if (sms && !(body.codigo && (await codigoValido(telefono, body.codigo.trim())))) {
    return error("El código no es correcto o ya expiró.");
  }

  const admin = createAdminClient();

  if (body.accion === "activar") {
    if (!cliente) return error("No encontramos ese número. Crea tu cuenta.", 404);
    if (usuario) return error("Ese número ya tiene contraseña. Inicia sesión.", 409);

    const { data, error: err } = await admin.auth.admin.createUser({
      email: correoDeTelefono(telefono),
      password,
      email_confirm: true,
      app_metadata: { rol: "cliente", cliente_id: cliente.id },
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
    return NextResponse.json({ ok: true, nombre: cliente.nombre.split(" ")[0] }, { status: 201 });
  }

  // registrar: cliente nuevo sólo con su número
  if (cliente) return error("Ese número ya está registrado. Inicia sesión.", 409);
  const nombre = body.nombre?.trim().replace(/\s+/g, " ") ?? "";
  if (nombre.length < 2) return error("Escribe tu nombre.");

  const { data, error: err } = await admin.auth.admin.createUser({
    email: correoDeTelefono(telefono),
    password,
    email_confirm: true,
    app_metadata: { rol: "cliente" },
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
