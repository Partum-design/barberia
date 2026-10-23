"use client";

import { ChevronRight, Download } from "lucide-react";
import { abrirInstalacion, useInstalar } from "@/lib/app-nativa";

/**
 * Botones que abren la ventana "Instala la app" (InvitacionApp):
 *   · icono   → el ícono de descargar del menú, siempre a la mano
 *   · tarjeta → la invitación de la portada, con el ícono de la app
 *   · enlace  → texto simple (pie, hojas del panel)
 * Si la app ya está instalada no se muestran.
 */
export function BotonInstalarApp({ variante = "tarjeta", className = "" }: { variante?: "icono" | "tarjeta" | "enlace"; className?: string }) {
  const app = useInstalar();
  if (app.instalada) return null;

  if (variante === "icono") {
    return (
      <button type="button" className={`instalar-boton-icono ${className}`} onClick={abrirInstalacion} aria-label="Instalar la app de CortMart">
        <Download aria-hidden />
        <span className="instalar-punto" aria-hidden />
      </button>
    );
  }

  if (variante === "enlace") {
    return (
      <button type="button" className={`instalar-boton-enlace ${className}`} onClick={abrirInstalacion}>
        <Download aria-hidden /> Instalar la app
      </button>
    );
  }

  return (
    <button type="button" className={`instalar-boton-tarjeta ${className}`} onClick={abrirInstalacion}>
      <span className="instalar-boton-logo" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/iconos/icono-192.png" alt="" width={48} height={48} />
      </span>
      <span className="instalar-boton-texto">
        <b>Descarga la app</b>
        <small>Gratis · Android y iPhone</small>
      </span>
      <span className="instalar-boton-accion" aria-hidden>
        <Download />
        <ChevronRight />
      </span>
    </button>
  );
}
