"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { BellRing, X } from "lucide-react";
import { cerrarAvisoEnPantalla, marcarLeidos, useAvisos } from "@/lib/avisos-en-vivo";
import "./app.css";

const DURACION = 8000;

/**
 * Aviso en pantalla cuando llega uno nuevo con la app abierta. Sale arriba
 * (no tapa la barra inferior ni el botón de agendar) y se va solo.
 */
export function ToastAvisos() {
  const { enPantalla } = useAvisos();
  const router = useRouter();

  useEffect(() => {
    if (!enPantalla) return;
    const t = window.setTimeout(cerrarAvisoEnPantalla, DURACION);
    return () => window.clearTimeout(t);
  }, [enPantalla]);

  if (!enPantalla) return null;

  function abrir() {
    const url = enPantalla?.url || "/";
    void marcarLeidos();
    router.push(url);
  }

  return (
    <div className="aviso-vivo" role="status" aria-live="polite" key={enPantalla.id}>
      <span className="aviso-vivo-icono" aria-hidden>
        <BellRing className="h-4 w-4" />
      </span>
      <div className="aviso-vivo-texto">
        <b>{enPantalla.titulo}</b>
        {enPantalla.cuerpo && <span>{enPantalla.cuerpo}</span>}
        <button type="button" className="aviso-vivo-ver" onClick={abrir}>
          Ver
        </button>
      </div>
      <button type="button" className="aviso-vivo-cerrar" onClick={cerrarAvisoEnPantalla} aria-label="Cerrar aviso">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
