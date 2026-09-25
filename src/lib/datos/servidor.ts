import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sesionDesdeUsuario } from "@/lib/auth/roles";
import {
  aplicarOperacion,
  ErrorOperacion,
  normalizarEstado,
  type Clave,
  type Estado,
  type Operacion,
  type Sesion,
} from "@/lib/datos/modelo";

// Acceso del servidor a `estado_app`. Sólo se usa desde Route Handlers: la
// tabla no tiene políticas RLS y únicamente la llave service_role la alcanza.

type Leido = { estado: Estado; versiones: Partial<Record<Clave, number>> };

export async function leerEstado(): Promise<Leido> {
  const { data, error } = await createAdminClient().from("estado_app").select("clave, valor, version");
  if (error) throw new Error(`No se pudo leer el estado: ${error.message}`);
  const parcial: Partial<Estado> = {};
  const versiones: Leido["versiones"] = {};
  for (const fila of data ?? []) {
    (parcial as Record<string, unknown>)[fila.clave] = fila.valor;
    versiones[fila.clave as Clave] = Number(fila.version);
  }
  return { estado: normalizarEstado(parcial), versiones };
}

/**
 * Aplica la operación sobre el estado más reciente y lo guarda sólo si nadie
 * lo cambió en medio; si hubo carrera, vuelve a leer y reintenta.
 */
export async function ejecutarOperacion(op: Operacion, sesion: Sesion): Promise<Estado> {
  const admin = createAdminClient();
  for (let intento = 0; intento < 5; intento++) {
    const { estado, versiones } = await leerEstado();
    const cambios = aplicarOperacion(estado, op, sesion);
    const claves = Object.keys(cambios) as Clave[];
    if (claves.length === 0) return estado;

    const { data: ok, error } = await admin.rpc("fn_guardar_estado", {
      p_cambios: cambios,
      p_versiones: Object.fromEntries(claves.map((k) => [k, versiones[k] ?? 0])),
    });
    if (error) throw new Error(`No se pudo guardar: ${error.message}`);
    if (ok) return { ...estado, ...cambios };
  }
  throw new ErrorOperacion("Hay demasiados cambios simultáneos. Intenta de nuevo.", 409);
}

/** Sesión de quien hace la petición, validada contra Supabase (no sólo la cookie). */
export async function sesionDePeticion(): Promise<Sesion | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? sesionDesdeUsuario(user) : null;
}
