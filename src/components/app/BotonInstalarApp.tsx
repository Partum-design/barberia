"use client";

import { useState } from "react";
import { Download, Share } from "lucide-react";
import { useInstalar } from "@/lib/app-nativa";

/** "Descargar app" en la portada: instala con un clic o explica cómo en iPhone. */
export function BotonInstalarApp() {
  const app = useInstalar();
  const [ayuda, setAyuda] = useState(false);
  if (app.instalada || (!app.lista && !app.ios)) return null;
  return (
    <span className="cm-instalar">
      <button type="button" onClick={() => (app.lista ? void app.instalar() : setAyuda((v) => !v))}>
        <Download /> Descargar app
      </button>
      {ayuda && (
        <small role="status">
          En Safari toca <Share className="inline" /> Compartir → «Agregar a inicio».
        </small>
      )}
    </span>
  );
}
