"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { enlaceDeCita } from "@/lib/store";

/**
 * QR de una cita. Lleva un enlace a /confirmar: el escáner del mostrador lo
 * lee y, si alguien lo abre con la cámara del teléfono, también llega a la
 * pantalla correcta.
 */
export function QrCita({ citaId, tamano = 220 }: { citaId: string; tamano?: number }) {
  const [svg, setSvg] = useState("");

  useEffect(() => {
    let vivo = true;
    QRCode.toString(enlaceDeCita(citaId, window.location.origin), {
      type: "svg",
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#120802", light: "#ffffff" },
    }).then((s) => vivo && setSvg(s));
    return () => {
      vivo = false;
    };
  }, [citaId]);

  return (
    <div
      className="qr-cita"
      style={{ width: tamano, height: tamano }}
      role="img"
      aria-label="Código QR de la cita"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
