import { NextResponse, type NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { esPrincipal, resolverRol } from "@/lib/auth/roles";
import { ErrorOperacion, nuevoId, numeroDeTarjeta, type Barbero, type Rol, type Sesion } from "@/lib/datos/modelo";
import { ejecutarOperacion, sesionDePeticion } from "@/lib/datos/servidor";

export const dynamic = "force-dynamic";

// Alta y mantenimiento de cuentas (clientes, barberos y administradores). Las
// crea el servidor con la llave service_role: así el correo queda confirmado
// al instante y el rol va en `app_metadata`, donde el propio usuario no puede
// cambiarlo.
//
// Permisos:
//   · Cualquier administrador crea, elimina y cambia la contraseña de
//     clientes y barberos.
//   · Sólo el administrador principal crea administradores, los elimina o
//     cambia su contraseña. Nadie puede eliminarse a sí mismo ni eliminar al
//     administrador principal.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function exigirAdmin() {
  const sesion = await sesionDePeticion();
  if (!sesion || sesion.rol !== "admin") return null;
  return sesion;
}

const prohibido = (mensaje = "Sólo un administrador puede gestionar usuarios.") =>
  NextResponse.json({ error: mensaje }, { status: 403 });

const nombreDe = (u: User) =>
  (u.user_metadata?.full_name as string) || u.email?.split("@")[0] || "";

async function buscarUsuario(id: string) {
  const { data, error } = await createAdminClient().auth.admin.getUserById(id);
  return error ? null : data.user;
}

/** ¿Puede `sesion` administrar (contraseña, baja) la cuenta `objetivo`? */
function puedeGestionar(sesion: Sesion, objetivo: User) {
  if (resolverRol(objetivo) !== "admin") return true;
  return Boolean(sesion.principal);
}

