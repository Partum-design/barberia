import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Límite de intentos en Postgres (tabla limites_intentos, migración 00008).
// No hace falta Redis: cada consulta es una sola sentencia atómica.
//
// Si la base todavía no tiene la migración, se deja pasar y se avisa en el
// log: un límite que falla no debe tumbar el acceso de todos los clientes.

export function ipDe(req: NextRequest) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "sin-ip"
  );
}

/** Suma un intento. `true` mientras no se pase de `max` en `segundos`. */
export async function dentroDelLimite(clave: string, max: number, segundos: number): Promise<boolean> {
  const { data, error } = await createAdminClient().rpc("fn_limite_consumir", {
    p_clave: clave,
    p_max: max,
    p_segundos: segundos,
  });
  if (error) {
    console.error("Límite de intentos no disponible:", error.message);
    return true;
  }
  return data !== false;
}

/** ¿La clave está bloqueada por fallos seguidos? Devuelve hasta cuándo. */
export async function bloqueadoHasta(clave: string): Promise<Date | null> {
  const { data, error } = await createAdminClient().rpc("fn_bloqueo_activo", { p_clave: clave });
  if (error) {
    console.error("Bloqueo no disponible:", error.message);
    return null;
  }
  return typeof data === "string" ? new Date(data) : null;
}

/** Cuenta un fallo; al llegar a `max` seguidos bloquea `segundos`. */
export async function registrarFallo(clave: string, max: number, segundos: number): Promise<Date | null> {
  const { data, error } = await createAdminClient().rpc("fn_registrar_fallo", {
    p_clave: clave,
    p_max: max,
    p_segundos: segundos,
  });
  if (error) {
    console.error("No se pudo registrar el fallo:", error.message);
    return null;
  }
  return typeof data === "string" ? new Date(data) : null;
}

export async function olvidarFallos(clave: string) {
  const { error } = await createAdminClient().rpc("fn_limite_borrar", { p_clave: clave });
  if (error) console.error("No se pudieron borrar los fallos:", error.message);
}

export const ESPERA = "Espera unos minutos e inténtalo de nuevo.";
