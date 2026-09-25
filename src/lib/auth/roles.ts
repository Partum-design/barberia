import type { RolDemo, SesionDemo } from "@/lib/demo-store";

/** Destino de cada rol tras iniciar sesión. */
export const DESTINO_POR_ROL: Record<RolDemo, string> = {
  cliente: "/cuenta",
  barbero: "/dashboard/barbero",
  admin: "/dashboard/admin",
};

/** Prefijos de ruta que sólo puede visitar cada rol. */
export const RUTAS_PROTEGIDAS: { prefijo: string; roles: RolDemo[] }[] = [
  { prefijo: "/dashboard/admin", roles: ["admin"] },
  { prefijo: "/dashboard/barbero", roles: ["barbero", "admin"] },
  { prefijo: "/cuenta", roles: ["cliente", "barbero", "admin"] },
];

const ROLES_VALIDOS: RolDemo[] = ["cliente", "barbero", "admin"];

export function esRolValido(valor: unknown): valor is RolDemo {
  return typeof valor === "string" && (ROLES_VALIDOS as string[]).includes(valor);
}

/**
 * Resuelve el rol de un usuario autenticado.
 *
 * El orden importa: `app_metadata` lo escribe el servidor y el usuario no puede
 * tocarlo, así que manda sobre `user_metadata`, que sí es editable desde el
 * cliente. Sin nada de eso, el rol por defecto es el menos privilegiado.
 */
export function resolverRol(usuario: {
  app_metadata?: Record<string, unknown> | null;
  user_metadata?: Record<string, unknown> | null;
}): RolDemo {
  const deApp = usuario.app_metadata?.rol ?? usuario.app_metadata?.role;
  if (esRolValido(deApp)) return deApp;
  const deUser = usuario.user_metadata?.rol ?? usuario.user_metadata?.role;
  if (esRolValido(deUser)) return deUser;
  return "cliente";
}

/** Etiqueta legible bajo el nombre en el panel. */
export function subtituloDeRol(rol: RolDemo): string {
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
}): SesionDemo {
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
