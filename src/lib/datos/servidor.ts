import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sesionDesdeUsuario } from "@/lib/auth/roles";
import { PERFIL, catalogoDelMenu } from "@/lib/negocio/perfil";
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

/** Fila que marca que el menú impreso ya se cargó: después manda lo que edite el admin. */
const MARCA_MENU = "menu_cortmart_2026_10";

export async function leerEstado(): Promise<Leido> {
  const { data, error } = await createAdminClient().from("estado_app").select("clave, valor, version");
  if (error) throw new Error(`No se pudo leer el estado: ${error.message}`);
  const parcial: Partial<Estado> = {};
  const versiones: Leido["versiones"] = {};
  let menuCargado = false;
  for (const fila of data ?? []) {
    if (fila.clave === MARCA_MENU) {
      menuCargado = true;
      continue;
    }
    if (fila.clave.startsWith("menu_")) continue;
    (parcial as Record<string, unknown>)[fila.clave] = fila.valor;
    versiones[fila.clave as Clave] = Number(fila.version);
  }
  const estado = normalizarEstado(parcial);
  if (!menuCargado) return cargarMenuImpreso(estado, versiones);
  return { estado, versiones };
}

/**
 * Una sola vez: deja el catálogo igual al menú impreso y llena WhatsApp y
 * redes si estaban vacíos. Si otro proceso escribió en medio, se deja para
 * la siguiente lectura.
 */
async function cargarMenuImpreso(estado: Estado, versiones: Leido["versiones"]): Promise<Leido> {
  const servicios = catalogoDelMenu(estado.servicios);
  const b = estado.barberia;
  const barberia = {
    ...b,
    telefono: b.telefono.trim() || PERFIL.telefono,
    whatsapp: b.whatsapp.trim() || PERFIL.whatsapp,
    instagram: b.instagram.trim() || PERFIL.instagram,
    tiktok: b.tiktok.trim() || PERFIL.tiktok,
    anio_fundacion: b.anio_fundacion.trim() || PERFIL.anio_fundacion,
    eslogan: !b.eslogan.trim() || b.eslogan === "Cortes con detalle, atención de lujo" ? PERFIL.eslogan : b.eslogan,
  };
  const { data: ok, error } = await createAdminClient().rpc("fn_guardar_estado", {
    p_cambios: { servicios, barberia, [MARCA_MENU]: { cargado_en: new Date().toISOString() } },
    p_versiones: { servicios: versiones.servicios ?? 0, barberia: versiones.barberia ?? 0, [MARCA_MENU]: 0 },
  });
  if (error || !ok) {
    if (error) console.error("No se pudo cargar el menú impreso:", error.message);
    return { estado, versiones };
  }
  const siguiente = (v: number | undefined) => (v ?? 0) + 1;
  return {
    estado: { ...estado, servicios, barberia },
    versiones: { ...versiones, servicios: siguiente(versiones.servicios), barberia: siguiente(versiones.barberia) },
  };
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
