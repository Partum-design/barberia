"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCw, Wrench } from "lucide-react";
import { useCargaBarberia } from "@/lib/store";
import { repararApp } from "@/lib/reparar-app";

/**
 * Lo que se ve mientras llegan los datos del panel. Antes era una pantalla en
 * blanco; ahora hay un indicador y, si tarda o falla, botones para reintentar
 * o limpiar la app instalada.
 */
export function CargandoPanel() {
  const { error, reintentar } = useCargaBarberia();
  const [lento, setLento] = useState(false);
  const [trabajando, setTrabajando] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setLento(true), 8000);
    return () => window.clearTimeout(t);
  }, []);

  const conProblema = error || lento;

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center"
      aria-busy={!conProblema}
      aria-live="polite"
    >
      {!conProblema || trabajando ? (
        <>
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--ink-muted)" }} aria-hidden />
          <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
            Cargando…
          </p>
        </>
      ) : (
        <>
          <p className="text-lg font-semibold">
            {error ? "No se pudo cargar la información" : "Está tardando más de lo normal"}
          </p>
          <p className="max-w-sm text-sm" style={{ color: "var(--ink-muted)" }}>
            Revisa tu conexión y vuelve a intentar. Si sigue igual, «Reparar la app» limpia lo que el teléfono guardó
            de la app sin cerrar tu sesión.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              className="btn-gold px-5 py-2.5 text-sm"
              onClick={async () => {
                setTrabajando(true);
                setLento(false);
                await reintentar();
                setTrabajando(false);
                window.setTimeout(() => setLento(true), 8000);
              }}
            >
              <RefreshCw className="h-4 w-4" /> Reintentar
            </button>
            <button
              type="button"
              className="btn-linea"
              onClick={() => {
                setTrabajando(true);
                void repararApp();
              }}
            >
              <Wrench className="h-4 w-4" /> Reparar la app
            </button>
          </div>
        </>
      )}
    </main>
  );
}
