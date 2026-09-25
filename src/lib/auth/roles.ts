import type { Rol, Sesion } from "@/lib/datos/modelo";

/** Destino de cada rol tras iniciar sesión. */
export const DESTINO_POR_ROL: Record<Rol, string> = {
  cliente: "/cuenta",
  barbero: "/dashboard/barbero",
  admin: "/dashboard/admin",
};

/** Prefijos de ruta que sólo puede visitar cada rol. */
export const RUTAS_PROTEGIDAS: { prefijo: string; roles: Rol[] }[] = [
  { prefijo: "/dashboard/admin", roles: ["admin"] },
  { prefijo: "/dashboard/barbero", roles: ["barbero", "admin"] },
  { prefijo: "/cuenta", roles: ["cliente", "barbero", "admin"] },
];

const ROLES_VALIDOS: Rol[] = ["cliente", "barbero", "admin"];

export function esRolValido(valor: unknown): valor is Rol {
  return typeof valor === "string" && (ROLES_VALIDOS as string[]).includes(valor);
}

/**
 * Resuelve el rol de un usuario autenticado.
 *
 * Sólo cuenta `app_metadata`: lo escribe el servidor con la llave service_role
 * y el usuario no puede tocarlo. `user_metadata` lo edita el propio usuario
 * desde el navegador, así que fiarse de él permitiría autoproclamarse admin.
 * Sin rol asignado, el usuario es cliente.
 */
export function resolverRol(usuario: {
  app_metadata?: Record<string, unknown> | null;
}): Rol {
  const deApp = usuario.app_metadata?.rol;
  return esRolValido(deApp) ? deApp : "cliente";
}

/** Etiqueta legible bajo el nombre en el panel. */
export function subtituloDeRol(rol: Rol): string {
  if (rol === "admin") return "Administrador";
  if (rol === "barbero") return "Barbero";
  return "Cliente";
}

/** Construye la sesión que consume toda la interfaz a partir del usuario real. */
export function sesionDesdeUsuario(usuario: {
  id: string;
  email?: string | null;
  app_metadata?: Record<string, unknown> | null;
  user_metadata?: Record<string, unknown> | null;
}): Sesion {
  const rol = resolverRol(usuario);
  const meta = usuario.user_metadata ?? {};
  const nombre =
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    (typeof meta.nombre === "string" && meta.nombre) ||
    usuario.email?.split("@")[0] ||
    "Mi cuenta";

  return {
    rol,
    id: usuario.id,
    nombre,
    subtitulo:
      typeof meta.especialidad === "string" && meta.especialidad
        ? meta.especialidad
        : subtituloDeRol(rol),
  };
}
