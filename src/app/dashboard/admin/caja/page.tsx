"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  Check,
  CreditCard,
  Plus,
  Receipt,
  Trash2,
  Wallet,
} from "lucide-react";
import { PanelShell } from "@/components/shell/PanelShell";
import {
  EmptyState,
  Metric,
  ModulePanel,
  ShareBar,
  SinAcceso,
  moneda,
  numero,
  porcentaje,
} from "@/components/panel/ModuleUI";
import { useBarberia, type Gasto } from "@/lib/store";

const CATEGORIAS: Gasto["categoria"][] = [
  "Renta",
  "Insumos",
  "Nómina",
  "Publicidad",
  "Servicios",
  "Otros",
];

const DIAS = 28;

/**
 * Caja y finanzas: corte del periodo, desglose por método de cobro, comisiones
 * del equipo y gastos. Es la vista que responde a la única pregunta que
 * importa al cerrar el mes: qué quedó.
 */
export default function CajaPage() {
  const store = useBarberia();
  const { listo, sesion, citas, gastos, servicios } = store;
  const [abierto, setAbierto] = useState(false);
  const [form, setForm] = useState({ concepto: "", categoria: "Insumos" as Gasto["categoria"], monto: 0 });

  const desde = useMemo(() => Date.now() - DIAS * 86_400_000, []);

  const periodo = useMemo(() => {
    const enRango = citas.filter(
      (c) => c.estado !== "cancelada" && new Date(c.inicio).getTime() >= desde
    );
    const pagadas = enRango.filter((c) => c.estado_pago === "pagado");
    const tarjeta = pagadas.filter((c) => c.metodo_pago === "tarjeta");
    const efectivo = pagadas.filter((c) => c.metodo_pago === "efectivo");
    const pendientes = enRango.filter((c) => c.estado_pago === "pendiente");

    const suma = (lista: typeof enRango) => lista.reduce((a, c) => a + c.precio, 0);

    // Comisión: la del servicio del catálogo que mejor encaja por precio; si no
    // hay coincidencia, la media del catálogo activo. Aproximar es preferible a
    // no repartir nada y dejar la utilidad inflada.
    const activos = servicios.filter((s) => s.activo);
    const comisionMedia =
      activos.length > 0 ? activos.reduce((a, s) => a + s.comision_pct, 0) / activos.length : 45;
    const comisionDe = (precio: number) => {
      const exacto = activos.find((s) => s.precio === precio);
      return (exacto?.comision_pct ?? comisionMedia) / 100;
    };

    const porBarbero = new Map<string, { nombre: string; citas: number; ingreso: number; comision: number }>();
    for (const c of pagadas) {
      const actual = porBarbero.get(c.barbero_id) ?? {
        nombre: c.barbero_nombre,
        citas: 0,
        ingreso: 0,
        comision: 0,
      };
      actual.citas += 1;
      actual.ingreso += c.precio;
      actual.comision += c.precio * comisionDe(c.precio);
      porBarbero.set(c.barbero_id, actual);
    }

    const gastosPeriodo = gastos.filter((g) => new Date(g.fecha).getTime() >= desde);
    const totalGastos = gastosPeriodo.reduce((a, g) => a + g.monto, 0);
    const ingresos = suma(pagadas);
    const comisiones = [...porBarbero.values()].reduce((a, b) => a + b.comision, 0);

    return {
      citas: enRango.length,
      ingresos,
      tarjeta: suma(tarjeta),
      efectivo: suma(efectivo),
      porCobrar: suma(pendientes),
      pendientes: pendientes.length,
      barberos: [...porBarbero.values()].sort((a, b) => b.ingreso - a.ingreso),
      comisiones,
      gastosPeriodo,
      totalGastos,
      utilidad: ingresos - comisiones - totalGastos,
      ticketMedio: pagadas.length > 0 ? ingresos / pagadas.length : 0,
    };
  }, [citas, gastos, servicios, desde]);

  const porCategoria = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const g of periodo.gastosPeriodo) mapa.set(g.categoria, (mapa.get(g.categoria) ?? 0) + g.monto);
    return [...mapa.entries()].map(([categoria, monto]) => ({ categoria, monto })).sort((a, b) => b.monto - a.monto);
  }, [periodo.gastosPeriodo]);

  if (!listo) return null;
  if (!sesion || sesion.rol !== "admin") return <SinAcceso mensaje="Este módulo es del administrador" />;

  function registrar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.concepto.trim() || form.monto <= 0) return;
    store.agregarGasto({ ...form, concepto: form.concepto.trim() });
    setForm({ concepto: "", categoria: "Insumos", monto: 0 });
    setAbierto(false);
  }

  const totalCobrado = Math.max(1, periodo.tarjeta + periodo.efectivo);
  const maxGasto = Math.max(1, ...porCategoria.map((c) => c.monto));

  return (
    <PanelShell sesion={sesion} activo="Caja y finanzas" onLogout={store.logout}>
      <header className="anim-in mb-6">
        <p className="kicker">Corte de los últimos {DIAS} días</p>
        <h1 className="font-display text-2xl font-bold tracking-tight">Caja y finanzas</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
          Lo que entró, cómo entró, cuánto se llevó el equipo y qué quedó después de gastos.
        </p>
      </header>

      <div className="metric-grid anim-in anim-d1">
        <Metric icono={<Wallet />} label="Ingresos cobrados" valor={moneda.format(periodo.ingresos)} nota={`${periodo.citas} citas en el periodo`} />
        <Metric icono={<Receipt />} label="Por cobrar" valor={moneda.format(periodo.porCobrar)} nota={`${periodo.pendientes} citas pendientes de pago`} />
        <Metric icono={<ArrowDownRight />} label="Gastos y comisiones" valor={moneda.format(periodo.totalGastos + periodo.comisiones)} nota={`${moneda.format(periodo.comisiones)} en comisiones`} />
        <Metric icono={<ArrowUpRight />} label="Utilidad" valor={moneda.format(periodo.utilidad)} nota={`Ticket medio ${moneda.format(periodo.ticketMedio)}`} />
      </div>

      <div className="module-split mt-3">
        <div>
          <ModulePanel titulo="Cómo se cobró" descripcion="Reparto entre pasarela y efectivo en barbería">
            <div className="grid gap-3">
              <div>
                <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
                  <span className="inline-flex items-center gap-1.5" style={{ color: "var(--ink)" }}>
                    <CreditCard className="h-3.5 w-3.5" /> Tarjeta y pasarela
                  </span>
                  <span className="font-num" style={{ color: "var(--ink-muted)" }}>
                    {moneda.format(periodo.tarjeta)} · {porcentaje(periodo.tarjeta / totalCobrado, 0)}
                  </span>
                </div>
                <ShareBar valor={periodo.tarjeta / totalCobrado} />
              </div>
              <div>
                <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
                  <span className="inline-flex items-center gap-1.5" style={{ color: "var(--ink)" }}>
                    <Banknote className="h-3.5 w-3.5" /> Efectivo en barbería
                  </span>
                  <span className="font-num" style={{ color: "var(--ink-muted)" }}>
                    {moneda.format(periodo.efectivo)} · {porcentaje(periodo.efectivo / totalCobrado, 0)}
                  </span>
                </div>
                <ShareBar valor={periodo.efectivo / totalCobrado} tono="ox" />
              </div>
            </div>
          </ModulePanel>

          <ModulePanel titulo="Producción del equipo" descripcion="Ingreso generado y comisión devengada por barbero">
            {periodo.barberos.length === 0 ? (
              <EmptyState icono={<Wallet />}>Sin cobros registrados en el periodo.</EmptyState>
            ) : (
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Barbero</th>
                      <th className="num">Citas</th>
                      <th className="num">Ingreso</th>
                      <th className="num">Comisión</th>
                      <th className="num">Queda en caja</th>
                    </tr>
                  </thead>
                  <tbody>
                    {periodo.barberos.map((b) => (
                      <tr key={b.nombre}>
                        <td className="strong">{b.nombre}</td>
                        <td className="num">{numero.format(b.citas)}</td>
                        <td className="num">{moneda.format(b.ingreso)}</td>
                        <td className="num muted">{moneda.format(b.comision)}</td>
                        <td className="num">{moneda.format(b.ingreso - b.comision)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ModulePanel>
        </div>

        <div>
          <ModulePanel
            titulo="Gastos"
            descripcion={`${moneda.format(periodo.totalGastos)} en el periodo`}
            extra={
              <button type="button" className="btn-gold px-3 py-2 text-xs" onClick={() => setAbierto((v) => !v)}>
                <Plus className="h-3.5 w-3.5" /> Registrar
              </button>
            }
          >
            {abierto && (
              <form onSubmit={registrar} className="mb-3 grid gap-2 rounded-xl border p-3" style={{ borderColor: "var(--line)" }}>
                <input
                  value={form.concepto}
                  onChange={(e) => setForm({ ...form, concepto: e.target.value })}
                  placeholder="Concepto del gasto"
                  required
                  className="rounded-lg border px-2.5 py-2 text-sm"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={form.categoria}
                    onChange={(e) => setForm({ ...form, categoria: e.target.value as Gasto["categoria"] })}
                    className="rounded-lg border px-2.5 py-2 text-sm"
                  >
                    {CATEGORIAS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={form.monto || ""}
                    onChange={(e) => setForm({ ...form, monto: Number(e.target.value) })}
                    placeholder="Monto"
                    required
                    className="rounded-lg border px-2.5 py-2 text-sm"
                  />
                </div>
                <button type="submit" className="btn-gold py-2 text-xs">
                  <Check className="h-3.5 w-3.5" /> Guardar gasto
                </button>
              </form>
            )}

            {porCategoria.length > 0 && (
              <div className="mb-3 grid gap-2">
                {porCategoria.map((c) => (
                  <div key={c.categoria}>
                    <div className="mb-1 flex items-baseline justify-between gap-3 text-[0.68rem]">
                      <span style={{ color: "var(--ink)" }}>{c.categoria}</span>
                      <span className="font-num" style={{ color: "var(--ink-muted)" }}>{moneda.format(c.monto)}</span>
                    </div>
                    <ShareBar valor={c.monto / maxGasto} tono="ox" />
                  </div>
                ))}
              </div>
            )}

            {periodo.gastosPeriodo.length === 0 ? (
              <EmptyState icono={<Receipt />}>Sin gastos registrados en el periodo.</EmptyState>
            ) : (
              <div className="grid gap-1.5">
                {periodo.gastosPeriodo.map((g) => (
                  <div key={g.id} className="flex items-center gap-2 rounded-xl border p-2.5" style={{ borderColor: "var(--line)" }}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium" style={{ color: "var(--ink)" }}>{g.concepto}</p>
                      <p className="text-[0.62rem]" style={{ color: "var(--ink-faint)" }}>
                        {g.categoria} · {format(new Date(g.fecha), "d MMM", { locale: es })}
                      </p>
                    </div>
                    <span className="font-num text-xs" style={{ color: "var(--ink)" }}>{moneda.format(g.monto)}</span>
                    <button
                      type="button"
                      aria-label={`Eliminar ${g.concepto}`}
                      onClick={() => store.eliminarGasto(g.id)}
                      className="grid h-7 w-7 place-items-center rounded-lg btn-danger-ghost"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </ModulePanel>
        </div>
      </div>
    </PanelShell>
  );
}
