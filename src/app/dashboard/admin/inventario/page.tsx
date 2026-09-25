"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Boxes, Check, Minus, PackageSearch, Plus, Warehouse } from "lucide-react";
import { PanelShell } from "@/components/shell/PanelShell";
import {
  EmptyState,
  Metric,
  ModulePanel,
  ShareBar,
  SinAcceso,
  moneda,
  numero,
} from "@/components/panel/ModuleUI";
import { useBarberia, type Producto } from "@/lib/store";

const CATEGORIAS: Producto["categoria"][] = ["Cuidado", "Peinado", "Afeitado", "Consumible"];

/**
 * Inventario de producto y consumible. La alerta de reposición no es un
 * adorno: es lo que evita que un sábado se acabe el aceite de barba a media
 * jornada.
 */
export default function InventarioPage() {
  const store = useBarberia();
  const { listo, sesion, productos } = store;
  const [abierto, setAbierto] = useState(false);
  const [form, setForm] = useState({
    nombre: "",
    categoria: "Cuidado" as Producto["categoria"],
    existencias: 10,
    minimo: 5,
    costo: 100,
    precio_venta: 250,
    unidad: "pieza",
  });

  const resumen = useMemo(() => {
    const valorAlmacen = productos.reduce((a, p) => a + p.existencias * p.costo, 0);
    const bajos = productos.filter((p) => p.existencias <= p.minimo);
    const valorVenta = productos.reduce((a, p) => a + p.existencias * p.precio_venta, 0);
    return {
      referencias: productos.length,
      valorAlmacen,
      valorVenta,
      margen: valorVenta - valorAlmacen,
      bajos,
    };
  }, [productos]);

  if (!listo) return null;
  if (!sesion || sesion.rol !== "admin") return <SinAcceso mensaje="Este módulo es del administrador" />;

  function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nombre.trim()) return;
    store.agregarProducto({ ...form, nombre: form.nombre.trim() });
    setForm({ nombre: "", categoria: "Cuidado", existencias: 10, minimo: 5, costo: 100, precio_venta: 250, unidad: "pieza" });
    setAbierto(false);
  }

  return (
    <PanelShell sesion={sesion} activo="Inventario" onLogout={store.logout}>
      <header className="anim-in mb-6">
        <p className="kicker">Almacén</p>
        <h1 className="font-display text-2xl font-bold tracking-tight">Inventario</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
          Existencias de producto de reventa y de consumible, con aviso cuando algo baja del
          mínimo.
        </p>
      </header>

      <div className="metric-grid anim-in anim-d1">
        <Metric icono={<Boxes />} label="Referencias" valor={numero.format(resumen.referencias)} nota={`${resumen.bajos.length} bajo mínimo`} />
        <Metric icono={<Warehouse />} label="Valor del almacén" valor={moneda.format(resumen.valorAlmacen)} nota="A precio de costo" />
        <Metric icono={<PackageSearch />} label="Valor a la venta" valor={moneda.format(resumen.valorVenta)} nota="Si se vendiera todo" />
        <Metric icono={<Check />} label="Margen potencial" valor={moneda.format(resumen.margen)} nota="Venta menos costo" />
      </div>

      {resumen.bajos.length > 0 && (
        <p className="data-source-note mt-3" style={{ borderColor: "rgb(217 164 65 / 0.35)" }}>
          <AlertTriangle />
          <span>
            <b>Reposición pendiente.</b> {resumen.bajos.map((p) => p.nombre).join(", ")} —{" "}
            {resumen.bajos.length === 1 ? "está" : "están"} en o por debajo del mínimo definido.
          </span>
        </p>
      )}

      <ModulePanel
        titulo="Existencias"
        descripcion="Usa + y − para registrar entradas y salidas de almacén."
        extra={
          <button type="button" className="btn-gold px-3 py-2 text-xs" onClick={() => setAbierto((v) => !v)}>
            <Plus className="h-3.5 w-3.5" /> Nueva referencia
          </button>
        }
      >
        {abierto && (
          <form onSubmit={crear} className="mb-4 grid gap-2 rounded-2xl border p-3 sm:grid-cols-6" style={{ borderColor: "var(--line)" }}>
            <label className="sm:col-span-2 text-[0.68rem]" style={{ color: "var(--ink-muted)" }}>
              Producto
              <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required placeholder="Cera moldeadora" className="mt-1 w-full rounded-lg border px-2.5 py-2 text-sm" />
            </label>
            <label className="text-[0.68rem]" style={{ color: "var(--ink-muted)" }}>
              Categoría
              <select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value as Producto["categoria"] })} className="mt-1 w-full rounded-lg border px-2.5 py-2 text-sm">
                {CATEGORIAS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="text-[0.68rem]" style={{ color: "var(--ink-muted)" }}>
              Existencias
              <input type="number" min={0} value={form.existencias} onChange={(e) => setForm({ ...form, existencias: Number(e.target.value) })} className="mt-1 w-full rounded-lg border px-2.5 py-2 text-sm" />
            </label>
            <label className="text-[0.68rem]" style={{ color: "var(--ink-muted)" }}>
              Mínimo
              <input type="number" min={0} value={form.minimo} onChange={(e) => setForm({ ...form, minimo: Number(e.target.value) })} className="mt-1 w-full rounded-lg border px-2.5 py-2 text-sm" />
            </label>
            <label className="text-[0.68rem]" style={{ color: "var(--ink-muted)" }}>
              Costo
              <input type="number" min={0} value={form.costo} onChange={(e) => setForm({ ...form, costo: Number(e.target.value) })} className="mt-1 w-full rounded-lg border px-2.5 py-2 text-sm" />
            </label>
            <div className="sm:col-span-6 flex items-end justify-between gap-3">
              <label className="text-[0.68rem]" style={{ color: "var(--ink-muted)" }}>
                Precio de venta (0 si no se revende)
                <input type="number" min={0} value={form.precio_venta} onChange={(e) => setForm({ ...form, precio_venta: Number(e.target.value) })} className="mt-1 w-40 rounded-lg border px-2.5 py-2 text-sm" />
              </label>
              <button type="submit" className="btn-gold px-4 py-2 text-xs">
                <Check className="h-3.5 w-3.5" /> Guardar
              </button>
            </div>
          </form>
        )}

        {productos.length === 0 ? (
          <EmptyState icono={<Boxes />}>El almacén está vacío.</EmptyState>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Nivel</th>
                  <th className="num">Existencias</th>
                  <th className="num">Mínimo</th>
                  <th className="num">Costo</th>
                  <th className="num">Venta</th>
                  <th className="num">Movimiento</th>
                </tr>
              </thead>
              <tbody>
                {productos.map((p) => {
                  const bajo = p.existencias <= p.minimo;
                  const nivel = p.minimo > 0 ? p.existencias / (p.minimo * 3) : 1;
                  return (
                    <tr key={p.id}>
                      <td className="strong">
                        {p.nombre}
                        <span className="block text-[0.62rem]" style={{ color: "var(--ink-faint)" }}>
                          {p.categoria} · {p.unidad}
                        </span>
                      </td>
                      <td style={{ minWidth: "6rem" }}>
                        <ShareBar valor={Math.min(1, nivel)} tono={bajo ? "ox" : "ok"} />
                      </td>
                      <td className="num">
                        {numero.format(p.existencias)}
                        {bajo && <span className="badge badge-warm ml-1.5">bajo</span>}
                      </td>
                      <td className="num muted">{numero.format(p.minimo)}</td>
                      <td className="num muted">{moneda.format(p.costo)}</td>
                      <td className="num">{p.precio_venta > 0 ? moneda.format(p.precio_venta) : "—"}</td>
                      <td className="num">
                        <span className="inline-flex gap-1">
                          <button
                            type="button"
                            aria-label={`Restar una unidad de ${p.nombre}`}
                            onClick={() => store.ajustarExistencias(p.id, -1)}
                            className="grid h-7 w-7 place-items-center rounded-lg border"
                            style={{ borderColor: "var(--line)" }}
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Sumar una unidad de ${p.nombre}`}
                            onClick={() => store.ajustarExistencias(p.id, 1)}
                            className="grid h-7 w-7 place-items-center rounded-lg border"
                            style={{ borderColor: "var(--line)" }}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </ModulePanel>
    </PanelShell>
  );
}
