"use client";

import { useState } from "react";
import {
  ArrowRight,
  CalendarCheck,
  Check,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  MessageCircle,
  MoveRight,
  Plus,
  Scissors,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { Reveal } from "@/components/marketing/Reveal";

type ViewMode = "antes" | "despues";

const MODULOS = [
  { icon: CalendarCheck, label: "Agenda", copy: "Disponibilidad y citas confirmadas" },
  { icon: CircleDollarSign, label: "Cobros", copy: "Tarjeta, efectivo y estados claros" },
  { icon: Users, label: "Clientes", copy: "Historial y recurrencia en contexto" },
];

export function BarberOSExperience() {
  const [mode, setMode] = useState<ViewMode>("antes");
  const [simulated, setSimulated] = useState(false);

  function changeMode(next: ViewMode) {
    setMode(next);
    if (next === "antes") setSimulated(false);
  }

  const isAfter = mode === "despues";

  return (
    <section id="experiencia" className="experience-section relative overflow-hidden">
      <div className="mx-auto max-w-6xl px-6 py-24 lg:py-32">
        <Reveal className="mb-12 max-w-3xl">
          <p className="eyebrow eyebrow-dark"><Scissors className="h-3.5 w-3.5" /> Operación visible</p>
          <h2 className="font-display mt-5 max-w-2xl text-3xl font-semibold leading-tight tracking-tight text-white sm:text-5xl">
            El cambio se entiende cuando lo puedes tocar.
          </h2>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-white/65 sm:text-lg">
            Compara la operación fragmentada con el flujo que queda después de centralizarla en HAIRCUT.
            Cambia de vista y prueba una cita confirmada.
          </p>
        </Reveal>

        <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
          <Reveal className="lg:sticky lg:top-8">
            <div className="mode-card">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-mint-raw">Vista de operación</p>
              <div className="comparison-control mt-5">
                <div className="comparison-labels"><button type="button" onClick={() => changeMode("antes")} className={!isAfter ? "is-active" : ""}>Antes</button><button type="button" onClick={() => changeMode("despues")} className={isAfter ? "is-active" : ""}>Con HAIRCUT</button></div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={isAfter ? 100 : 0}
                  onChange={(event) => changeMode(Number(event.target.value) >= 50 ? "despues" : "antes")}
                  aria-label="Desliza para comparar antes y después"
                />
                <div className="comparison-track-labels"><span>Operación fragmentada</span><span>Sistema centralizado</span></div>
              </div>

              <div className="mt-8 min-h-[150px]">
                <p className={`text-xs font-semibold uppercase tracking-[0.16em] ${isAfter ? "text-mint-raw" : "text-white/45"}`}>
                  {isAfter ? "Después de centralizar" : "Antes de centralizar"}
                </p>
                <h3 className="mt-3 font-display text-2xl font-semibold text-white">
                  {isAfter ? "Una barbería que responde a tiempo." : "La información llega tarde."}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-white/60">
                  {isAfter
                    ? "Cada equipo ve el mismo estado: la cita, el pago y el siguiente paso."
                    : "Agenda, chat y pagos viven separados. La recepción termina haciendo de puente."
                  }
                </p>
              </div>

              <button
                type="button"
                onClick={() => changeMode(isAfter ? "antes" : "despues")}
                className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-mint-raw transition-transform hover:translate-x-1"
              >
                {isAfter ? "Ver el punto de partida" : "Ver cómo se ordena"} <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </Reveal>

          <Reveal delay={100}>
            <div className={`operations-board ${isAfter ? "is-after" : "is-before"}`}>
              <div className="board-topbar">
                <div className="flex items-center gap-2">
                  <span className={`board-mark ${!isAfter ? "is-before" : ""}`}>{isAfter ? "B" : "!"}</span>
                  <span className="font-display text-sm font-semibold text-white">{isAfter ? "HAIRCUT" : "Operación fragmentada"}</span>
                  <span className="board-divider" />
                  <span className="hidden text-xs text-white/45 sm:inline">{isAfter ? "Centro de operación" : "Vista manual"}</span>
                </div>
                <span className={`board-status ${isAfter ? "is-live" : ""}`}>
                  <span className="status-dot" /> {isAfter ? "Sincronizado" : "Pendientes"}
                </span>
              </div>

              <div className="board-body">
                <div className="board-intro">
                  <div>
                    <p className="text-xs font-medium text-slate-500">Martes, 21 de julio</p>
                    <h3 className="mt-1 font-display text-xl font-semibold" style={{ color: "var(--ink)" }}>Buenos días, equipo.</h3>
                  </div>
                  <button type="button" className="board-add" aria-label="Agregar una cita">
                    <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Nueva cita</span>
                  </button>
                </div>

                <div className="board-kpis">
                  <Kpi label="Citas de hoy" value={isAfter ? "12" : "12"} change={isAfter ? "+3 confirmadas" : "4 por confirmar"} good={isAfter} icon={<CalendarCheck className="h-4 w-4" />} />
                  <Kpi label="Cobros" value={isAfter ? "$8,460" : "$5,280"} change={isAfter ? "100% conciliado" : "3 métodos distintos"} good={isAfter} icon={<CircleDollarSign className="h-4 w-4" />} />
                  <Kpi label="Seguimiento" value={isAfter ? "86%" : "—"} change={isAfter ? "clientes que regresan" : "sin medir"} good={isAfter} icon={<ClipboardCheck className="h-4 w-4" />} />
                </div>

                <div className="board-grid">
                  <div className="board-module board-calendar">
                    <div className="module-heading">
                      <span><CalendarCheck className="h-4 w-4 text-brand-600" /> Agenda del día</span>
                      <span className="module-muted">09:00 — 18:00</span>
                    </div>
                    <Appointment name="Mariana Gutiérrez" time="09:30" type="Fade + barba" state={isAfter ? "Confirmada" : "WhatsApp"} done={isAfter} />
                    <Appointment name="Sofía Ramírez" time="11:00" type="Corte clásico" state={isAfter ? "Pagada" : "Sin respuesta"} done={isAfter} />
                    <Appointment name="Diego Torres" time="13:30" type="Corte a domicilio" state={isAfter ? "Confirmada" : "Por revisar"} done={isAfter} />
                  </div>

                  <div className="board-side-stack">
                    <div className="board-module">
                      <div className="module-heading">
                        <span><MessageCircle className="h-4 w-4 text-accent-600" /> Siguiente acción</span>
                        <span className="module-icon-note">{isAfter ? <Check className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}</span>
                      </div>
                      {isAfter ? (
                        <div className="action-success"><Check className="h-4 w-4" /><span>Recordatorios enviados automáticamente</span></div>
                      ) : (
                        <div className="action-warning"><X className="h-4 w-4" /><span>4 clientes esperan confirmación manual</span></div>
                      )}
                    </div>
                    <div className="board-module loyalty-module">
                      <div className="module-heading"><span><Sparkles className="h-4 w-4 text-accent-600" /> Lealtad</span><span className="module-muted">{isAfter ? "Activo" : "Sin datos"}</span></div>
                      <div className="loyalty-line"><span style={{ width: isAfter ? "78%" : "18%" }} /></div>
                      <p className="mt-2 text-xs text-slate-500">{isAfter ? "Mariana está a 1 cita de desbloquear su recompensa" : "La recurrencia se pierde entre hojas de cálculo"}</p>
                    </div>
                  </div>
                </div>

                {isAfter && (
                  <button
                    type="button"
                    className="board-demo-button"
                    onClick={() => setSimulated(true)}
                    disabled={simulated}
                  >
                    {simulated ? <><Check className="h-4 w-4" /> Cita agregada a la agenda</> : <><MoveRight className="h-4 w-4" /> Simular cita confirmada</>}
                  </button>
                )}
              </div>
            </div>
          </Reveal>
        </div>

        <div className="mt-16 grid gap-3 sm:grid-cols-3">
          {MODULOS.map(({ icon: Icon, label, copy }, i) => (
            <Reveal key={label} delay={i * 80}>
              <div className="module-pill">
                <span className="module-pill-icon"><Icon className="h-4 w-4" /></span>
                <span><strong>{label}</strong><small>{copy}</small></span>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Kpi({ label, value, change, good, icon }: { label: string; value: string; change: string; good: boolean; icon: React.ReactNode }) {
  return (
    <div className="board-kpi">
      <span className={`kpi-icon ${good ? "is-good" : ""}`}>{icon}</span>
      <p className="mt-3 text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-num text-xl font-semibold tracking-tight" style={{ color: "var(--ink)" }}>{value}</p>
      <p className={`mt-1 text-[11px] ${good ? "text-accent-600" : "text-slate-400"}`}>{change}</p>
    </div>
  );
}

function Appointment({ name, time, type, state, done }: { name: string; time: string; type: string; state: string; done: boolean }) {
  return (
    <div className="appointment-row">
      <div className="appointment-time"><span>{time}</span><span className="appointment-line" /></div>
      <div className="appointment-avatar">{name.charAt(0)}</div>
      <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold" style={{ color: "var(--ink)" }}>{name}</p><p className="truncate text-[11px] text-slate-500">{type}</p></div>
      <span className={`appointment-state ${done ? "is-done" : ""}`}>{done && <Check className="h-3 w-3" />}{state}</span>
    </div>
  );
}
