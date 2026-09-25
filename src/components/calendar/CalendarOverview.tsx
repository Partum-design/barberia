"use client";

import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Clock3, Home, MapPin } from "lucide-react";
import type { CitaDemo } from "@/lib/demo-store";

type CalendarOverviewProps = {
  citas: CitaDemo[];
  perspective: "cliente" | "barbero" | "admin";
  title?: string;
};

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];

export function CalendarOverview({ citas, perspective, title = "Calendario" }: CalendarOverviewProps) {
  const [month, setMonth] = useState(startOfMonth(new Date()));
  const [selected, setSelected] = useState(new Date());

  const visibleDays = useMemo(
    () => eachDayOfInterval({
      start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
      end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
    }),
    [month]
  );

  const active = citas.filter((cita) => cita.estado !== "cancelada");
  const selectedAppointments = active
    .filter((cita) => isSameDay(new Date(cita.inicio), selected))
    .sort((a, b) => a.inicio.localeCompare(b.inicio));

  function moveMonth(offset: number) {
    const next = addMonths(month, offset);
    setMonth(next);
    setSelected(startOfMonth(next));
  }

  return (
    <section className="calendar-overview anim-in anim-d3" aria-label={title}>
      <div className="calendar-main">
        <header className="calendar-header">
          <div>
            <p className="calendar-kicker">Vista mensual</p>
            <h2>{title}</h2>
          </div>
          <div className="calendar-nav">
            <button type="button" onClick={() => moveMonth(-1)} aria-label="Mes anterior"><ChevronLeft /></button>
            <span>{format(month, "MMMM yyyy", { locale: es })}</span>
            <button type="button" onClick={() => moveMonth(1)} aria-label="Mes siguiente"><ChevronRight /></button>
          </div>
        </header>

        <div className="calendar-weekdays" aria-hidden="true">
          {WEEKDAYS.map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}
        </div>
        <div className="calendar-grid">
          {visibleDays.map((day) => {
            const appointments = active.filter((cita) => isSameDay(new Date(cita.inicio), day));
            const selectedDay = isSameDay(day, selected);
            const today = isSameDay(day, new Date());
            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => setSelected(day)}
                className={`${!isSameMonth(day, month) ? "is-outside" : ""} ${selectedDay ? "is-selected" : ""} ${today ? "is-today" : ""}`}
                aria-label={`${format(day, "d 'de' MMMM", { locale: es })}, ${appointments.length} citas`}
              >
                <span className="calendar-day-number">{format(day, "d")}</span>
                {appointments.length > 0 && (
                  <span className="calendar-day-load">
                    <i /> {appointments.length > 1 ? appointments.length : ""}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <aside className="calendar-detail">
        <p className="calendar-detail-date">{format(selected, "EEEE d 'de' MMMM", { locale: es })}</p>
        <p className="calendar-detail-count">{selectedAppointments.length} {selectedAppointments.length === 1 ? "cita" : "citas"}</p>
        <div className="calendar-detail-list">
          {selectedAppointments.length === 0 ? (
            <div className="calendar-empty"><span />Día disponible, sin citas agendadas.</div>
          ) : selectedAppointments.map((cita) => (
            <article key={cita.id} className="calendar-appointment">
              <div className="calendar-appointment-time"><Clock3 />{format(new Date(cita.inicio), "HH:mm")}</div>
              <strong>{perspective === "cliente" ? cita.barbero_nombre : cita.cliente_nombre}</strong>
              <small>{perspective === "admin" ? `${cita.barbero_nombre} · ` : ""}{cita.especialidad}</small>
              <span>{cita.modalidad === "domicilio" ? <Home /> : <MapPin />}{cita.modalidad === "domicilio" ? "Domicilio" : "En barbería"}</span>
            </article>
          ))}
        </div>
      </aside>
    </section>
  );
}
