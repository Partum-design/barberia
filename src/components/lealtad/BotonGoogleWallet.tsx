"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { solicitarPase } from "@/lib/lealtad";
import type { DatosPase } from "@/lib/integrations/google-wallet";

/** Icono de cartera en los colores de Google, dibujado a mano. */
function IconoWallet() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5">
      <rect x="2" y="5" width="20" height="4.2" rx="1.6" fill="#4285F4" />
      <rect x="2" y="8.2" width="20" height="4.2" rx="1.6" fill="#34A853" />
      <rect x="2" y="11.4" width="20" height="4.2" rx="1.6" fill="#FBBC04" />
      <path d="M2 14.6h7.2a2.8 2.8 0 0 0 5.6 0H22V18a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-3.4Z" fill="#EA4335" />
    </svg>
  );
}

/**
 * Botón "Agregar a Google Wallet". Pide el enlace firmado al servidor y lo
 * abre; si Wallet no está configurado, dice exactamente qué falta.
 */
export function BotonGoogleWallet({
  pase,
  onGuardada,
  variante = "boton",
}: {
  pase: DatosPase;
  onGuardada?: () => void;
  /** "enlace" devuelve el URL para copiarlo o mandarlo por WhatsApp */
  variante?: "boton" | "enlace";
}) {
  const [estado, setEstado] = useState<"reposo" | "cargando" | "listo">("reposo");
  const [error, setError] = useState<string | null>(null);
  const [enlace, setEnlace] = useState<string | null>(null);

  async function pedir() {
    setEstado("cargando");
    setError(null);
    const r = await solicitarPase(pase);
    if (!r.url) {
      setEstado("reposo");
      setError(
        r.configurado === false
          ? `Google Wallet aún no está activado. Falta definir: ${r.faltan?.join(", ")}.`
          : r.error ?? "No se pudo generar el pase."
      );
      return;
    }
    onGuardada?.();
    if (variante === "enlace") {
      setEnlace(r.url);
      setEstado("listo");
      return;
    }
    setEstado("listo");
    window.open(r.url, "_blank", "noopener");
  }

  return (
    <div className="grid gap-2">
      <button type="button" onClick={pedir} disabled={estado === "cargando"} className="wallet-button">
        {estado === "cargando" ? <Loader2 className="h-5 w-5 animate-spin" /> : <IconoWallet />}
        <span>{variante === "enlace" ? "Generar enlace de Google Wallet" : "Agregar a Google Wallet"}</span>
      </button>
      {estado === "listo" && variante === "boton" && (
        <p className="wallet-note is-ok">
          <CheckCircle2 /> Se abrió Google Wallet en otra pestaña. Guarda la tarjeta y tus sellos se
          actualizarán solos.
        </p>
      )}
      {enlace && (
        <div className="wallet-note is-ok">
          <CheckCircle2 />
          <span className="min-w-0 flex-1">
            Enlace listo.{" "}
            <a href={`https://wa.me/?text=${encodeURIComponent(`Tu tarjeta de lealtad de ${pase.negocio.nombre}: ${enlace}`)}`} target="_blank" rel="noopener noreferrer" className="underline">
              Enviar por WhatsApp
            </a>{" "}
            ·{" "}
            <button type="button" className="underline" onClick={() => navigator.clipboard?.writeText(enlace)}>
              Copiar
            </button>
          </span>
        </div>
      )}
      {error && (
        <p className="wallet-note is-error" role="alert">
          <AlertCircle /> {error}
        </p>
      )}
    </div>
  );
}
