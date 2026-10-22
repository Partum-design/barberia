import { normalizarTelefono } from "@/lib/datos/modelo";

/**
 * Correo interno de quien entra con su número. `.invalid` es un dominio
 * reservado (RFC 2606): nunca recibe correo, así que nadie puede pedir un
 * restablecimiento de contraseña a esa dirección y quedarse con la cuenta.
 * Se deriva del número, así que el navegador lo calcula sin preguntar.
 */
export const correoDeTelefono = (telefono: string) => `${normalizarTelefono(telefono)}@telefono.invalid`;
export const esCorreoInterno = (email: string | null | undefined) => Boolean(email?.endsWith("@telefono.invalid"));

/** ¿Lo escrito parece un número de celular (y no un correo)? */
export const pareceTelefono = (valor: string) => !valor.includes("@") && normalizarTelefono(valor).length >= 10;
