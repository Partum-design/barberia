"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Banknote, CalendarCheck, CalendarPlus, ScanLine, CheckCircle2, Circle, CreditCard, Gift, TrendingUp, UserPlus, Users } from "lucide-react";
import { PanelShell, KpiPastel } from "@/components/shell/PanelShell";
import { PanelHero } from "@/components/panel/PanelHero";
import { CalendarOverview } from "@/components/calendar/CalendarOverview";
import { isToday } from "date-fns";
import { citaActiva, nombreDelNegocio, resumirBarberos, resumirCitas, useBarberia } from "@/lib/store";
import { WALLET_VISIBLE } from "@/lib/modo";

const mxn = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

// Nodo Administrador: métricas calculadas en vivo desde el almacén local —
// atender o agendar citas en los otros paneles cambia estos números.
export default function DashboardAdminPage() {
  const store = useBarberia();
  const { listo, citas, sesion, barberos, recompensasConfig, barberiaConfig, servicios, clientes } = store;

  // Todo sale de las mismas funciones que usan Reportes, Caja y Equipo: al
  // confirmar una llegada cambian a la vez aquí y en el resto del panel.
  const stats = useMemo(() => {
    const general = resumirCitas(citas);
    const hoy = resumirCitas(citas.filter((c) => isToday(new Date(c.inicio))));
    const efectivo = citas.filter((c) => citaActiva(c) && c.metodo_pago === "efectivo").length;
    const tarjeta = citas.filter((c) => citaActiva(c) && c.metodo_pago === "tarjeta").length;
    return {
      ...general,
      hoy,
      recompensas: Math.floor(general.atendidas / Math.max(1, recompensasConfig.citas_requeridas)),
      tarjetaCitas: tarjeta,
      efectivoCitas: efectivo,
      porBarbero: resumirBarberos(citas, barberos).map((r) => ({ ...r, especialidad: barberos.find((b) => b.id === r.id)?.especialidad ?? "" })),
    };
  }, [citas, barberos, recompensasConfig]);

  if (!listo) return null;

  if (!sesion || sesion.rol !== "admin") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="anim-in text-lg font-semibold">
          Inicia sesión como administrador para ver este panel
        </p>
        <Link
          href="/login"
          className="anim-in anim-d1 rounded-full bg-gradient-to-r from-brand-600 to-accent-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md"
        >
          Iniciar sesión
        </Link>
      </main>
    );
  }

  return (
    <PanelShell sesion={sesion} activo="Panel" onLogout={store.logout}>
      <PanelHero
        kicker="Panel de administración"
        title={nombreDelNegocio(barberiaConfig)}
        lead="Los números se actualizan en vivo con la actividad de clientes y barberos."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/admin/confirmar" className="btn-gold px-5 py-2.5 text-sm">
              <ScanLine className="h-4 w-4" /> Confirmar cita
            </Link>
            <Link href="/dashboard/admin/citas?nueva=" className="btn-linea">
              <CalendarPlus className="h-4 w-4" /> Nueva cita
            </Link>
            <Link href="/dashboard/admin/usuarios" className="btn-linea">
              <UserPlus className="h-4 w-4" /> Crear usuario
            </Link>
          </div>
        }
      />

      {/* KPIs pastel estilo referencia */}
      <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiPastel
          tono="lila"
          delay="anim-d1"
          icon={<Banknote className="h-4 w-4" />}
          label="Ingresos"
          value={mxn.format(stats.ingresos)}
          nota={
            stats.porCobrar > 0
              ? `Servicios atendidos · ${mxn.format(stats.porCobrar)} por cobrar`
              : `Servicios atendidos · hoy ${mxn.format(stats.hoy.ingresos)}`
          }
        />
        <KpiPastel tono="azul" delay="anim-d2" icon={<CalendarCheck className="h-4 w-4" />} label="Visitas atendidas" value={String(stats.atendidas)} nota={`Hoy ${stats.hoy.atendidas} · ${stats.porVenir} agendadas por venir`} />
        <KpiPastel tono="menta" delay="anim-d3" icon={<TrendingUp className="h-4 w-4" />} label="Tasa de asistencia" value={`${Math.round(stats.asistencia * 100)}%`} nota={`${stats.faltas} falta${stats.faltas === 1 ? "" : "s"} registradas`} />
        <KpiPastel tono="durazno" delay="anim-d4" icon={<Users className="h-4 w-4" />} label="Clientes atendidos" value={String(stats.clientes)} nota={`${clientes.length} registrados`} />
      </section>

      <div className="mb-6">
        <CalendarOverview citas={citas} perspective="admin" title="Agenda de la barbería" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Equipo de barberos */}
        <section
          className="anim-in anim-d3 rounded-3xl p-5 shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10 lg:col-span-2"
          style={{ background: "var(--card)" }}
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Equipo de barberos</h2>
            <Link
              href="/dashboard/admin/equipo"
              className="card-hover rounded-full bg-gradient-to-r from-brand-600 to-accent-500 px-4 py-1.5 text-sm font-medium text-white shadow-sm"
            >
              + Dar de alta
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left" style={{ color: "var(--ink-muted)" }}>
                  <th className="pb-3 font-medium">Barbero</th>
                  <th className="pb-3 font-medium">Especialidad</th>
                  <th className="pb-3 text-right font-medium">Atendidas</th>
                  <th className="pb-3 text-right font-medium">Clientes</th>
                  <th className="pb-3 text-right font-medium">Ingresos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {stats.porBarbero.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-sm" style={{ color: "var(--ink-muted)" }}>
                      Aún no hay barberos dados de alta.
                    </td>
                  </tr>
                )}
                {stats.porBarbero.map((m) => (
                  <tr key={m.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-white/5">
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-accent-500 text-xs font-semibold text-white">
                          {m.nombre.replace(/^Dra?\.\s*/, "").charAt(0)}
                        </span>
                        <span className="font-medium">{m.nombre}</span>
                        {!m.activo && (
                          <span className="badge badge-neutral px-2 py-0.5 text-[11px]">
                            Inactivo
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3" style={{ color: "var(--ink-muted)" }}>{m.especialidad}</td>
                    <td className="py-3 text-right tabular-nums">
                      {m.atendidas}
                      {m.porVenir > 0 && <span className="block text-[11px]" style={{ color: "var(--ink-faint)" }}>+{m.porVenir} por venir</span>}
                    </td>
                    <td className="py-3 text-right tabular-nums">{m.clientes}</td>
                    <td className="py-3 text-right tabular-nums">{mxn.format(m.ingresos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Link
            href="/dashboard/admin/equipo"
            className="mt-4 inline-block text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            Gestionar equipo de barberos →
          </Link>
        </section>

        {/* Lealtad + acciones */}
        <div className="space-y-4">
          <section className="anim-in anim-d4 card-hover rounded-3xl bg-gradient-to-br from-brand-700 via-brand-600 to-accent-500 p-6 text-white shadow-md">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
                <Gift className="h-5 w-5" />
              </span>
              <h2 className="font-semibold">Programa de lealtad</h2>
            </div>
            <p className="text-3xl font-bold tabular-nums">{stats.recompensas}</p>
            <p className="mt-1 text-sm text-white/80">
              recompensas desbloqueadas · regla activa: {recompensasConfig.citas_requeridas} citas
              → {recompensasConfig.valor_descuento}% de descuento
            </p>
            <Link
              href="/dashboard/admin/configuracion"
              className="card-hover mt-4 block w-full rounded-full bg-white px-4 py-2 text-center text-sm font-semibold text-brand-700"
            >
              Configurar recompensas
            </Link>
          </section>

          <section
            className="anim-in anim-d5 rounded-3xl p-5 shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10"
            style={{ background: "var(--card)" }}
          >
            <h2 className="mb-3 font-semibold">Métodos de pago</h2>
            <div className="space-y-2.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2" style={{ color: "var(--ink-muted)" }}>
                  <CreditCard className="h-4 w-4 text-brand-500" /> Tarjeta (Stripe)
                </span>
                <span className="font-medium tabular-nums">{stats.tarjetaCitas} citas</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2" style={{ color: "var(--ink-muted)" }}>
                  <Banknote className="h-4 w-4 text-brand-500" /> Efectivo en barbería
                </span>
                <span className="font-medium tabular-nums">{stats.efectivoCitas} citas</span>
              </div>
              {stats.porCobrarCitas > 0 && (
                <p className="mt-1 rounded-xl bg-brand-50 px-3 py-2 text-xs text-brand-700">
                  {stats.porCobrarCitas} {stats.porCobrarCitas === 1 ? "cita" : "citas"} por
                  cobrar en recepción ({mxn.format(stats.porCobrar)}) · ya atendidas
                </p>
              )}
            </div>
            <Link
              href="/dashboard/admin/reportes"
              className="mt-3 inline-block text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              Ver reportes completos →
            </Link>
          </section>

          <PrimerosPasos
            pasos={[
              { hecho: Boolean(barberiaConfig.nombre.trim() && barberiaConfig.direccion.trim()), label: "Datos del negocio", nota: "Nombre, dirección, horario y redes para la portada", href: "/dashboard/admin/configuracion" },
              { hecho: servicios.length > 0, label: "Servicios y precios", nota: "El menú que ve el cliente en la portada", href: "/dashboard/admin/servicios" },
              { hecho: barberos.length > 0, label: "Equipo de barberos", nota: "Cada barbero con su especialidad y precio", href: "/dashboard/admin/equipo" },
              { hecho: clientes.length > 0, label: "Primer cliente con tarjeta", nota: WALLET_VISIBLE ? "Emite su tarjeta de lealtad y vincúlala a Google Wallet" : "Emite su tarjeta de lealtad", href: "/dashboard/admin/lealtad" },
            ]}
          />
        </div>
      </div>
    </PanelShell>
  );
}

function PrimerosPasos({
  pasos,
}: {
  pasos: { hecho: boolean; label: string; nota: string; href: string }[];
}) {
  const hechos = pasos.filter((p) => p.hecho).length;
  if (hechos === pasos.length) return null;
  return (
    <section
      className="anim-in anim-d5 rounded-3xl p-5 text-sm shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10"
      style={{ background: "var(--card)" }}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">Primeros pasos</h3>
        <span className="text-xs" style={{ color: "var(--ink-muted)" }}>
          {hechos} de {pasos.length}
        </span>
      </div>
      <ul className="space-y-2">
        {pasos.map((p) => (
          <li key={p.label}>
            <Link href={p.href} className="flex items-start gap-2.5 rounded-xl px-2 py-1.5 transition-colors hover:bg-white/5">
              {p.hecho ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent-500" />
              ) : (
                <Circle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--ink-faint)" }} />
              )}
              <span>
                <span className={`block font-medium ${p.hecho ? "line-through opacity-60" : ""}`}>{p.label}</span>
                <span className="block text-xs" style={{ color: "var(--ink-muted)" }}>{p.nota}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
