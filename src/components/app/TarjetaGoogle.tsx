"use client";

import { useEffect, useState } from "react";
import { CalendarCheck, CheckCircle2, Loader2 } from "lucide-react";
import { vincularGoogleCalendar } from "@/lib/auth/google";
import { LogoGoogle } from "@/components/app/LogoGoogle";
import "./app.css";

type Estado = { vinculado: boolean; email: string | null; disponible: boolean };

/** Vincula la cuenta con Google para que cada cita aparezca sola en su Google Calendar. */
export function TarjetaGoogle({ volverA = "/cuenta" }: { volverA?: string }) {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const r = p.get("calendario");
    if (r === "ok") setAviso("¡Listo! Tus citas ya aparecen en tu Google Calendar.");
    if (r === "sin_permiso") setError("Google no dio permiso para el calendario. Inténtalo de nuevo y marca la casilla del calendario.");
    if (r) {
      p.delete("calendario");
      const q = p.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${q ? `?${q}` : ""}`);
    }
    fetch("/api/google/calendario", { cache: "no-store", credentials: "same-origin" })
      .then((res) => res.json())
      .then((d: Estado) => setEstado(d))
      .catch(() => setEstado({ vinculado: false, email: null, disponible: false }));
  }, []);

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

  async function desvincular() {
    if (!window.confirm("¿Dejar de enviar tus citas a Google Calendar? Las que ya están ahí se quedan.")) return;
    await fetch("/api/google/calendario", { method: "DELETE", credentials: "same-origin" });
    setEstado((e) => (e ? { ...e, vinculado: false, email: null } : e));
    setAviso(null);
  }

  return (
    <section className="google-tarjeta anim-in">
      <div className="google-tarjeta-head">
        <span className="google-tarjeta-logo">
          <LogoGoogle className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Google Calendar</p>
          <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
            Tus citas aparecen solas en tu calendario, con recordatorio una hora antes.
          </p>
        </div>
      </div>

      {aviso && (
        <p className="aviso-ok anim-pop mt-3" role="status">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> {aviso}
        </p>
      )}
      {error && (
        <p className="form-error mt-3" role="alert">
          {error}
        </p>
      )}

      <div className="mt-4">
        {estado === null ? (
          <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--ink-muted)" }} />
        ) : estado.vinculado ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="chip-ok">
              <CalendarCheck className="h-3.5 w-3.5" /> Sincronizado{estado.email ? ` · ${estado.email}` : ""}
            </span>
            <button type="button" className="btn-linea is-sm" onClick={() => void desvincular()}>
              Dejar de sincronizar
            </button>
          </div>
        ) : (
          <>
            <button type="button" className="google-boton" onClick={() => void vincular()} disabled={cargando}>
              {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogoGoogle className="h-5 w-5" />}
              Vincular con Google
            </button>
            {!estado.disponible && (
              <p className="mt-2 text-[0.7rem]" style={{ color: "var(--ink-faint)" }}>
                Mientras tanto, usa «Agregar a Google Calendar» en cada cita.
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
