"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { addDays, format, setHours, setMinutes } from "date-fns";
import { es } from "date-fns/locale";
import {
  Banknote,
  CheckCircle2,
  Clock,
  CreditCard,
  Gift,
  Home,
  MapPin,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { calcularLealtad, useDemoStore, type MetodoPago } from "@/lib/demo-store";
import { MercadoPagoMark, StripeMark } from "@/components/payments/BrandMarks";

type Barbero = {
  id: string;
  nombre: string;
  especialidad: string;
  precio_servicio: number;
  duracion_cita_min: number;
  acepta_domicilio: boolean;
  biografia: string;
};

type Paso = "barbero" | "horario" | "otp" | "pago" | "confirmada";

const mxn = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

export function FlujoReserva({ barberos, demo }: { barberos: Barbero[]; demo: boolean }) {
  const store = useDemoStore();
  const [paso, setPaso] = useState<Paso>("barbero");
  const [barbero, setBarbero] = useState<Barbero | null>(null);
  const [slot, setSlot] = useState<Date | null>(null);
  const [modalidad, setModalidad] = useState<"presencial" | "domicilio">("presencial");
  const [metodoPago, setMetodoPago] = useState<MetodoPago>("tarjeta");
  const [procesador, setProcesador] = useState<"stripe" | "mercado-pago">("stripe");
  const [telefono, setTelefono] = useState("");
  const [codigo, setCodigo] = useState("");
  const [otpEnviado, setOtpEnviado] = useState(false);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [expiraEn, setExpiraEn] = useState<Date | null>(null);
  const [restante, setRestante] = useState("10:00");

  // Cuenta regresiva del bloqueo del slot (10 minutos)
  useEffect(() => {
    if (!expiraEn) return;
    const t = setInterval(() => {
      const ms = expiraEn.getTime() - Date.now();
      if (ms <= 0) {
        setRestante("00:00");
        clearInterval(t);
        return;
      }
      const m = Math.floor(ms / 60_000);
      const s = Math.floor((ms % 60_000) / 1000);
      setRestante(`${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    }, 1000);
    return () => clearInterval(t);
  }, [expiraEn]);

  // Slots de ejemplo: próximos 3 días hábiles, 9:00–13:00
  const slots = useMemo(() => {
    if (!barbero) return [];
    const out: Date[] = [];
    for (let d = 1; d <= 3; d++) {
      const dia = addDays(new Date(), d);
      if ([0, 6].includes(dia.getDay())) continue;
      for (let h = 9; h < 13; h++) {
        out.push(setMinutes(setHours(dia, h), 0));
        if (barbero.duracion_cita_min <= 30) out.push(setMinutes(setHours(dia, h), 30));
      }
    }
    return out;
  }, [barbero]);

  async function enviarOtp() {
    setError("");
    setCargando(true);
    const res = await fetch("/api/otp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telefono, canal: "whatsapp" }),
    });
    const data = await res.json();
    setCargando(false);
    if (!res.ok) return setError(data.error ?? "Error al enviar el código");
    setOtpEnviado(true);
  }

  async function verificarOtpYReservar() {
    if (!barbero || !slot) return;
    setError("");
    setCargando(true);

    const verif = await fetch("/api/otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telefono, codigo }),
    });
    const vdata = await verif.json();
    if (!verif.ok) {
      setCargando(false);
      return setError(vdata.error ?? "Código incorrecto");
    }

    const fin = new Date(slot.getTime() + barbero.duracion_cita_min * 60_000);
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        barbero_id: barbero.id,
        inicio: slot.toISOString(),
        fin: fin.toISOString(),
        modalidad,
      }),
    });
    const data = await res.json();
    setCargando(false);
    if (!res.ok) return setError(data.error ?? "No fue posible reservar");

    setExpiraEn(new Date(data.bloqueo_expira_en));
    setPaso("pago");
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
      {paso === "barbero" && (
        <div className="space-y-3">
          {barberos.map((m) => (
            <button
              key={m.id}
              onClick={() => { setBarbero(m); setPaso("horario"); }}
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
              </div>
              <span className="font-semibold text-brand-600">{mxn.format(m.precio_servicio)}</span>
            </button>
          ))}
        </div>
      )}

      {/* Paso 2: elegir horario */}
      {paso === "horario" && barbero && (
        <div className="rounded-2xl p-5 shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10" style={{ background: "var(--card)" }}>
          <p className="mb-4 text-sm">
            Disponibilidad de <span className="font-medium">{barbero.nombre}</span>
          </p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {slots.map((s) => (
              <button
                key={s.toISOString()}
                onClick={() => { setSlot(s); setPaso("otp"); }}
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

      {/* Paso 3: verificación OTP */}
      {paso === "otp" && (
        <div className="rounded-2xl p-6 shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10" style={{ background: "var(--card)" }}>
          <div className="mb-4 flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-accent-500" />
            <h2 className="font-semibold">Verifica tu teléfono</h2>
          </div>
          <p className="mb-4 text-sm" style={{ color: "var(--ink-muted)" }}>
            Para proteger la agenda contra bots, confirma tu número por WhatsApp o SMS.
            {demo && " (Demo: cualquier número válido; código 000000)"}
          </p>
          <div className="space-y-3">
            <input
              type="tel"
              placeholder="+52 1 55 1234 5678"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value.replace(/[^+\d]/g, ""))}
              className="w-full rounded-xl border border-slate-300/70 bg-transparent px-4 py-2.5 text-sm outline-none focus:border-accent-500 dark:border-white/15"
            />
            {otpEnviado && (
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="Código de 6 dígitos"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
                className="w-full rounded-xl border border-slate-300/70 bg-transparent px-4 py-2.5 text-sm tracking-[0.4em] outline-none focus:border-accent-500 dark:border-white/15"
              />
            )}
            <button
              disabled={cargando || (otpEnviado ? codigo.length !== 6 : telefono.length < 11)}
              onClick={otpEnviado ? verificarOtpYReservar : enviarOtp}
              className="w-full rounded-xl bg-gradient-to-r from-brand-600 to-accent-500 py-2.5 font-medium text-white transition-opacity disabled:opacity-40"
            >
              {cargando ? "Procesando…" : otpEnviado ? "Verificar y apartar horario" : "Enviar código"}
            </button>
          </div>
        </div>
      )}

      {/* Paso 4: pago con slot bloqueado */}
      {paso === "pago" && barbero && slot && (
        <div className="rounded-2xl p-6 shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10" style={{ background: "var(--card)" }}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Confirma tu pago</h2>
            <span className="font-num flex items-center gap-1.5 rounded-full bg-ink-900 px-3 py-1 text-sm font-medium text-mint-raw">
              <Clock className="h-4 w-4" /> {restante}
            </span>
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
          <dl className="mb-5 space-y-2 text-sm">
            <Fila k="Barbero" v={barbero.nombre} />
            <Fila k="Fecha" v={format(slot, "EEEE d 'de' MMMM, HH:mm 'h'", { locale: es })} />
            <Fila k="Modalidad" v={modalidad === "presencial" ? "En barbería" : "A domicilio"} />
            <Fila k="Total" v={mxn.format(barbero.precio_servicio)} destacado />
          </dl>

          <p className="mb-2 text-xs font-medium" style={{ color: "var(--ink-muted)" }}>
            Método de pago
          </p>
          <div className="mb-4 grid grid-cols-2 gap-2">
            <button
              onClick={() => setMetodoPago("tarjeta")}
              className={`flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-sm font-medium transition-colors ${
                metodoPago === "tarjeta"
                  ? "border-accent-500 bg-accent-100/50 text-accent-600 dark:bg-accent-500/10"
                  : "border-slate-200 dark:border-white/10"
              }`}
            >
              <CreditCard className="h-4 w-4" />
              Tarjeta en línea
            </button>
            <button
              onClick={() => setMetodoPago("efectivo")}
              className={`flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-sm font-medium transition-colors ${
                metodoPago === "efectivo"
                  ? "border-accent-500 bg-accent-100/50 text-accent-600 dark:bg-accent-500/10"
                  : "border-slate-200 dark:border-white/10"
              }`}
            >
              <Banknote className="h-4 w-4" />
              Efectivo en barbería
            </button>
          </div>

          {metodoPago === "tarjeta" && (
            <div className="booking-provider-picker">
              <p>Procesador seguro</p>
              <div role="radiogroup" aria-label="Procesador de pago">
                <button type="button" role="radio" aria-checked={procesador === "stripe"} onClick={() => setProcesador("stripe")} className={procesador === "stripe" ? "is-active" : ""}><StripeMark /></button>
                <button type="button" role="radio" aria-checked={procesador === "mercado-pago"} onClick={() => setProcesador("mercado-pago")} className={procesador === "mercado-pago" ? "is-active" : ""}><MercadoPagoMark /></button>
              </div>
            </div>
          )}

          {metodoPago === "tarjeta" ? (
            <p className="mb-4 flex items-start gap-2 text-xs" style={{ color: "var(--ink-muted)" }}>
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent-500" />
              Tu horario está apartado por 10 minutos. Si el pago no se completa, se libera
              automáticamente para otros clientes.
            </p>
          ) : (
            <p className="mb-4 flex items-start gap-2 rounded-xl bg-brand-50 px-3 py-2.5 text-xs text-brand-700 dark:bg-brand-900/30 dark:text-brand-100">
              <Banknote className="mt-0.5 h-4 w-4 shrink-0" />
              Tu horario queda apartado ahora mismo. Paga el total en recepción al llegar a
              tu cita — si no te presentas, el horario se libera para otros clientes.
            </p>
          )}

          <button
            onClick={() => {
              // En la demo el pago crea la cita en el almacén local: aparece
              // al instante en la cuenta del cliente y en la agenda del barbero.
              const fin = new Date(slot.getTime() + barbero.duracion_cita_min * 60_000);
              store.crearCita({
                barbero_id: barbero.id,
                inicio: slot.toISOString(),
                fin: fin.toISOString(),
                modalidad,
                metodo_pago: metodoPago,
              });
              setPaso("confirmada");
            }}
            className="card-hover w-full rounded-xl bg-gradient-to-r from-brand-600 to-accent-500 py-2.5 font-medium text-white"
          >
            {metodoPago === "tarjeta"
              ? demo
                ? `Simular pago con ${procesador === "stripe" ? "Stripe" : "Mercado Pago"}`
                : `Pagar con ${procesador === "stripe" ? "Stripe" : "Mercado Pago"}`
              : "Confirmar cita — pago en efectivo"}
          </button>
        </div>
      )}

      {/* Paso 5: confirmación */}
      {paso === "confirmada" && barbero && slot && (() => {
        const lealtad = calcularLealtad(store.citas, "cli-1", store.recompensasConfig.citas_requeridas);
        return (
          <div className="anim-pop rounded-2xl p-8 text-center shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10" style={{ background: "var(--card)" }}>
            <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-accent-500" />
            <h2 className="text-lg font-semibold">¡Cita confirmada!</h2>
            <p className="mt-1 text-sm capitalize" style={{ color: "var(--ink-muted)" }}>
              {barbero.nombre} · {format(slot, "EEEE d 'de' MMMM, HH:mm 'h'", { locale: es })}
            </p>
            {metodoPago === "efectivo" && (
              <p className="mx-auto mt-4 flex w-fit items-center gap-2 rounded-xl bg-brand-50 px-4 py-2.5 text-xs font-medium text-brand-700 dark:bg-brand-900/40 dark:text-brand-100">
                <Banknote className="h-4 w-4 shrink-0" />
                Recuerda llevar {mxn.format(barbero.precio_servicio)} en efectivo el día de tu
                cita
              </p>
            )}
            <p className="badge mx-auto mt-4 badge-gold px-4 py-1.5 text-xs">
              <Gift className="h-3.5 w-3.5" />
              Lealtad: {lealtad.progreso} de {lealtad.requerido} citas asistidas — te faltan {lealtad.faltan} para tu recompensa
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                href={store.sesion?.rol === "cliente" ? "/cuenta" : "/login"}
                className="card-hover rounded-full bg-gradient-to-r from-brand-600 to-accent-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md"
              >
                Ver en mi cuenta
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
    { id: "otp", label: "Verificación" },
    { id: "pago", label: "Pago" },
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
