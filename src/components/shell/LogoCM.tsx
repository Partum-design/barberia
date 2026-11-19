/* eslint-disable @next/next/no-img-element */

/**
 * Monograma CM de la barbería (public/marca). Regla de `tono`: negro sobre
 * fondo claro, blanco sobre fondo oscuro. La app es oscura: blanco por defecto.
 */
export function LogoCM({ tono = "blanco", className = "" }: { tono?: "negro" | "blanco"; className?: string }) {
  return <img src={`/marca/logo-cm-${tono}.png`} alt="" aria-hidden className={`logo-cm ${className}`} width={64} height={64} />;
}
