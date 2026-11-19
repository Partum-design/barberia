"use client";

import { useEffect, useState } from "react";
import { Loader2, Sparkles, X } from "lucide-react";
import { vincularGoogleCalendar } from "@/lib/auth/google";
import { LogoGoogle } from "@/components/app/LogoGoogle";
import "./app.css";

const CLAVE = (id: string) => `cortmart-aviso-google-${id}`;

const leer = (k: string) => {
  try {
    return window.localStorage.getItem(k);
  } catch {
    return null;
  }
};
const guardar = (k: string, v: string) => {
  try {
    window.localStorage.setItem(k, v);
  } catch {
    /* sin almacenamiento: se vuelve a mostrar en la siguiente visita */
  }
};

/**
 * Aviso de novedad: «Ya puedes vincular tu cuenta de Google». Sale arriba del
 * panel a quien aún no la vincula (clientes en /cuenta, barberos en su
 * agenda) hasta que la vincule o lo cierre con «Ahora no».
 */
export function AvisoGoogle({ usuarioId, volverA, rol = "cliente" }: { usuarioId: string; volverA: string; rol?: "cliente" | "barbero" }) {
  const [visible, setVisible] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!usuarioId || leer(CLAVE(usuarioId))) return;
    // Recién vuelve de vincular: la tarjeta de Google ya da el «¡Listo!».
    if (new URLSearchParams(window.location.search).has("calendario")) return;
    let vivo = true;
    fetch("/api/google/calendario", { cache: "no-store", credentials: "same-origin" })
      .then((r) => r.json())
      .then((d: { vinculado: boolean; disponible: boolean }) => vivo && setVisible(d.disponible && !d.vinculado))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [usuarioId]);

  if (!visible) return null;

  function cerrar() {
    guardar(CLAVE(usuarioId), "1");
    setVisible(false);
  }

  async function vincular() {
    setError(null);
    setCargando(true);
    try {
      await vincularGoogleCalendar(volverA);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo abrir Google.");
      setCargando(false);
    }
  }

  return (
    <section className="aviso-google anim-pop mb-6" role="region" aria-label="Novedad: vincula tu cuenta de Google">
      <button type="button" className="aviso-google-cerrar" onClick={cerrar} aria-label="Cerrar aviso">
        <X className="h-4 w-4" />
      </button>
      <div className="aviso-google-head">
        <span className="google-tarjeta-logo">
          <LogoGoogle className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="aviso-google-kicker">
            <Sparkles className="h-3.5 w-3.5" /> Nuevo
          </p>
          <p className="font-semibold">Ya puedes vincular tu cuenta de Google</p>
          <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
            {rol === "barbero"
              ? "Tus citas aparecen solas en tu Google Calendar, con recordatorio una hora antes. Si alguien mueve o cancela, se actualiza solo."
              : "Entra con un toque y tus citas aparecen solas en tu Google Calendar, con recordatorio una hora antes."}
          </p>
        </div>
      </div>
      {error && (
        <p className="form-error mt-3" role="alert">
          {error}
        </p>
      )}
      <div className="aviso-google-acciones">
        <button type="button" className="google-boton" onClick={() => void vincular()} disabled={cargando}>
          {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogoGoogle className="h-5 w-5" />}
          Vincular con Google
        </button>
        <button type="button" className="btn-linea is-sm" onClick={cerrar}>
          Ahora no
        </button>
      </div>
    </section>
  );
}
