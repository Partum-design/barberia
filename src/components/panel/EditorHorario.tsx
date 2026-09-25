"use client";

import { CalendarClock, Check, Clock3 } from "lucide-react";
import { DIAS_SEMANA, type BloqueHorario, type DiaSemana, type HorarioSemanal } from "@/lib/store";

/**
 * Disponibilidad semanal de un barbero. La usan el propio barbero (Horarios)
 * y la administración (Disponibilidad); cada cambio se guarda al instante.
 */
export function EditorHorario({
  horario,
  onCambio,
  nota = "Los cambios se aplican al instante en los horarios visibles para los clientes.",
}: {
  horario: HorarioSemanal;
  onCambio: (dia: DiaSemana, cambios: Partial<BloqueHorario>) => void;
  nota?: string;
}) {
  const activos = DIAS_SEMANA.filter((dia) => horario[dia.id].activo);
  const horasSemanales = activos.reduce((total, dia) => {
    const [ih, im] = horario[dia.id].inicio.split(":").map(Number);
    const [fh, fm] = horario[dia.id].fin.split(":").map(Number);
    return total + Math.max(0, fh + fm / 60 - ih - im / 60);
  }, 0);

  return (
    <section className="schedule-layout anim-in anim-d1">
      <aside className="schedule-summary">
        <span className="schedule-summary-icon"><CalendarClock /></span>
        <p className="schedule-summary-label">Semana activa</p>
        <strong>{activos.length}<small>/ 7 días</small></strong>
        <div className="schedule-summary-line"><span style={{ width: `${(activos.length / 7) * 100}%` }} /></div>
        <div className="schedule-summary-stat"><Clock3 /><span><b>{horasSemanales.toFixed(horasSemanales % 1 ? 1 : 0)} h</b> disponibles por semana</span></div>
        <p>{nota}</p>
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
                  onClick={() => onCambio(dia.id, { activo: !bloque.activo })}
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
                    onChange={(e) => e.target.value && onCambio(dia.id, { inicio: e.target.value })}
                  />
                  </label>
                  <span className="schedule-range-line" />
                  <label><span>Hasta</span>
                  <input
                    type="time"
                    value={bloque.fin}
                    onChange={(e) => e.target.value && onCambio(dia.id, { fin: e.target.value })}
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
  );
}
