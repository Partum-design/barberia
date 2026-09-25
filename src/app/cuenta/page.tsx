"use client";

import Link from "next/link";
import { useMemo } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Banknote, CalendarPlus, CreditCard, Gift, Home, MapPin, Sparkles } from "lucide-react";
import { PanelShell, KpiPastel } from "@/components/shell/PanelShell";
import { PanelHero } from "@/components/panel/PanelHero";
import { CalendarOverview } from "@/components/calendar/CalendarOverview";
import { calcularLealtad, useBarberia } from "@/lib/store";

const mxn = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

// Nodo Cliente: su cuenta con citas, historial y programa de recompensas.
export default function CuentaPage() {
  const store = useBarberia();
  const { listo, citas, sesion, recompensasConfig, tarjetas } = store;
  const clienteId = sesion?.id ?? "";
  const tarjeta = tarjetas.find((t) => t.cliente_id === clienteId);

  const mias = useMemo(
    () => citas.filter((c) => c.cliente_id === clienteId),
    [citas, clienteId]
  );
  const ahora = Date.now();
  const proximas = mias
    .filter((c) => c.estado === "confirmada" && new Date(c.fin).getTime() >= ahora)
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
  const historial = mias
    .filter((c) => c.estado !== "confirmada" || new Date(c.fin).getTime() < ahora)
    .sort((a, b) => b.inicio.localeCompare(a.inicio));
  const lealtad = calcularLealtad(
    citas,
    clienteId,
    recompensasConfig.citas_requeridas,
    tarjeta?.sellos_extra ?? 0
  );

  if (!listo) return null;

  if (!sesion || sesion.rol !== "cliente") {
    return <SinSesion />;
  }

  return (
    <PanelShell sesion={sesion} activo="Mi cuenta" onLogout={store.logout}>
      <PanelHero
        kicker="Mi cuenta"
        title={`Hola, ${sesion.nombre.split(" ")[0]}`}
        lead={<span className="capitalize">{format(new Date(), "EEEE d 'de' MMMM, yyyy", { locale: es })}</span>}
        actions={
          <Link
            href="/reservar"
            className="card-hover flex items-center gap-2 rounded-full bg-gradient-to-r from-accent-400 to-accent-500 px-5 py-2.5 text-sm font-semibold text-brand-900 shadow-md"
          >
            <CalendarPlus className="h-4 w-4" /> Agendar nueva cita
          </Link>
        }
      />

      {/* KPIs pastel */}
      <section className="mb-6 grid gap-4 sm:grid-cols-3">
        <KpiPastel
          tono="azul"
          delay="anim-d1"
          icon={<CalendarPlus className="h-4 w-4" />}
          label="Próximas citas"
          value={String(proximas.length)}
          nota="Confirmadas y pagadas"
        />
        <KpiPastel
          tono="lila"
          delay="anim-d2"
          icon={<Sparkles className="h-4 w-4" />}
          label="Citas asistidas"
          value={String(lealtad.puntos)}
          nota="Acumuladas en tu historial"
        />
        <KpiPastel
          tono="menta"
          delay="anim-d3"
          icon={<Gift className="h-4 w-4" />}
          label="Recompensas ganadas"
          value={String(lealtad.recompensasGanadas)}
          nota={`Te faltan ${lealtad.faltan} citas para la siguiente`}
        />
      </section>

      <div className="mb-6">
        <CalendarOverview citas={mias} perspective="cliente" title="Mis citas" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Próximas citas */}
        <section className="anim-in anim-d2 space-y-3 lg:col-span-2">
          <h2 className="font-semibold">Próximas citas</h2>
          {proximas.length === 0 && (
            <div
              className="rounded-2xl border border-dashed border-brand-500/30 p-8 text-center text-sm"
              style={{ background: "var(--card)", color: "var(--ink-muted)" }}
            >
              No tienes citas próximas.{" "}
              <Link href="/reservar" className="font-medium text-brand-600">
                Agenda una aquí
              </Link>
              .
            </div>
          )}
          {proximas.map((c) => (
            <article
              key={c.id}
              className="card-hover flex items-center gap-4 rounded-2xl p-4 shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10"
              style={{ background: "var(--card)" }}
            >
              <div className="flex w-16 shrink-0 flex-col items-center rounded-xl bg-gradient-to-b from-brand-600 to-accent-600 py-2 text-white">
                <span className="text-[10px] font-medium capitalize opacity-90">
                  {format(new Date(c.inicio), "d MMM", { locale: es })}
                </span>
                <span className="text-sm font-semibold">{format(new Date(c.inicio), "HH:mm")}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{c.barbero_nombre}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-sm" style={{ color: "var(--ink-muted)" }}>
                  {c.modalidad === "domicilio" ? (
                    <><Home className="h-3.5 w-3.5 text-accent-500" /> A domicilio</>
                  ) : (
                    <><MapPin className="h-3.5 w-3.5 text-brand-500" /> En barbería</>
                  )}
                  <span aria-hidden>·</span> {mxn.format(c.precio)}
                </p>
                <span className={`badge mt-1.5 ${c.estado_pago === "pagado" ? "badge-gold" : "badge-warm"}`}>
                  {c.estado_pago === "pagado" ? (
                    <><CreditCard className="h-3 w-3" /> Pagado</>
                  ) : (
                    <><Banknote className="h-3 w-3" /> Paga en efectivo al llegar</>
                  )}
                </span>
              </div>
              {c.modalidad === "domicilio" && c.direccion_domicilio && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.direccion_domicilio)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600"
                >
                  Ver dirección
                </a>
              )}
              <button
                onClick={() => store.cancelarCita(c.id)}
                className="btn-danger-ghost rounded-full px-3 py-2 text-sm font-medium"
              >
                Cancelar
              </button>
            </article>
          ))}

          <h2 className="pt-4 font-semibold">Historial</h2>
          {historial.map((c) => (
            <article
              key={c.id}
              className="flex items-center gap-4 rounded-2xl p-4 opacity-80 shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10"
              style={{ background: "var(--card)" }}
            >
              <div className="w-16 shrink-0 text-center">
                <p className="text-xs font-medium capitalize" style={{ color: "var(--ink-muted)" }}>
                  {format(new Date(c.inicio), "d MMM yy", { locale: es })}
                </p>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{c.barbero_nombre}</p>
                <p className="text-xs" style={{ color: "var(--ink-muted)" }}>{c.especialidad}</p>
              </div>
              <span
                className={`badge ${
                  c.estado === "asistida"
                    ? "badge-gold"
                    : c.estado === "cancelada"
                      ? "badge-danger"
                      : "badge-neutral"
                }`}
              >
                {c.estado}
              </span>
            </article>
          ))}
        </section>

        {/* Programa de lealtad */}
        <section className="anim-in anim-d3">
          <div className="card-hover rounded-3xl bg-gradient-to-br from-brand-700 via-brand-600 to-accent-500 p-6 text-white shadow-md">
            <div className="mb-4 flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
                <Gift className="h-5 w-5" />
              </span>
              <h2 className="font-semibold">Tu recompensa</h2>
            </div>
            <p className="text-sm text-white/85">
              Cada <strong>{lealtad.requerido} citas asistidas</strong> desbloqueas un{" "}
              <strong>{recompensasConfig.valor_descuento}% de descuento</strong> en tu siguiente
              visita.
            </p>
            {/* Progreso */}
            <div className="mt-5 flex items-center gap-1.5">
              {Array.from({ length: lealtad.requerido }).map((_, i) => (
                <span
                  key={i}
                  className={`h-2.5 flex-1 rounded-full transition-colors ${
                    i < lealtad.progreso ? "bg-white" : "bg-white/25"
                  }`}
                />
              ))}
            </div>
            <p className="mt-2 text-xs text-white/80">
              {lealtad.progreso} de {lealtad.requerido} citas · te faltan {lealtad.faltan}
            </p>
            {lealtad.recompensasGanadas > 0 && (
              <p className="anim-pop mt-4 flex items-center gap-2 rounded-xl bg-white/15 px-4 py-3 text-sm font-medium">
                <Sparkles className="h-4 w-4 shrink-0 text-mint-raw" />
                Tienes {lealtad.recompensasGanadas}{" "}
                {lealtad.recompensasGanadas === 1 ? "descuento disponible" : "descuentos disponibles"}{" "}
                — se aplicará en tu próxima reserva.
              </p>
            )}
            <Link
              href="/cuenta/recompensas"
              className="mt-4 inline-block text-sm font-medium text-white/90 underline-offset-4 hover:underline"
            >
              Ver mi historial de recompensas →
            </Link>
          </div>
        </section>
      </div>
    </PanelShell>
  );
}

function SinSesion() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="anim-in text-lg font-semibold">Inicia sesión para ver tu cuenta</p>
      <Link
        href="/login"
        className="anim-in anim-d1 rounded-full bg-gradient-to-r from-brand-600 to-accent-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md"
      >
        Iniciar sesión
      </Link>
    </main>
  );
}
