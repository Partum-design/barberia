"use client";

import Link from "next/link";
import { CalendarClock, Check, Clock3, Scissors } from "lucide-react";
import { PanelShell } from "@/components/shell/PanelShell";
import { DIAS_SEMANA, useBarberia } from "@/lib/store";

// Nodo Barbero: disponibilidad semanal. Los bloques activos son los que
// alimentan los horarios que ve el cliente al agendar en FlujoReserva.
export default function HorariosPage() {
  const store = useBarberia();
  const { listo, sesion } = store;

  if (!listo) return null;

  if (!sesion || sesion.rol !== "barbero") {
    return <SinSesion />;
  }

  const horario = store.horarioDeBarbero(sesion.id);
  const activos = DIAS_SEMANA.filter((dia) => horario[dia.id].activo);
  const horasSemanales = activos.reduce((total, dia) => {
    const [ih, im] = horario[dia.id].inicio.split(":").map(Number);
    const [fh, fm] = horario[dia.id].fin.split(":").map(Number);
    return total + Math.max(0, fh + fm / 60 - ih - im / 60);
  }, 0);

  return (
    <PanelShell sesion={sesion} activo="Horarios" onLogout={store.logout}>
      <header className="anim-in mb-6">
        <p className="kicker">Disponibilidad</p>
        <h1 className="font-display text-2xl font-bold tracking-tight">Horarios</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
          Define tu disponibilidad semanal. Los clientes solo verán horarios dentro de estos
          bloques.
        </p>
      </header>

      <section className="schedule-layout anim-in anim-d1">
        <aside className="schedule-summary">
          <span className="schedule-summary-icon"><CalendarClock /></span>
          <p className="schedule-summary-label">Semana activa</p>
          <strong>{activos.length}<small>/ 7 días</small></strong>
          <div className="schedule-summary-line"><span style={{ width: `${(activos.length / 7) * 100}%` }} /></div>
          <div className="schedule-summary-stat"><Clock3 /><span><b>{horasSemanales.toFixed(horasSemanales % 1 ? 1 : 0)} h</b> disponibles por semana</span></div>
          <p>Los cambios se aplican al instante en los horarios visibles para tus clientes.</p>
        </aside>

        <div className="schedule-days">
          <div className="schedule-days-heading">
            <div><p>Disponibilidad regular</p><span>Activa cada día y define la ventana de servicio.</span></div>
            <span className="schedule-saved"><Check /> Guardado</span>
          </div>
          {DIAS_SEMANA.map((dia, i) => {
            const bloque = horario[dia.id];
            return (
              <div
                key={dia.id}
                className={`schedule-day anim-in anim-d${Math.min(i + 1, 6)} ${bloque.activo ? "is-active" : ""}`}
              >
                <div className="schedule-day-name">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={bloque.activo}
                    aria-label={`${bloque.activo ? "Desactivar" : "Activar"} ${dia.label}`}
                    onClick={() => store.guardarHorarioDia(sesion.id, dia.id, { activo: !bloque.activo })}
                    className="schedule-switch"
                  >
                    <span />
                  </button>
                  <span>{dia.label}</span>
                </div>

                {bloque.activo ? (
                  <div className="schedule-time-range">
                    <label><span>Desde</span>
                    <input
                      type="time"
                      value={bloque.inicio}
                      onChange={(e) => store.guardarHorarioDia(sesion.id, dia.id, { inicio: e.target.value })}
                    />
                    </label>
                    <span className="schedule-range-line" />
                    <label><span>Hasta</span>
                    <input
                      type="time"
                      value={bloque.fin}
                      onChange={(e) => store.guardarHorarioDia(sesion.id, dia.id, { fin: e.target.value })}
                    />
                    </label>
                  </div>
                ) : (
                  <span className="schedule-unavailable">Sin citas</span>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </PanelShell>
  );
}

function SinSesion() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <Scissors className="h-8 w-8 text-accent-500" />
      <p className="anim-in text-lg font-semibold">Inicia sesión como barbero para ver este panel</p>
      <Link
        href="/login"
        className="anim-in anim-d1 rounded-full bg-gradient-to-r from-brand-600 to-accent-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md"
      >
        Iniciar sesión
      </Link>
    </main>
  );
}
