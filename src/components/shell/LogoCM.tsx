/* eslint-disable @next/next/no-img-element */

/**
 * Monograma CM de la barbería (public/marca), recortado a su silueta para que
 * llene el espacio. Regla de `tono`: negro sobre fondo claro, blanco sobre
 * fondo oscuro. La app es oscura: blanco por defecto.
 */
export function LogoCM({ tono = "blanco", className = "" }: { tono?: "negro" | "blanco"; className?: string }) {
  return (
    <img
      src={`/marca/logo-cm-${tono}-recorte.png`}
      alt=""
      aria-hidden
      className={`logo-cm ${className}`}
      width={81}
      height={100}
    />
  );
}
