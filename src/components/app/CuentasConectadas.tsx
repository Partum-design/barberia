"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Bell, BellOff, BellRing, CalendarCheck, CheckCircle2, Loader2, UserRound } from "lucide-react";
import { desvincularCuentaGoogle, vincularCuentaGoogle, vincularGoogleCalendar } from "@/lib/auth/google";
import { useNotificaciones } from "@/lib/app-nativa";
import { LogoGoogle } from "@/components/app/LogoGoogle";
import "./app.css";

type EstadoGoogle = { conectada: boolean; email: string | null; puede_desvincular: boolean };
type EstadoCalendario = { vinculado: boolean; email: string | null; disponible: boolean };

const leer = async <T,>(url: string): Promise<T | null> => {
  try {
    const res = await fetch(url, { cache: "no-store", credentials: "same-origin" });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
};

/**
 * Cuentas conectadas: un solo lugar para conectar y desconectar Google (para
 * entrar), Google Calendar (sus citas en su calendario) y los avisos de este
 * dispositivo. Lo usan el cliente en /cuenta y el barbero en su configuración.
 */
export function CuentasConectadas({ volverA = "/cuenta" }: { volverA?: string }) {
  const [google, setGoogle] = useState<EstadoGoogle | null>(null);
  const [calendario, setCalendario] = useState<EstadoCalendario | null>(null);
  const [ocupado, setOcupado] = useState<"google" | "calendario" | "avisos" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const push = useNotificaciones();

  const recargar = useCallback(async () => {
    const [g, c] = await Promise.all([
      leer<EstadoGoogle>("/api/cuenta/google"),
      leer<EstadoCalendario>("/api/google/calendario"),
    ]);
    setGoogle(g ?? { conectada: false, email: null, puede_desvincular: false });
    setCalendario(c ?? { vinculado: false, email: null, disponible: false });
  }, []);

  useEffect(() => {
    // Regreso de Google: ?calendario=ok | sin_permiso
    const p = new URLSearchParams(window.location.search);
    const r = p.get("calendario");
    if (r === "ok") setAviso("¡Listo! Tus citas ya aparecen en tu Google Calendar.");
    if (r === "sin_permiso") setError("Google no dio permiso para el calendario. Inténtalo de nuevo y marca la casilla del calendario.");
    if (r) {
      p.delete("calendario");
      const q = p.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${q ? `?${q}` : ""}`);
    }
    void recargar();
  }, [recargar]);

  async function conTrabajo(cual: "google" | "calendario" | "avisos", f: () => Promise<void>) {
    setError(null);
    setAviso(null);
    setOcupado(cual);
    try {
      await f();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo completar. Inténtalo de nuevo.");
    } finally {
      setOcupado(null);
    }
  }

  const vincularGoogle = () => conTrabajo("google", () => vincularCuentaGoogle(volverA));
  const desvincularGoogle = () =>
    conTrabajo("google", async () => {
      if (
        !window.confirm(
          "¿Desvincular tu cuenta de Google? Podrás seguir entrando con tu número o correo y tu contraseña. Tu Google Calendar sigue sincronizado hasta que lo detengas aquí abajo."
        )
      )
        return;
      await desvincularCuentaGoogle();
      setAviso("Google ya no es una forma de entrar a tu cuenta.");
      await recargar();
    });

  const vincularCalendario = () => conTrabajo("calendario", () => vincularGoogleCalendar(volverA));
  const dejarCalendario = () =>
    conTrabajo("calendario", async () => {
      if (
        !window.confirm(
          "¿Dejar de enviar tus citas a Google Calendar? Las citas que ya están en tu calendario se quedan ahí; sólo dejamos de agregar nuevas."
        )
      )
        return;
      const res = await fetch("/api/google/calendario", { method: "DELETE", credentials: "same-origin" });
      if (!res.ok) throw new Error("No se pudo dejar de sincronizar. Inténtalo de nuevo.");
      setAviso("Listo: ya no enviamos tus citas a Google Calendar.");
      await recargar();
    });

  const activarAvisos = () =>
    conTrabajo("avisos", async () => {
      await push.activar();
    });
  const desactivarAvisos = () => conTrabajo("avisos", () => push.desactivar());

  return (
    <section className="cuentas" aria-labelledby="cuentas-titulo">
      <header className="cuentas-head">
        <h2 id="cuentas-titulo">Cuentas conectadas</h2>
        <p>Conecta o desconecta todo desde aquí.</p>
      </header>

      {aviso && (
        <p className="cuentas-aviso" role="status">
          <CheckCircle2 aria-hidden /> {aviso}
        </p>
      )}
      {(error || push.error) && (
        <p className="cuentas-error" role="alert">
          {error ?? push.error}
        </p>
      )}

      <ul className="cuentas-lista">
        {/* Google para entrar */}
        <Fila
          icono={<LogoGoogle className="h-5 w-5" />}
          titulo="Cuenta de Google"
          detalle="Entra con un toque, sin escribir tu contraseña."
          estado={
            google === null ? null : google.conectada ? (
              <Estado ok>Conectada{google.email ? ` · ${google.email}` : ""}</Estado>
            ) : (
              <Estado>No conectada</Estado>
            )
          }
          accion={
            google === null ? null : google.conectada ? (
              google.puede_desvincular ? (
                <button type="button" className="btn-linea is-sm" onClick={() => void desvincularGoogle()} disabled={ocupado !== null}>
                  {ocupado === "google" ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Desvincular
                </button>
              ) : (
                <small className="cuentas-nota">Es tu única forma de entrar: crea una contraseña para poder desvincularla.</small>
              )
            ) : (
              <button type="button" className="google-boton is-sm" onClick={() => void vincularGoogle()} disabled={ocupado !== null}>
                {ocupado === "google" ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogoGoogle className="h-4 w-4" />}
                Vincular con Google
              </button>
            )
          }
        />

        {/* Google Calendar */}
        <Fila
          icono={<CalendarCheck aria-hidden />}
          titulo="Google Calendar"
          detalle="Tus citas aparecen solas en tu calendario, con recordatorio una hora antes."
          estado={
            calendario === null ? null : calendario.vinculado ? (
              <Estado ok>Sincronizado{calendario.email ? ` · ${calendario.email}` : ""}</Estado>
            ) : (
              <Estado>No sincronizado</Estado>
            )
          }
          accion={
            calendario === null ? null : calendario.vinculado ? (
              <button type="button" className="btn-linea is-sm" onClick={() => void dejarCalendario()} disabled={ocupado !== null}>
                {ocupado === "calendario" ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Dejar de sincronizar
              </button>
            ) : calendario.disponible ? (
              <button type="button" className="google-boton is-sm" onClick={() => void vincularCalendario()} disabled={ocupado !== null}>
                {ocupado === "calendario" ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogoGoogle className="h-4 w-4" />}
                Vincular con Google
              </button>
            ) : (
              <small className="cuentas-nota">Mientras tanto, usa «Agregar a Google Calendar» en cada cita.</small>
            )
          }
        />

        {/* Avisos en este dispositivo */}
        <Fila
          icono={push.estado === "activo" ? <BellRing aria-hidden /> : push.estado === "bloqueado" ? <BellOff aria-hidden /> : <Bell aria-hidden />}
          titulo="Notificaciones en este dispositivo"
          detalle="Te avisamos de citas nuevas, cambios y recordatorios aunque tengas la app cerrada."
          estado={
            push.estado === "cargando" ? null : push.estado === "activo" ? (
              <Estado ok>Activas</Estado>
            ) : push.estado === "bloqueado" ? (
              <Estado mal>Bloqueadas en el navegador</Estado>
            ) : push.estado === "no-soportado" ? (
              <Estado>No disponibles aquí</Estado>
            ) : (
              <Estado>Apagadas</Estado>
            )
          }
          accion={
            push.estado === "activo" ? (
              <>
                <button type="button" className="btn-linea is-sm" onClick={() => void desactivarAvisos()} disabled={ocupado !== null}>
                  Desactivar
                </button>
                <button type="button" className="cuentas-enlace" onClick={() => window.dispatchEvent(new Event("avisos:abrir"))}>
                  Ver mis avisos
                </button>
              </>
            ) : push.estado === "apagado" ? (
              <button type="button" className="btn-gold is-sm" onClick={() => void activarAvisos()} disabled={ocupado !== null}>
                {ocupado === "avisos" ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
                Activar notificaciones
              </button>
            ) : push.estado === "bloqueado" ? (
              <small className="cuentas-nota">Permite las notificaciones de este sitio en los ajustes de tu navegador.</small>
            ) : push.estado === "no-soportado" ? (
              <small className="cuentas-nota">En iPhone, instala la app desde «Compartir → Agregar a inicio» para recibirlas.</small>
            ) : null
          }
        />
      </ul>
    </section>
  );
}

function Fila({ icono, titulo, detalle, estado, accion }: { icono: ReactNode; titulo: string; detalle: string; estado: ReactNode; accion: ReactNode }) {
  return (
    <li className="cuentas-fila">
      <span className="cuentas-icono" aria-hidden>
        {icono}
      </span>
      <div className="cuentas-texto">
        <p className="cuentas-titulo">{titulo}</p>
        <p className="cuentas-detalle">{detalle}</p>
        <div className="cuentas-estado">{estado ?? <Loader2 className="h-4 w-4 animate-spin" aria-label="Revisando" />}</div>
      </div>
      <div className="cuentas-accion">{accion}</div>
    </li>
  );
}

function Estado({ ok, mal, children }: { ok?: boolean; mal?: boolean; children: ReactNode }) {
  return (
    <span className={`cuentas-chip ${ok ? "is-ok" : mal ? "is-mal" : ""}`}>
      {ok ? <CheckCircle2 aria-hidden /> : <UserRound aria-hidden />}
      {children}
    </span>
  );
}
