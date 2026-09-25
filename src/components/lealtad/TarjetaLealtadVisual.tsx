"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, Scissors } from "lucide-react";

/**
 * La tarjeta tal como la ve el cliente: nombre del negocio, titular, sellos y
 * un QR con su número para que el mostrador la encuentre al instante.
 */
export function TarjetaLealtadVisual({
  negocio,
  titular,
  numero,
  progreso,
  requerido,
  disponibles,
  descuento,
  suspendida = false,
  compacta = false,
}: {
  negocio: string;
  titular: string;
  numero: string;
  progreso: number;
  requerido: number;
  disponibles: number;
  descuento: number;
  suspendida?: boolean;
  compacta?: boolean;
}) {
  const [qr, setQr] = useState<string>("");

  useEffect(() => {
    let vivo = true;
    QRCode.toString(numero, {
      type: "svg",
      margin: 0,
      errorCorrectionLevel: "M",
      color: { dark: "#14100b", light: "#00000000" },
    }).then((svg) => vivo && setQr(svg));
    return () => {
      vivo = false;
    };
  }, [numero]);

  return (
    <article className={`loyalty-card ${compacta ? "is-compact" : ""} ${suspendida ? "is-suspended" : ""}`}>
      <div className="loyalty-card-sheen" aria-hidden />
      <header className="loyalty-card-head">
        <span className="loyalty-card-mark">
          <Scissors className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <strong>{negocio}</strong>
          <small>Tarjeta de lealtad</small>
        </span>
        {suspendida && <span className="loyalty-card-flag">Suspendida</span>}
      </header>

      <div className="loyalty-card-stamps" role="img" aria-label={`${progreso} de ${requerido} sellos`}>
        {Array.from({ length: requerido }).map((_, i) => (
          <span key={i} className={i < progreso ? "is-on" : ""}>
            {i < progreso ? <Check /> : i + 1}
          </span>
        ))}
      </div>

      <footer className="loyalty-card-foot">
        <div className="min-w-0">
          <small>Titular</small>
          <strong className="truncate">{titular}</strong>
          <span className="loyalty-card-number">{numero}</span>
          <p className="loyalty-card-reward">
            {disponibles > 0
              ? `${disponibles} recompensa${disponibles === 1 ? "" : "s"} de ${descuento}% lista${disponibles === 1 ? "" : "s"}`
              : `${requerido - progreso} sello${requerido - progreso === 1 ? "" : "s"} para ${descuento}% de descuento`}
          </p>
        </div>
        <div className="loyalty-card-qr" aria-label={`Código QR de la tarjeta ${numero}`} dangerouslySetInnerHTML={{ __html: qr }} />
      </footer>
    </article>
  );
}
