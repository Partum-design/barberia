"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

/**
 * Ventana sobre el panel para formularios cortos (alta de cliente, editar
 * barbero, reprogramar cita). En el teléfono sube desde abajo como la hoja
 * "Más"; en escritorio queda centrada. Se cierra con Escape o tocando fuera.
 */
export function Modal({
  titulo,
  descripcion,
  onCerrar,
  children,
  ancho = "md",
}: {
  titulo: string;
  descripcion?: string;
  onCerrar: () => void;
  children: ReactNode;
  ancho?: "md" | "lg";
}) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", tecla);
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.querySelector<HTMLElement>("input, select, textarea, button:not(.modal-cerrar)")?.focus();
    return () => {
      window.removeEventListener("keydown", tecla);
      document.body.style.overflow = previo;
    };
  }, [onCerrar]);

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={titulo}>
      <button type="button" className="modal-fondo" aria-label="Cerrar" onClick={onCerrar} />
      <div ref={panel} className={`modal-panel ${ancho === "lg" ? "is-lg" : ""}`}>
        <span className="app-sheet-asa modal-asa" aria-hidden />
        <header className="modal-head">
          <div className="min-w-0">
            <h2>{titulo}</h2>
            {descripcion && <p>{descripcion}</p>}
          </div>
          <button type="button" className="modal-cerrar" onClick={onCerrar} aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

/** Campo con etiqueta y ayuda, para que todos los formularios se lean igual. */
export function Campo({
  label,
  ayuda,
  children,
  ancho,
}: {
  label: string;
  ayuda?: string;
  children: ReactNode;
  ancho?: "completo";
}) {
  return (
    <label className={`campo ${ancho === "completo" ? "is-full" : ""}`}>
      <span className="campo-label">{label}</span>
      {children}
      {ayuda && <span className="campo-ayuda">{ayuda}</span>}
    </label>
  );
}

/** Interruptor accesible (role="switch") con la piel del panel. */
export function Interruptor({
  activo,
  onChange,
  label,
  ayuda,
}: {
  activo: boolean;
  onChange: (v: boolean) => void;
  label: string;
  ayuda?: string;
}) {
  return (
    <button type="button" role="switch" aria-checked={activo} onClick={() => onChange(!activo)} className="interruptor">
      <span className="min-w-0 text-left">
        <span className="block font-medium">{label}</span>
        {ayuda && <span className="campo-ayuda block">{ayuda}</span>}
      </span>
      <span className={`interruptor-pista ${activo ? "is-on" : ""}`} aria-hidden>
        <span />
      </span>
    </button>
  );
}
