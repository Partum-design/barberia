import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MODO_LOCAL } from "@/lib/modo";
import {
  actualizarPase,
  enlaceGuardar,
  walletFaltantes,
  type DatosPase,
} from "@/lib/integrations/google-wallet";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const entero = (v: unknown, max = 10_000) =>
  typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= max ? v : null;
const texto = (v: unknown, max = 120) =>
  typeof v === "string" && v.trim().length > 0 ? v.trim().slice(0, max) : null;

/** Valida el cuerpo a mano: son nueve campos y no justifican una dependencia. */
function leerDatos(cuerpo: Record<string, unknown>): DatosPase | null {
  const negocio = (cuerpo.negocio ?? {}) as Record<string, unknown>;
  const numero = texto(cuerpo.numero, 40);
  const titular = texto(cuerpo.titular);
  const sellos = entero(cuerpo.sellos);
  const progreso = entero(cuerpo.progreso, 100);
  const requerido = entero(cuerpo.requerido, 100);
  const disponibles = entero(cuerpo.recompensasDisponibles, 1000);
  const descuento = entero(cuerpo.descuento, 100);
  const nombreNegocio = texto(negocio.nombre);

  if (
    !numero ||
    !/^[\w-]+$/.test(numero) ||
    !titular ||
    sellos === null ||
    progreso === null ||
    !requerido ||
    progreso >= requerido ||
    disponibles === null ||
    descuento === null ||
    !nombreNegocio
  ) {
    return null;
  }

  return {
    numero,
    titular,
    sellos,
    progreso,
    requerido,
    recompensasDisponibles: disponibles,
    descuento,
    estado: cuerpo.estado === "suspendida" ? "suspendida" : "activa",
    negocio: {
      nombre: nombreNegocio,
      direccion: texto(negocio.direccion, 200) ?? undefined,
      telefono: texto(negocio.telefono, 40) ?? undefined,
    },
  };
}

/** Dominio público desde el que se pulsa el botón (Google lo verifica). */
function origenPublico(req: NextRequest) {
  return (process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin).replace(/\/$/, "");
}

/**
 * POST /api/wallet/lealtad
 *
 * Devuelve el enlace "Agregar a Google Wallet" de una tarjeta y, si el
 * cliente ya la tenía guardada, actualiza sus sellos en el teléfono.
 * Con `soloActualizar: true` omite el enlace (lo usa el mostrador al poner
 * un sello).
 */
export async function POST(req: NextRequest) {
  const faltan = walletFaltantes();
  if (faltan.length > 0) {
    return NextResponse.json(
      {
        configurado: false,
        faltan,
        error: "Google Wallet aún no está configurado en el servidor.",
      },
      { status: 503 }
    );
  }

  // Con Supabase conectado sólo emite pases quien tiene sesión.
  if (!MODO_LOCAL) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Inicia sesión para continuar." }, { status: 401 });
    }
  }

  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  const datos = leerDatos(cuerpo);
  if (!datos) {
    return NextResponse.json({ error: "Datos de la tarjeta incompletos." }, { status: 400 });
  }

  const origen = origenPublico(req);

  let actualizado = false;
  let aviso: string | undefined;
  try {
    actualizado = await actualizarPase(datos, origen);
  } catch (error) {
    // Un fallo al refrescar no impide entregar el enlace de guardado.
    aviso = error instanceof Error ? error.message : "No se pudo actualizar el pase.";
  }

  return NextResponse.json({
    configurado: true,
    actualizado,
    aviso,
    url: cuerpo.soloActualizar === true ? undefined : enlaceGuardar(datos, origen),
  });
}
