"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { guardarQrComoImagen, type DatosImagenQr } from "@/lib/qr-imagen";

/** "Guardar imagen": el QR con su código, listo para la galería del teléfono. */
export function BotonGuardarQr({ datos, className = "btn-linea" }: { datos: DatosImagenQr; className?: string }) {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  async function guardar() {
    setCargando(true);
    setError("");
    try {
      await guardarQrComoImagen(datos);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la imagen.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="grid justify-items-center gap-1.5">
      <button type="button" className={className} onClick={guardar} disabled={cargando}>
        {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Guardar imagen
      </button>
      {error && (
        <p className="text-xs" role="alert" style={{ color: "#f0a59c" }}>
          {error}
        </p>
      )}
    </div>
  );
}
