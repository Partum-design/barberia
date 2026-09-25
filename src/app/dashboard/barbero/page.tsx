"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { format, isToday } from "date-fns";
import { es } from "date-fns/locale";
import { Banknote, CalendarDays, CheckCircle2, CreditCard, Home, MapPin, Users } from "lucide-react";
import { PanelShell, KpiPastel } from "@/components/shell/PanelShell";
import { PanelHero } from "@/components/panel/PanelHero";
import { CalendarOverview } from "@/components/calendar/CalendarOverview";
import { useDemoStore } from "@/lib/demo-store";

const mxn = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

// Nodo Barbero: agenda con datos locales reales (marcar asistida funciona
// y alimenta el programa de lealtad del cliente).
export default function DashboardBarberoPage() {
  const store = useDemoStore();
  const { listo, citas, sesion } = store;
  const [vista, setVista] = useState<"hoy" | "semana">("hoy");

  const propias = useMemo(
    () =>
      citas
        .filter((c) => c.barbero_id === "bar-1" && c.estado !== "cancelada")
        .sort((a, b) => a.inicio.localeCompare(b.inicio)),
    [citas]
  );
  const futurasOHoy = propias.filter(
    (c) => isToday(new Date(c.inicio)) || new Date(c.inicio).getTime() > Date.now()
  );
  const visibles =
    vista === "hoy" ? propias.filter((c) => isToday(new Date(c.inicio))) : futurasOHoy;

  const deHoy = propias.filter((c) => isToday(new Date(c.inicio)));
  const pendientesEfectivo = deHoy.filter((c) => c.estado_pago === "pendiente");
  const stats = {
    hoy: deHoy.length,
    tele: deHoy.filter((c) => c.modalidad === "domicilio").length,
    ingresos: deHoy.reduce((s, c) => s + c.precio, 0),
    porCobrar: pendientesEfectivo.reduce((s, c) => s + c.precio, 0),
    asistidas: deHoy.filter((c) => c.estado === "asistida").length,
  };

  if (!listo) return null;

  if (!sesion || sesion.rol !== "barbero") {
    return <SinSesion rol="barbero" />;
  }

  return (
    <PanelShell sesion={sesion} activo="Mi agenda" onLogout={store.logout}>
      <PanelHero
        kicker="Espacio de trabajo"
        title="Mi agenda"
        lead={<span className="capitalize">{format(new Date(), "EEEE d 'de' MMMM, yyyy", { locale: es })}</span>}
        actions={
          <div className="flex rounded-full bg-white p-1 shadow-sm">
            {(["hoy", "semana"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setVista(v)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize transition-all ${
                  vista === v
                    ? "bg-gradient-to-r from-brand-600 to-accent-500 text-brand-900 shadow-sm"
                    : "text-white/55"
                }`}
              >
                {v === "hoy" ? "Hoy" : "Próximas"}
              </button>
            ))}
          </div>
        }
      />

      {/* KPIs pastel estilo referencia */}
      <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiPastel tono="lila" delay="anim-d1" icon={<Users className="h-4 w-4" />} label="Citas de hoy" value={String(stats.hoy)} nota="Agenda del día" />
        <KpiPastel tono="azul" delay="anim-d2" icon={<Home className="h-4 w-4" />} label="Domicilio" value={String(stats.tele)} nota="Con dirección confirmada" />
        <KpiPastel
          tono="menta"
          delay="anim-d3"
          icon={<Banknote className="h-4 w-4" />}
          label="Ingresos del día"
          value={mxn.format(stats.ingresos)}
          nota={
            stats.porCobrar > 0
              ? `Incluye ${mxn.format(stats.porCobrar)} por cobrar en efectivo`
              : "Todo pagado"
          }
        />
        <KpiPastel tono="durazno" delay="anim-d4" icon={<CheckCircle2 className="h-4 w-4" />} label="Atendidas" value={`${stats.asistidas}/${stats.hoy}`} nota="Marcadas como asistidas" />
      </section>

      <div className="mb-6">
        <CalendarOverview citas={propias} perspective="barbero" title="Agenda mensual" />
      </div>

      {/* Lista de citas */}
      <section className="anim-in anim-d3 space-y-3">
        {visibles.length === 0 && (
          <div
            className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-brand-500/30 py-14 text-center"
            style={{ background: "var(--card)" }}
          >
            <CalendarDays className="h-8 w-8 text-accent-500" />
            <p className="font-medium">Sin citas {vista === "hoy" ? "para hoy" : "próximas"}</p>
            <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
              Las nuevas reservas de clientes aparecen aquí al instante.
            </p>
          </div>
        )}

        {visibles.map((cita, i) => (
          <article
            key={cita.id}
            className={`anim-in anim-d${Math.min(i + 1, 6)} card-hover flex flex-wrap items-center gap-4 rounded-2xl p-4 shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10`}
            style={{ background: "var(--card)" }}
          >
            <div className="flex w-16 shrink-0 flex-col items-center rounded-xl bg-gradient-to-b from-brand-600 to-accent-600 py-2 text-white">
              <span className="text-[10px] font-medium capitalize opacity-90">
                {format(new Date(cita.inicio), "d MMM", { locale: es })}
              </span>
              <span className="text-sm font-semibold">{format(new Date(cita.inicio), "HH:mm")}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{cita.cliente_nombre}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-sm" style={{ color: "var(--ink-muted)" }}>
                {cita.modalidad === "domicilio" ? (
                  <><Home className="h-3.5 w-3.5 text-accent-500" /> A domicilio</>
                ) : (
                  <><MapPin className="h-3.5 w-3.5 text-brand-500" /> En barbería</>
                )}
                <span aria-hidden>·</span> {mxn.format(cita.precio)}
              </p>
              <span className={`badge mt-1.5 ${cita.estado_pago === "pagado" ? "badge-gold" : "badge-warm"}`}>
                {cita.estado_pago === "pagado" ? (
                  <><CreditCard className="h-3 w-3" /> Pagado</>
                ) : (
                  <><Banknote className="h-3 w-3" /> Efectivo pendiente</>
                )}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {cita.estado_pago === "pendiente" && (
                <button
                  onClick={() => store.cobrarEfectivo(cita.id)}
                  className="card-hover rounded-full bg-gradient-to-r from-accent-400 to-accent-500 px-4 py-2 text-sm font-semibold text-brand-900 shadow-sm"
                >
                  Cobrar efectivo
                </button>
              )}
              {cita.modalidad === "domicilio" &&
                cita.direccion_domicilio &&
                cita.estado === "confirmada" && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cita.direccion_domicilio)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600"
                  >
                    Ver dirección
                  </a>
                )}
              {cita.estado === "confirmada" ? (
                <button
                  onClick={() => store.marcarAsistida(cita.id)}
                  className="rounded-full border border-brand-500/30 px-4 py-2 text-sm font-medium text-brand-600 transition-colors hover:bg-brand-50 dark:hover:bg-brand-900/30"
                >
                  Marcar asistida
                </button>
              ) : (
                <span className="badge anim-pop badge-gold px-3 py-1.5 text-xs">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Asistida
                </span>
              )}
            </div>
          </article>
        ))}
      </section>
    </PanelShell>
  );
}

function SinSesion({ rol }: { rol: string }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="anim-in text-lg font-semibold">Inicia sesión como {rol} para ver este panel</p>
      <Link
        href="/login"
        className="anim-in anim-d1 rounded-full bg-gradient-to-r from-brand-600 to-accent-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md"
      >
        Entrar a la demo
      </Link>
    </main>
  );
}
