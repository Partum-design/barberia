"use client";

import { useMemo, useState } from "react";
import { Check, Clock3, Percent, Plus, Tags, Wallet } from "lucide-react";
import { PanelShell } from "@/components/shell/PanelShell";
import {
  EmptyState,
  Metric,
  ModulePanel,
  SinAcceso,
  moneda,
  numero,
} from "@/components/panel/ModuleUI";
import { useBarberia, type Servicio } from "@/lib/store";

const CATEGORIAS: Servicio["categoria"][] = ["Corte", "Barba", "Color", "Ritual", "Paquete"];

/** Catálogo de servicios: precio, duración y comisión del barbero. */
export default function ServiciosPage() {
  const store = useBarberia();
  const { listo, sesion, servicios } = store;
  const [abierto, setAbierto] = useState(false);
  const [form, setForm] = useState({
    nombre: "",
    categoria: "Corte" as Servicio["categoria"],
    precio: 250,
    duracion_min: 30,
    comision_pct: 45,
  });

  const activos = useMemo(() => servicios.filter((s) => s.activo), [servicios]);
  const resumen = useMemo(() => {
    if (activos.length === 0) return { precioMedio: 0, duracionMedia: 0, comisionMedia: 0 };
    return {
      precioMedio: Math.round(activos.reduce((a, s) => a + s.precio, 0) / activos.length),
      duracionMedia: Math.round(activos.reduce((a, s) => a + s.duracion_min, 0) / activos.length),
      comisionMedia: Math.round(activos.reduce((a, s) => a + s.comision_pct, 0) / activos.length),
    };
  }, [activos]);

  if (!listo) return null;
  if (!sesion || sesion.rol !== "admin") return <SinAcceso mensaje="Este módulo es del administrador" />;

  function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nombre.trim()) return;
    store.agregarServicio({ ...form, nombre: form.nombre.trim() });
    setForm({ nombre: "", categoria: "Corte", precio: 250, duracion_min: 30, comision_pct: 45 });
    setAbierto(false);
  }

  return (
    <PanelShell sesion={sesion} activo="Servicios" onLogout={store.logout}>
      <header className="anim-in mb-6">
        <p className="kicker">Catálogo</p>
        <h1 className="font-display text-2xl font-bold tracking-tight">Servicios</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
          Lo que la barbería ofrece, a qué precio, cuánto ocupa el sillón y qué parte se lleva el
          barbero.
        </p>
      </header>

      <div className="metric-grid anim-in anim-d1">
        <Metric icono={<Tags />} label="Servicios activos" valor={numero.format(activos.length)} nota={`${servicios.length - activos.length} en pausa`} />
        <Metric icono={<Wallet />} label="Precio medio" valor={moneda.format(resumen.precioMedio)} nota="Sobre los servicios activos" />
        <Metric icono={<Clock3 />} label="Duración media" valor={`${resumen.duracionMedia} min`} nota="Ocupación del sillón" />
        <Metric icono={<Percent />} label="Comisión media" valor={`${resumen.comisionMedia} %`} nota="Parte del barbero" />
      </div>

      <ModulePanel
        titulo="Catálogo"
        descripcion="Toca un servicio para activarlo o pausarlo."
        extra={
          <button type="button" className="btn-gold px-3 py-2 text-xs" onClick={() => setAbierto((v) => !v)}>
            <Plus className="h-3.5 w-3.5" /> Nuevo servicio
          </button>
        }
      >
        {abierto && (
          <form onSubmit={crear} className="mb-4 grid gap-2 rounded-2xl border p-3 sm:grid-cols-5" style={{ borderColor: "var(--line)" }}>
            <label className="sm:col-span-2 text-[0.68rem]" style={{ color: "var(--ink-muted)" }}>
              Nombre
              <input
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Corte y barba premium"
                required
                className="mt-1 w-full rounded-lg border px-2.5 py-2 text-sm"
              />
            </label>
            <label className="text-[0.68rem]" style={{ color: "var(--ink-muted)" }}>
              Categoría
              <select
                value={form.categoria}
                onChange={(e) => setForm({ ...form, categoria: e.target.value as Servicio["categoria"] })}
                className="mt-1 w-full rounded-lg border px-2.5 py-2 text-sm"
              >
                {CATEGORIAS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[0.68rem]" style={{ color: "var(--ink-muted)" }}>
              Precio (MXN)
              <input
                type="number"
                min={0}
                value={form.precio}
                onChange={(e) => setForm({ ...form, precio: Number(e.target.value) })}
                className="mt-1 w-full rounded-lg border px-2.5 py-2 text-sm"
              />
            </label>
            <label className="text-[0.68rem]" style={{ color: "var(--ink-muted)" }}>
              Duración (min)
              <input
                type="number"
                min={5}
                step={5}
                value={form.duracion_min}
                onChange={(e) => setForm({ ...form, duracion_min: Number(e.target.value) })}
                className="mt-1 w-full rounded-lg border px-2.5 py-2 text-sm"
              />
            </label>
            <div className="sm:col-span-5 flex items-end justify-between gap-3">
              <label className="text-[0.68rem]" style={{ color: "var(--ink-muted)" }}>
                Comisión del barbero (%)
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={form.comision_pct}
                  onChange={(e) => setForm({ ...form, comision_pct: Number(e.target.value) })}
                  className="mt-1 w-32 rounded-lg border px-2.5 py-2 text-sm"
                />
              </label>
              <button type="submit" className="btn-gold px-4 py-2 text-xs">
                <Check className="h-3.5 w-3.5" /> Guardar servicio
              </button>
            </div>
          </form>
        )}

        {servicios.length === 0 ? (
          <EmptyState icono={<Tags />}>Todavía no hay servicios en el catálogo.</EmptyState>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Servicio</th>
                  <th>Categoría</th>
                  <th className="num">Precio</th>
                  <th className="num">Duración</th>
                  <th className="num">Comisión</th>
                  <th className="num">Queda en caja</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {servicios.map((s) => (
                  <tr key={s.id} style={{ opacity: s.activo ? 1 : 0.55 }}>
                    <td className="strong">{s.nombre}</td>
                    <td className="muted">{s.categoria}</td>
                    <td className="num">{moneda.format(s.precio)}</td>
                    <td className="num muted">{s.duracion_min} min</td>
                    <td className="num muted">{s.comision_pct} %</td>
                    <td className="num">{moneda.format(Math.round(s.precio * (1 - s.comision_pct / 100)))}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => store.actualizarServicio(s.id, { activo: !s.activo })}
                        className={`badge ${s.activo ? "badge-ok" : "badge-neutral"}`}
                      >
                        {s.activo ? "Activo" : "En pausa"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ModulePanel>
    </PanelShell>
  );
}