/** GET — todas las cuentas, con lo que la sesión puede hacer sobre cada una. */
export async function GET() {
  const sesion = await exigirAdmin();
  if (!sesion) return prohibido();

  const { data, error } = await createAdminClient().auth.admin.listUsers({ perPage: 1000 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const usuarios = data.users
    .map((u) => {
      const gestionable = puedeGestionar(sesion, u);
      return {
        id: u.id,
        email: u.email ?? "",
        nombre: nombreDe(u),
        rol: resolverRol(u),
        principal: esPrincipal(u),
        creado_en: u.created_at,
        ultimo_acceso: u.last_sign_in_at ?? null,
        puede_cambiar_clave: gestionable || u.id === sesion.id,
        puede_eliminar: gestionable && u.id !== sesion.id && !esPrincipal(u),
      };
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  return NextResponse.json({ usuarios, yo: { id: sesion.id, principal: Boolean(sesion.principal) } });
}

type Alta = {
  tipo?: Rol;
  nombre?: string;
  email?: string;
  password?: string;
  telefono?: string;
  barbero?: Partial<Omit<Barbero, "id" | "nombre" | "activo">>;
};

/** POST — crea una cuenta de cliente, barbero o administrador. */
export async function POST(req: NextRequest) {
  const sesion = await exigirAdmin();
  if (!sesion) return prohibido();

  const body = ((await req.json().catch(() => null)) ?? {}) as Alta;
  const tipo: Rol = body.tipo === "admin" ? "admin" : body.tipo === "cliente" ? "cliente" : "barbero";
  if (tipo === "admin" && !sesion.principal) {
    return prohibido("Sólo el administrador principal puede crear administradores.");
  }

  const nombre = body.nombre?.trim() ?? "";
  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";

  if (nombre.length < 2) return NextResponse.json({ error: "Escribe el nombre." }, { status: 400 });
  if (!EMAIL.test(email)) return NextResponse.json({ error: "El correo no es válido." }, { status: 400 });
  if (password.length < 8) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres." }, { status: 400 });
  }
  const especialidad = body.barbero?.especialidad?.trim() ?? "";
  if (tipo === "barbero" && !especialidad) {
    return NextResponse.json({ error: "Escribe la especialidad del barbero." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { rol: tipo },
    user_metadata: { full_name: nombre, ...(tipo === "barbero" ? { especialidad } : {}) },
  });
  if (error || !data.user) {
    const yaExiste = /already|registered|exists/i.test(error?.message ?? "");
    return NextResponse.json(
      { error: yaExiste ? "Ya existe una cuenta con ese correo." : error?.message ?? "No se pudo crear la cuenta." },
      { status: yaExiste ? 409 : 500 }
    );
  }

  try {
    if (tipo === "barbero") {
      const b = body.barbero ?? {};
      const barbero: Barbero = {
        id: data.user.id,
        nombre,
        especialidad,
        duracion_cita_min: Math.max(5, Number(b.duracion_cita_min) || 30),
        acepta_domicilio: b.acepta_domicilio !== false,
        biografia: String(b.biografia ?? "").trim(),
        activo: true,
      };
      await ejecutarOperacion({ tipo: "agregarBarbero", barbero }, sesion);
    } else if (tipo === "cliente") {
      // Igual que el registro público: ficha de cliente y tarjeta de lealtad.
      await ejecutarOperacion(
        {
          tipo: "registrarCliente",
          cliente: {
            id: data.user.id,
            nombre,
            telefono: body.telefono?.trim().slice(0, 30) ?? "",
            email,
            creado_en: new Date().toISOString(),
          },
          tarjetaId: nuevoId("tlc"),
          numeroTarjeta: numeroDeTarjeta(new Set()),
        },
        sesion
      );
    }
  } catch (err) {
    // Sin su ficha la cuenta quedaría huérfana: se deshace.
    await admin.auth.admin.deleteUser(data.user.id);
    const mensaje = err instanceof ErrorOperacion ? err.message : "No se pudo registrar la cuenta.";
    return NextResponse.json({ error: mensaje }, { status: 500 });
  }

  return NextResponse.json({ id: data.user.id }, { status: 201 });
}

/** PATCH — cambia la contraseña de una cuenta. */
export async function PATCH(req: NextRequest) {
  const sesion = await exigirAdmin();
  if (!sesion) return prohibido();

  const body = ((await req.json().catch(() => null)) ?? {}) as { id?: string; password?: string };
  if (!body.id) return NextResponse.json({ error: "Falta el usuario." }, { status: 400 });
  if (!body.password || body.password.length < 8) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres." }, { status: 400 });
  }

  const objetivo = await buscarUsuario(body.id);
  if (!objetivo) return NextResponse.json({ error: "La cuenta no existe." }, { status: 404 });
  if (objetivo.id !== sesion.id && !puedeGestionar(sesion, objetivo)) {
    return prohibido("Sólo el administrador principal puede cambiar la contraseña de otro administrador.");
  }

  const { error } = await createAdminClient().auth.admin.updateUserById(body.id, { password: body.password });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** DELETE — elimina una cuenta (?id=...). */
export async function DELETE(req: NextRequest) {
  const sesion = await exigirAdmin();
  if (!sesion) return prohibido();

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta el usuario." }, { status: 400 });
  if (id === sesion.id) return prohibido("No puedes eliminar tu propia cuenta.");

  const objetivo = await buscarUsuario(id);
  if (!objetivo) return NextResponse.json({ error: "La cuenta no existe." }, { status: 404 });
  if (esPrincipal(objetivo)) return prohibido("El administrador principal no se puede eliminar.");
  if (!puedeGestionar(sesion, objetivo)) {
    return prohibido("Los administradores no pueden eliminar a otros administradores.");
  }

  // Se borran también sus datos del panel (ficha, tarjeta, horario). Las citas
  // ya atendidas se conservan para caja y reportes; las pendientes se cancelan.
  const rol = resolverRol(objetivo);
  if (rol === "barbero" || rol === "cliente") {
    try {
      await ejecutarOperacion({ tipo: rol === "barbero" ? "eliminarBarbero" : "eliminarCliente", id }, sesion);
    } catch {
      /* sin ficha en el panel: sólo queda borrar la cuenta */
    }
  }

  const admin = createAdminClient();
  await admin.from("usuarios").delete().eq("id", id);
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
