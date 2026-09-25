"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Banknote, CalendarCheck, ShieldCheck, TrendingUp, Users } from "lucide-react";
import { PanelShell, KpiPastel } from "@/components/shell/PanelShell";
import { useDemoStore } from "@/lib/demo-store";

const mxn = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
const mxnCompact = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", notation: "compact", maximumFractionDigits: 1 });

// Paleta categórica validada (dataviz skill): pasos claros para superficie
// clara, pasos oscuros para superficie oscura — mismo orden, sin ciclarla.
const CATEGORICAL_LIGHT = ["#10162E", "#5C2015", "#8F3320", "#B4432A", "#A5822F"];
const CATEGORICAL_DARK = ["#CBA135", "#A5822F", "#B4432A", "#8F3320", "#5C2015"];
const INK_MUTED_LIGHT = "#756A5A";
const INK_MUTED_DARK = "#E2C7C0";
const GRID_LIGHT = "#E6DCC8";
const GRID_DARK = "#5C2015";

function useEsDark() {
  const [esOscuro, setEsOscuro] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setEsOscuro(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setEsOscuro(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return esOscuro;
}

function TooltipCard({ active, payload, label, formatter }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; formatter: (v: number) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-900/10 bg-white px-3 py-2 text-xs shadow-lg dark:border-white/10 dark:bg-slate-900">
      <p className="mb-1 font-medium">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-1.5" style={{ color: p.color }}>
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-600 dark:text-slate-300">{p.name}:</span>
          <span className="font-semibold">{formatter(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

// Nodo Administrador: reportes financieros y operativos de la barbería.
export default function ReportesPage() {
  const store = useDemoStore();
  const { listo, sesion, citas, barberos } = store;
  const esOscuro = useEsDark();
  const cat = esOscuro ? CATEGORICAL_DARK : CATEGORICAL_LIGHT;
  const inkMuted = esOscuro ? INK_MUTED_DARK : INK_MUTED_LIGHT;
  const grid = esOscuro ? GRID_DARK : GRID_LIGHT;

  const datos = useMemo(() => {
    const vivas = citas.filter((c) => c.estado !== "cancelada");
    const asistidas = citas.filter((c) => c.estado === "asistida");

    const porBarbero = barberos
      .map((m) => {
        const suyas = vivas.filter((c) => c.barbero_id === m.id);
        return {
          nombre: m.nombre.replace(/^Dra?\.\s*/, ""),
          ingresos: suyas.reduce((s, c) => s + c.precio, 0),
          citas: suyas.length,
        };
      })
      .filter((m) => m.citas > 0)
      .sort((a, b) => b.ingresos - a.ingresos);

    const tarjeta = vivas.filter((c) => c.metodo_pago === "tarjeta");
    const efectivo = vivas.filter((c) => c.metodo_pago === "efectivo");
    const porMetodo = [
      { metodo: "Tarjeta", ingresos: tarjeta.reduce((s, c) => s + c.precio, 0), citas: tarjeta.length },
      { metodo: "Efectivo", ingresos: efectivo.reduce((s, c) => s + c.precio, 0), citas: efectivo.length },
    ];

    const dias = Array.from({ length: 14 }).map((_, i) => {
      const dia = addDays(new Date(), -13 + i);
      const clave = format(dia, "yyyy-MM-dd");
      const delDia = vivas.filter((c) => c.inicio.slice(0, 10) === clave);
      return {
        fecha: format(dia, "d MMM", { locale: es }),
        citas: delDia.length,
      };
    });

    return {
      porBarbero,
      porMetodo,
      dias,
      ingresoTotal: vivas.reduce((s, c) => s + c.precio, 0),
      ticketPromedio: vivas.length ? vivas.reduce((s, c) => s + c.precio, 0) / vivas.length : 0,
      tasaAsistencia: vivas.length ? asistidas.length / vivas.length : 0,
      clientes: new Set(vivas.map((c) => c.cliente_id)).size,
    };
  }, [citas, barberos]);

  if (!listo) return null;

  if (!sesion || sesion.rol !== "admin") {
    return <SinSesion />;
  }

  return (
    <PanelShell sesion={sesion} activo="Reportes" onLogout={store.logout}>
      <header className="anim-in mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Reportes</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
          Desempeño financiero y operativo de la barbería en vivo.
        </p>
      </header>

      <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiPastel tono="lila" delay="anim-d1" icon={<Banknote className="h-4 w-4" />} label="Ingresos totales" value={mxn.format(datos.ingresoTotal)} nota="Citas confirmadas y asistidas" />
        <KpiPastel tono="azul" delay="anim-d2" icon={<TrendingUp className="h-4 w-4" />} label="Ticket promedio" value={mxn.format(Math.round(datos.ticketPromedio))} nota="Por cita" />
        <KpiPastel tono="menta" delay="anim-d3" icon={<CalendarCheck className="h-4 w-4" />} label="Tasa de asistencia" value={`${Math.round(datos.tasaAsistencia * 100)}%`} nota="Asistidas vs. totales" />
        <KpiPastel tono="durazno" delay="anim-d4" icon={<Users className="h-4 w-4" />} label="Clientes activos" value={String(datos.clientes)} nota="Con al menos una cita" />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="anim-in anim-d2 rounded-3xl p-5 shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10" style={{ background: "var(--card)" }}>
          <h2 className="mb-4 font-semibold">Ingresos por barbero</h2>
          {datos.porBarbero.length === 0 ? (
            <EmptyState texto="Aún no hay citas registradas." />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={datos.porBarbero} layout="vertical" margin={{ left: 8, right: 24 }}>
                  <CartesianGrid horizontal={false} stroke={grid} />
                  <XAxis type="number" tickFormatter={(v) => mxnCompact.format(v)} tick={{ fill: inkMuted, fontSize: 12 }} axisLine={{ stroke: grid }} tickLine={false} />
                  <YAxis type="category" dataKey="nombre" width={90} tick={{ fill: inkMuted, fontSize: 12 }} axisLine={{ stroke: grid }} tickLine={false} />
                  <Tooltip content={<TooltipCard formatter={(v) => mxn.format(v)} />} cursor={{ fill: esOscuro ? "rgba(255,255,255,0.04)" : "rgba(15,23,42,0.04)" }} />
                  <Bar dataKey="ingresos" name="Ingresos" radius={[0, 4, 4, 0]} barSize={22} label={{ position: "right", fill: inkMuted, fontSize: 11, formatter: (v) => mxnCompact.format(Number(v)) }}>
                    {datos.porBarbero.map((_, i) => (
                      <Cell key={i} fill={cat[i % cat.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="anim-in anim-d3 rounded-3xl p-5 shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10" style={{ background: "var(--card)" }}>
          <h2 className="mb-4 font-semibold">Ingresos por método de pago</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={datos.porMetodo} layout="vertical" margin={{ left: 8, right: 24 }}>
                <CartesianGrid horizontal={false} stroke={grid} />
                <XAxis type="number" tickFormatter={(v) => mxnCompact.format(v)} tick={{ fill: inkMuted, fontSize: 12 }} axisLine={{ stroke: grid }} tickLine={false} />
                <YAxis type="category" dataKey="metodo" width={90} tick={{ fill: inkMuted, fontSize: 12 }} axisLine={{ stroke: grid }} tickLine={false} />
                <Tooltip content={<TooltipCard formatter={(v) => mxn.format(v)} />} cursor={{ fill: esOscuro ? "rgba(255,255,255,0.04)" : "rgba(15,23,42,0.04)" }} />
                <Bar dataKey="ingresos" name="Ingresos" radius={[0, 4, 4, 0]} barSize={28} label={{ position: "right", fill: inkMuted, fontSize: 11, formatter: (v) => mxnCompact.format(Number(v)) }}>
                  <Cell fill={cat[0]} />
                  <Cell fill={cat[1]} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="anim-in anim-d4 rounded-3xl p-5 shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10 lg:col-span-2" style={{ background: "var(--card)" }}>
          <h2 className="mb-4 font-semibold">Citas por día (últimos 14 días)</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={datos.dias} margin={{ left: -16 }}>
                <CartesianGrid vertical={false} stroke={grid} />
                <XAxis dataKey="fecha" tick={{ fill: inkMuted, fontSize: 11 }} axisLine={{ stroke: grid }} tickLine={false} interval={1} />
                <YAxis allowDecimals={false} tick={{ fill: inkMuted, fontSize: 12 }} axisLine={{ stroke: grid }} tickLine={false} />
                <Tooltip content={<TooltipCard formatter={(v) => `${v} ${v === 1 ? "cita" : "citas"}`} />} cursor={{ fill: esOscuro ? "rgba(255,255,255,0.04)" : "rgba(15,23,42,0.04)" }} />
                <Bar dataKey="citas" name="Citas" fill={cat[0]} radius={[4, 4, 0, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </PanelShell>
  );
}

function EmptyState({ texto }: { texto: string }) {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-2 text-center text-sm" style={{ color: "var(--ink-muted)" }}>
      {texto}
    </div>
  );
}

function SinSesion() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <ShieldCheck className="h-8 w-8 text-accent-500" />
      <p className="anim-in text-lg font-semibold">Inicia sesión como administrador para ver este panel</p>
      <Link
        href="/login"
        className="anim-in anim-d1 rounded-full bg-gradient-to-r from-brand-600 to-accent-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md"
      >
        Entrar a la demo
      </Link>
    </main>
  );
}
