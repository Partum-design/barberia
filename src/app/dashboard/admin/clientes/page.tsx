"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertTriangle,
  CalendarClock,
  Repeat,
  Search,
  TrendingUp,
  UserRound,
  Users,
} from "lucide-react";
import { PanelShell } from "@/components/shell/PanelShell";
import {
  EmptyState,
  Metric,
  ModulePanel,
  ModuleTabs,
  ShareBar,
  SinAcceso,
  moneda,
  numero,
  porcentaje,
} from "@/components/panel/ModuleUI";
import { calcularLealtad, resumirClientes, useDemoStore } from "@/lib/demo-store";

type Filtro = "todos" | "riesgo" | "vip" | "proximos";

const fecha = (iso: string | null) =>
  iso ? format(new Date(iso), "d MMM yyyy", { locale: es }) : "—";

/**
 * CRM de la barbería. Todo sale del historial de citas: no hay una tabla de
 * clientes que mantener sincronizada, y por tanto no hay dos versiones de la
 * verdad sobre cuánto ha gastado alguien o cuándo vino por última vez.
 */
export default function ClientesPage() {
  const store = useDemoStore();
  const { listo, sesion, citas, recompensasConfig } = store;
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busqueda, setBusqueda] = useState("");

  const clientes = useMemo(() => resumirClientes(citas), [citas]);

  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return clientes
      .filter((c) => (texto ? c.nombre.toLowerCase().includes(texto) : true))
      .filter((c) => {
        if (filtro === "riesgo") return c.enRiesgo;
        if (filtro === "vip") return c.visitas >= 3;
        if (filtro === "proximos") return Boolean(c.proximaCita);
        return true;
      });
  }, [clientes, filtro, busqueda]);

  const totales = useMemo(() => {
    const gasto = clientes.reduce((a, c) => a + c.gastoTotal, 0);
    const recurrentes = clientes.filter((c) => c.visitas > 1).length;
    return {
      total: clientes.length,
      gasto,
      ticket: clientes.length > 0 ? Math.round(gasto / Math.max(1, clientes.reduce((a, c) => a + c.visitas, 0))) : 0,
      recurrencia: clientes.length > 0 ? recurrentes / clientes.length : 0,
      riesgo: clientes.filter((c) => c.enRiesgo).length,
    };
  }, [clientes]);

  if (!listo) return null;
  if (!sesion || sesion.rol !== "admin") return <SinAcceso mensaje="Este módulo es del administrador" />;

  const gastoMaximo = Math.max(1, ...clientes.map((c) => c.gastoTotal));

  return (
    <PanelShell sesion={sesion} activo="Clientes" onLogout={store.logout}>
      <header className="anim-in mb-6">
        <p className="kicker">Relación con el cliente</p>
        <h1 className="font-display text-2xl font-bold tracking-tight">Clientes</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
          Ficha completa de cada persona: gasto, frecuencia, barbero de confianza y quién lleva
          demasiado sin volver.
        </p>
      </header>

      <div className="metric-grid anim-in anim-d1">
        <Metric icono={<Users />} label="Clientes" valor={numero.format(totales.total)} nota={`${totales.riesgo} en riesgo de fuga`} />
        <Metric icono={<TrendingUp />} label="Facturado" valor={moneda.format(totales.gasto)} nota="Histórico cobrado" />
        <Metric icono={<CalendarClock />} label="Ticket medio" valor={moneda.format(totales.ticket)} nota="Por visita atendida" />
        <Metric icono={<Repeat />} label="Recurrencia" valor={porcentaje(totales.recurrencia, 0)} nota="Clientes con más de una visita" />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <ModuleTabs
          valor={filtro}
          onChange={setFiltro}
          opciones={[
            { id: "todos", label: "Todos" },
            { id: "vip", label: "Recurrentes" },
            { id: "proximos", label: "Con cita próxima" },
            { id: "riesgo", label: "En riesgo" },
          ]}
        />
      </div>

      <ModulePanel
        titulo="Cartera"
        descripcion={`${visibles.length} de ${clientes.length} clientes`}
        extra={
          <label className="relative flex items-center">
            <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5" style={{ color: "var(--ink-faint)" }} />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar cliente"
              aria-label="Buscar cliente"
              className="w-44 rounded-full border py-1.5 pl-8 pr-3 text-xs"
            />
          </label>
        }
      >
        {visibles.length === 0 ? (
          <EmptyState icono={<UserRound />}>
            Ningún cliente coincide con este filtro todavía.
          </EmptyState>
        ) : (
          <div className="grid gap-2">
            {visibles.map((c) => {
              const lealtad = calcularLealtad(citas, c.id, recompensasConfig.citas_requeridas);
              return (
                <article key={c.id} className="client-row">
                  <span className="client-avatar">{c.nombre.charAt(0)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold" style={{ color: "var(--ink)" }}>
                      {c.nombre}
                      {c.enRiesgo && (
                        <span className="badge badge-warm ml-2 align-middle">
                          <AlertTriangle /> {c.diasDesdeUltima} días sin volver
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-[0.68rem]" style={{ color: "var(--ink-muted)" }}>
                      {c.visitas} visita{c.visitas === 1 ? "" : "s"} · última {fecha(c.ultimaVisita)} · barbero
                      de confianza: {c.barberoPreferido}
                      {c.cadenciaDias !== null && ` · vuelve cada ~${c.cadenciaDias} días`}
                    </p>
                    <div className="mt-1.5 max-w-56">
                      <ShareBar valor={c.gastoTotal / gastoMaximo} tono={c.enRiesgo ? "ox" : "oro"} />
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-num text-sm font-semibold" style={{ color: "var(--ink)" }}>
                      {moneda.format(c.gastoTotal)}
                    </p>
                    <p className="text-[0.62rem]" style={{ color: "var(--ink-faint)" }}>
                      ticket {moneda.format(c.ticketMedio)}
                    </p>
                    <p className="mt-1 text-[0.62rem]" style={{ color: "var(--gold)" }}>
                      lealtad {lealtad.progreso}/{lealtad.requerido}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </ModulePanel>
    </PanelShell>
  );
}
