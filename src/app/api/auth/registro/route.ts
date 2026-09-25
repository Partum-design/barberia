import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { nuevoId, numeroDeTarjeta } from "@/lib/datos/modelo";
import { ejecutarOperacion } from "@/lib/datos/servidor";

export const dynamic = "force-dynamic";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/auth/registro — alta de clientes desde la pantalla de acceso.
 *
 * Se hace en el servidor para dejar el correo confirmado (no depende de que
 * Supabase pueda enviar correos) y para que el rol quede fijo como cliente.
 * De paso se le emite su ficha y su tarjeta de lealtad.
 */
export async function POST(req: NextRequest) {
  const body = ((await req.json().catch(() => null)) ?? {}) as {
    nombre?: string;
    email?: string;
    password?: string;
  };
  const nombre = body.nombre?.trim() ?? "";
  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";

  if (nombre.length < 2) return NextResponse.json({ error: "Escribe tu nombre." }, { status: 400 });
  if (!EMAIL.test(email)) return NextResponse.json({ error: "El correo no es válido." }, { status: 400 });
  if (password.length < 8) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { rol: "cliente" },
    user_metadata: { full_name: nombre },
  });
  if (error || !data.user) {
    const yaExiste = /already|registered|exists/i.test(error?.message ?? "");
    return NextResponse.json(
      { error: yaExiste ? "Ya existe una cuenta con ese correo. Inicia sesión." : "No se pudo crear la cuenta." },
      { status: yaExiste ? 409 : 500 }
    );
  }

  const sesion = { rol: "cliente" as const, id: data.user.id, nombre, subtitulo: "Cliente" };
  try {
    await ejecutarOperacion(
      {
        tipo: "registrarCliente",
        cliente: { id: data.user.id, nombre, telefono: "", email, creado_en: new Date().toISOString() },
        tarjetaId: nuevoId("tlc"),
        numeroTarjeta: numeroDeTarjeta(new Set()),
      },
      sesion
    );
  } catch (err) {
    // La cuenta ya sirve para entrar; la tarjeta se vuelve a intentar al abrir "Mi tarjeta".
    console.error(err);
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
