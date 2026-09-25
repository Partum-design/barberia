"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Banknote, CheckCircle2, Gift, Home, Loader2, MapPin, UserRound } from "lucide-react";
import { calcularLealtad, useBarberia, type Barbero } from "@/lib/store";
import { slotsDisponibles } from "@/lib/datos/disponibilidad";

type Paso = "barbero" | "horario" | "confirmar" | "confirmada";

const mxn = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

/**
 * Reserva en tres pasos: barbero, horario y confirmación. Sólo se ofrecen
 * barberos con horarios libres en la semana y sólo horas con personal (ver
 * lib/datos/disponibilidad). De momento el pago es en efectivo en la barbería.
 */
export function FlujoReserva() {
  const store = useBarberia();
  const { barberos, citas, barberiaConfig, horarioDeBarbero } = store;
  const [paso, setPaso] = useState<Paso>("barbero");
  const [barbero, setBarbero] = useState<Barbero | null>(null);
  const [slot, setSlot] = useState<Date | null>(null);
  const [modalidad, setModalidad] = useState<"presencial" | "domicilio">("presencial");
  const [direccion, setDireccion] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  // Horarios libres de los próximos 7 días por barbero activo.
  const disponibles = useMemo(
    () =>
      barberos
        .filter((b) => b.activo)
        .map((b) => ({
          barbero: b,
          slots: slotsDisponibles({ barbero: b, horario: horarioDeBarbero(b.id), barberia: barberiaConfig, citas }),
        }))
        .filter((x) => x.slots.length > 0),
    [barberos, citas, barberiaConfig, horarioDeBarbero]
  );
  const slots = disponibles.find((x) => x.barbero.id === barbero?.id)?.slots ?? [];

  const esCliente = store.sesion?.rol === "cliente";

  if (!esCliente) {
    return (
      <div className="booking-flow">
        <div className="rounded-2xl p-8 text-center shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10" style={{ background: "var(--card)" }}>
          <UserRound className="mx-auto mb-3 h-10 w-10 text-accent-500" />
          <h2 className="text-lg font-semibold">Inicia sesión para reservar</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm" style={{ color: "var(--ink-muted)" }}>
            Así tu cita queda a tu nombre y cada visita suma sellos en tu tarjeta de lealtad.
          </p>
          <Link
            href="/login?next=/reservar"
            className="card-hover mt-5 inline-flex rounded-full bg-gradient-to-r from-brand-600 to-accent-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md"
          >
            Entrar o crear cuenta
          </Link>
        </div>
      </div>
    );
  }

  async function confirmar() {
    if (!barbero || !slot) return;
    setError("");
    setCargando(true);
    const { error: err } = await store.crearCita({
      barbero_id: barbero.id,
      inicio: slot.toISOString(),
      modalidad,
      direccion_domicilio: direccion.trim(),
    });
    setCargando(false);
    if (err) {
      setError(err);
      // Si el horario se ocupó, se vuelve a elegir con la disponibilidad fresca.
      setSlot(null);
      setPaso("horario");
      return;
    }
    setPaso("confirmada");
  }

  return (
    <div className="booking-flow space-y-4">
      <Stepper actual={paso} />

      {error && (
        <p className="rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-700 ring-1 ring-brand-500/20">
          {error}
        </p>
      )}

      {/* Paso 1: elegir barbero */}
      {paso === "barbero" && disponibles.length === 0 && (
        <div className="rounded-2xl p-8 text-center text-sm shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10" style={{ background: "var(--card)", color: "var(--ink-muted)" }}>
          No hay barberos con horarios disponibles esta semana. Vuelve pronto o llámanos para apartar tu lugar.
        </div>
      )}

      {paso === "barbero" && (
        <div className="space-y-3">
          {disponibles.map(({ barbero: m, slots: libres }) => (
            <button
              key={m.id}
              onClick={() => { setBarbero(m); setModalidad("presencial"); setError(""); setPaso("horario"); }}
              className="flex w-full items-center gap-4 rounded-2xl p-4 text-left shadow-sm ring-1 ring-slate-900/5 transition-all hover:-translate-y-0.5 hover:shadow-md hover:ring-accent-500/50 dark:ring-white/10"
              style={{ background: "var(--card)" }}
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-accent-500 text-lg font-semibold text-white">
                {m.nombre.replace(/^Dra?\.\s*/, "").charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{m.nombre}</p>
                <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
                  {m.especialidad} · {m.duracion_cita_min} min
                  {m.acepta_domicilio && (
                    <span className="ml-2 inline-flex items-center gap-1 text-accent-600">
                      <Home className="h-3.5 w-3.5" /> Domicilio
                    </span>
                  )}
                </p>
                <p className="text-xs capitalize" style={{ color: "var(--ink-muted)" }}>
                  Próximo: {format(libres[0], "EEE d MMM, HH:mm", { locale: es })}
                </p>
              </div>
              <span className="font-semibold text-brand-600">{mxn.format(m.precio_servicio)}</span>
            </button>
          ))}
        </div>
      )}

      {/* Paso 2: elegir horario */}
      {paso === "horario" && barbero && (
        <div className="rounded-2xl p-5 shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10" style={{ background: "var(--card)" }}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-sm">
              Disponibilidad de <span className="font-medium">{barbero.nombre}</span>
            </p>
            <button onClick={() => { setPaso("barbero"); setError(""); }} className="text-xs font-medium" style={{ color: "var(--ink-muted)" }}>
              ← Cambiar barbero
            </button>
          </div>
          {slots.length === 0 && (
            <p className="rounded-xl border border-dashed border-brand-500/30 p-5 text-center text-sm" style={{ color: "var(--ink-muted)" }}>
              No hay horarios libres en los próximos 7 días.
            </p>
          )}
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {slots.map((s) => (
              <button
                key={s.toISOString()}
                onClick={() => { setSlot(s); setError(""); setPaso("confirmar"); }}
                className="rounded-xl border border-brand-500/25 px-2 py-2.5 text-center text-sm transition-colors hover:border-accent-500 hover:bg-accent-100/50 dark:hover:bg-accent-500/10"
              >
                <span className="block text-[11px] capitalize" style={{ color: "var(--ink-muted)" }}>
                  {format(s, "EEE d MMM", { locale: es })}
                </span>
                <span className="font-medium">{format(s, "HH:mm")}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Paso 3: confirmar (pago en efectivo) */}
      {paso === "confirmar" && barbero && slot && (
        <div className="rounded-2xl p-6 shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10" style={{ background: "var(--card)" }}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-semibold">Confirma tu cita</h2>
            <button onClick={() => setPaso("horario")} className="text-xs font-medium" style={{ color: "var(--ink-muted)" }}>
              ← Cambiar horario
            </button>
          </div>
          {barbero.acepta_domicilio && (
            <div className="mb-4 flex gap-2">
              {(["presencial", "domicilio"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setModalidad(m)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                    modalidad === m
                      ? "border-accent-500 bg-accent-100/50 text-accent-600 dark:bg-accent-500/10"
                      : "border-slate-200 dark:border-white/10"
                  }`}
                >
                  {m === "presencial" ? <MapPin className="h-4 w-4" /> : <Home className="h-4 w-4" />}
                  {m === "presencial" ? "En barbería" : "A domicilio"}
                </button>
              ))}
            </div>
          )}
          {modalidad === "domicilio" && (
            <input
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              placeholder="Dirección completa del domicilio"
              className="mb-4 w-full rounded-xl border border-slate-300/70 bg-transparent px-4 py-2.5 text-sm outline-none focus:border-accent-500 dark:border-white/15"
            />
          )}
          <dl className="mb-5 space-y-2 text-sm">
            <Fila k="Barbero" v={barbero.nombre} />
            <Fila k="Fecha" v={format(slot, "EEEE d 'de' MMMM, HH:mm 'h'", { locale: es })} />
            <Fila k="Modalidad" v={modalidad === "presencial" ? "En barbería" : "A domicilio"} />
            <Fila k="Pago" v="Efectivo en la barbería" />
            <Fila k="Total" v={mxn.format(barbero.precio_servicio)} destacado />
          </dl>

          <p className="mb-4 flex items-start gap-2 rounded-xl bg-brand-50 px-3 py-2.5 text-xs text-brand-700 dark:bg-brand-900/30 dark:text-brand-100">
            <Banknote className="mt-0.5 h-4 w-4 shrink-0" />
            Tu horario queda apartado al confirmar. Paga el total en efectivo al llegar a tu cita.
          </p>

          <button
            disabled={cargando || (modalidad === "domicilio" && direccion.trim().length < 8)}
            onClick={confirmar}
            className="card-hover flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-accent-500 py-2.5 font-medium text-white disabled:opacity-40"
          >
            {cargando && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirmar cita — pago en efectivo
          </button>
        </div>
      )}

      {/* Paso 4: confirmación */}
      {paso === "confirmada" && barbero && slot && (() => {
        const clienteId = store.sesion?.id ?? "";
        const tarjeta = store.tarjetas.find((t) => t.cliente_id === clienteId);
        const lealtad = calcularLealtad(
          store.citas,
          clienteId,
          store.recompensasConfig.citas_requeridas,
          tarjeta?.sellos_extra ?? 0
        );
        return (
          <div className="anim-pop rounded-2xl p-8 text-center shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10" style={{ background: "var(--card)" }}>
            <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-accent-500" />
            <h2 className="text-lg font-semibold">¡Cita confirmada!</h2>
            <p className="mt-1 text-sm capitalize" style={{ color: "var(--ink-muted)" }}>
              {barbero.nombre} · {format(slot, "EEEE d 'de' MMMM, HH:mm 'h'", { locale: es })}
            </p>
            <p className="mx-auto mt-4 flex w-fit items-center gap-2 rounded-xl bg-brand-50 px-4 py-2.5 text-xs font-medium text-brand-700 dark:bg-brand-900/40 dark:text-brand-100">
              <Banknote className="h-4 w-4 shrink-0" />
              Recuerda llevar {mxn.format(barbero.precio_servicio)} en efectivo el día de tu cita
            </p>
            <p className="badge mx-auto mt-4 badge-gold px-4 py-1.5 text-xs">
              <Gift className="h-3.5 w-3.5" />
              Tarjeta de lealtad: {lealtad.progreso} de {lealtad.requerido} sellos — te faltan {lealtad.faltan} para tu recompensa
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                href="/cuenta"
                className="card-hover rounded-full bg-gradient-to-r from-brand-600 to-accent-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md"
              >
                Ver en mi cuenta
              </Link>
              <Link
                href="/cuenta/tarjeta"
                className="rounded-full border border-accent-500/40 px-5 py-2.5 text-sm font-medium text-accent-600"
              >
                Mi tarjeta de lealtad
              </Link>
              <Link
                href="/"
                className="rounded-full px-5 py-2.5 text-sm font-medium transition-colors hover:bg-slate-100 dark:hover:bg-white/5"
                style={{ color: "var(--ink-muted)" }}
              >
                Volver al inicio
              </Link>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function Stepper({ actual }: { actual: Paso }) {
  const pasos: { id: Paso; label: string }[] = [
    { id: "barbero", label: "Barbero" },
    { id: "horario", label: "Horario" },
    { id: "confirmar", label: "Confirmar" },
  ];
  const idx = pasos.findIndex((p) => p.id === actual);
  const activo = actual === "confirmada" ? pasos.length : idx;
  return (
    <ol className="flex items-center gap-2">
      {pasos.map((p, i) => (
        <li key={p.id} className="flex flex-1 flex-col gap-1.5">
          <span
            className={`h-1.5 rounded-full transition-colors ${
              i <= activo ? "bg-gradient-to-r from-brand-500 to-accent-500" : "bg-slate-200 dark:bg-white/10"
            }`}
          />
          <span className="text-[11px] font-medium" style={{ color: i <= activo ? undefined : "var(--ink-muted)" }}>
            {p.label}
          </span>
        </li>
      ))}
    </ol>
  );
}

function Fila({ k, v, destacado }: { k: string; v: string; destacado?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt style={{ color: "var(--ink-muted)" }}>{k}</dt>
      <dd className={destacado ? "font-semibold text-brand-600" : "font-medium"}>{v}</dd>
    </div>
  );
}
