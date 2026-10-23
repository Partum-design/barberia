/* eslint-disable @next/next/no-img-element */

/** Monograma CM de la barbería (public/marca). `tono` según el fondo. */
export function LogoCM({ tono = "negro", className = "" }: { tono?: "negro" | "naranja"; className?: string }) {
  return <img src={`/marca/logo-cm-${tono}.png`} alt="" aria-hidden className={`logo-cm ${className}`} width={64} height={64} />;
}
