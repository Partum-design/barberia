"use client";

import { useEffect } from "react";
import { RefreshCw, Wrench } from "lucide-react";
import { esErrorDeVersion, recargarUnaVez, repararApp } from "@/lib/reparar-app";

/**
 * Si una pantalla falla al dibujarse, en lugar de quedar en blanco se ofrece
 * reintentar o reparar la app. Si el fallo es por una versión vieja (la app
 * instalada siguió abierta tras una actualización), recarga sola.
 */
export default function ErrorDePantalla({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
    if (esErrorDeVersion(error)) recargarUnaVez();
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-lg font-semibold">Algo salió mal al abrir esta pantalla</p>
      <p className="max-w-sm text-sm" style={{ color: "var(--ink-muted)" }}>
        Vuelve a intentar. Si sigue igual, «Reparar la app» limpia lo que el teléfono guardó de la app sin cerrar tu
        sesión.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" className="btn-gold px-5 py-2.5 text-sm" onClick={() => reset()}>
          <RefreshCw className="h-4 w-4" /> Reintentar
        </button>
        <button type="button" className="btn-linea" onClick={() => void repararApp()}>
          <Wrench className="h-4 w-4" /> Reparar la app
        </button>
      </div>
    </main>
  );
}
