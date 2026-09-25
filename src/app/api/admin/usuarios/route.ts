import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolverRol } from "@/lib/auth/roles";
import { ErrorOperacion, type Barbero } from "@/lib/datos/modelo";
import { ejecutarOperacion, sesionDePeticion } from "@/lib/datos/servidor";

export const dynamic = "force-dynamic";

// Alta y mantenimiento de las cuentas del personal (administradores y
// barberos). Las crea el servidor con la llave service_role: así el correo
// queda confirmado al instante y el rol va en `app_metadata`, donde el propio
// usuario no puede cambiarlo.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function exigirAdmin() {
  const sesion = await sesionDePeticion();
  if (!sesion || sesion.rol !== "admin") return null;
  return sesion;
}

const prohibido = () => NextResponse.json({ error: "Sólo un administrador puede gestionar usuarios." }, { status: 403 });

/** GET — cuentas del personal. */
export async function GET() {
  if (!(await exigirAdmin())) return prohibido();

  const { data, error } = await createAdminClient().auth.admin.listUsers({ perPage: 1000 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const usuarios = data.users
    .map((u) => ({
      id: u.id,
      email: u.email ?? "",
      nombre: (u.user_metadata?.full_name as string) || u.email?.split("@")[0] || "",
      rol: resolverRol(u),
      ultimo_acceso: u.last_sign_in_at ?? null,
    }))
    .filter((u) => u.rol !== "cliente");

  return NextResponse.json({ usuarios });
}

type Alta = {
  tipo?: "barbero" | "admin";
  nombre?: string;
  email?: string;
  password?: string;
  barbero?: Partial<Omit<Barbero, "id" | "nombre" | "activo">>;
};

/** POST — crea una cuenta de barbero o de administrador. */
export async function POST(req: NextRequest) {
  const sesion = await exigirAdmin();
  if (!sesion) return prohibido();

  const body = ((await req.json().catch(() => null)) ?? {}) as Alta;
  const tipo = body.tipo === "admin" ? "admin" : "barbero";
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

  if (tipo === "barbero") {
    const b = body.barbero ?? {};
    const barbero: Barbero = {
      id: data.user.id,
      nombre,
      especialidad,
      precio_servicio: Math.max(0, Number(b.precio_servicio) || 0),
      duracion_cita_min: Math.max(5, Number(b.duracion_cita_min) || 30),
      acepta_domicilio: b.acepta_domicilio !== false,
      biografia: String(b.biografia ?? "").trim(),
      activo: true,
    };
    try {
      await ejecutarOperacion({ tipo: "agregarBarbero", barbero }, sesion);
    } catch (err) {
      // Sin su ficha de barbero la cuenta quedaría huérfana: se deshace.
      await admin.auth.admin.deleteUser(data.user.id);
      const mensaje = err instanceof ErrorOperacion ? err.message : "No se pudo registrar al barbero.";
      return NextResponse.json({ error: mensaje }, { status: 500 });
    }
  }

  return NextResponse.json({ id: data.user.id }, { status: 201 });
}

/** PATCH — cambia la contraseña de una cuenta del personal. */
export async function PATCH(req: NextRequest) {
  if (!(await exigirAdmin())) return prohibido();

  const body = ((await req.json().catch(() => null)) ?? {}) as { id?: string; password?: string };
  if (!body.id) return NextResponse.json({ error: "Falta el usuario." }, { status: 400 });
  if (!body.password || body.password.length < 8) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres." }, { status: 400 });
  }

  const { error } = await createAdminClient().auth.admin.updateUserById(body.id, { password: body.password });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
