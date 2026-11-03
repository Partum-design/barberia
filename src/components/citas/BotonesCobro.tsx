"use client";

import { useState } from "react";
import { ArrowLeftRight, Banknote, CreditCard, HandCoins, Minus, Package, Plus, X } from "lucide-react";
import { useBarberia, type MetodoPago, type ProductoEnCobro } from "@/lib/store";

const mxn = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

const RAPIDOS = { pct: [0, 10, 15, 20], monto: [0, 20, 50, 100] } as const;

/** Propina en pesos según el modo: porcentaje del servicio o monto exacto. */
export function calcularPropina(precio: number, modo: "pct" | "monto", valor: number) {
  if (!Number.isFinite(valor) || valor <= 0) return 0;
  return Math.round(modo === "pct" ? (precio * Math.min(100, valor)) / 100 : valor);
}

/**
 * Cobro de una cita: productos que se lleva (salen del almacén), propina
 * opcional (exacta o en porcentaje) y método de pago. En las listas (compacto) primero se ve un botón «Cobrar» y al
 * tocarlo se despliega el panel.
 */
export function BotonesCobro({
  precio,
  onCobrar,
  compacto = false,
}: {
  precio: number;
  onCobrar: (metodo: MetodoPago, propina: number, productos: ProductoEnCobro[], totalProductos: number) => void;
  compacto?: boolean;
}) {
  const { productos: inventario } = useBarberia();
  const [abierto, setAbierto] = useState(!compacto);
  const [modo, setModo] = useState<"pct" | "monto">("pct");
  const [valor, setValor] = useState(0);
  // Productos que se lleva: id del producto → piezas
  const [llevados, setLlevados] = useState<Record<string, number>>({});
  const propina = calcularPropina(precio, modo, valor);

  const vendibles = inventario.filter((p) => p.precio_venta > 0 && p.existencias > 0);
  const lineas = Object.entries(llevados)
    .map(([id, cantidad]) => ({ producto: inventario.find((p) => p.id === id), cantidad }))
    .filter((x): x is { producto: (typeof inventario)[number]; cantidad: number } => Boolean(x.producto) && x.cantidad > 0);
  const totalProductos = lineas.reduce((a, x) => a + x.producto.precio_venta * x.cantidad, 0);
  const total = precio + totalProductos + propina;

  const cambiarCantidad = (id: string, delta: number) =>
    setLlevados((prev) => {
      const max = inventario.find((p) => p.id === id)?.existencias ?? 0;
      const n = Math.min(max, Math.max(0, (prev[id] ?? 0) + delta));
      const sig = { ...prev };
      if (n > 0) sig[id] = n;
      else delete sig[id];
      return sig;
    });

  if (!abierto) {
    return (
      <button type="button" className="cobro-metodo" onClick={() => setAbierto(true)}>
        <Banknote className="h-4 w-4" /> Cobrar {mxn.format(precio)}
      </button>
    );
  }

  const cobrar = (metodo: MetodoPago) => {
    const items: ProductoEnCobro[] = lineas.map((x) => ({
      id: `vta-${crypto.randomUUID().slice(0, 8)}`,
      producto_id: x.producto.id,
      cantidad: x.cantidad,
    }));
    onCobrar(metodo, propina, items, totalProductos);
    setValor(0);
    setLlevados({});
    if (compacto) setAbierto(false);
  };

  return (
    <div className={`cobro-panel ${compacto ? "is-compacto" : ""}`} role="group" aria-label={`Cobrar ${mxn.format(precio)}`}>
      <div className="cobro-panel-cabeza">
        <span>
          <small>Servicio</small>
          <b>{mxn.format(precio)}</b>
        </span>
        {totalProductos > 0 && (
          <span>
            <small>Productos</small>
            <b>+{mxn.format(totalProductos)}</b>
          </span>
        )}
        {propina > 0 && (
          <span>
            <small>Propina</small>
            <b>+{mxn.format(propina)}</b>
          </span>
        )}
        <span className="is-total">
          <small>Total a cobrar</small>
          <b>{mxn.format(total)}</b>
        </span>
        {compacto && (
          <button type="button" className="cobro-cerrar" aria-label="Cerrar cobro" onClick={() => setAbierto(false)}>
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {(vendibles.length > 0 || lineas.length > 0) && (
        <fieldset className="cobro-productos">
          <legend>
            <Package className="h-3.5 w-3.5" /> ¿Se llevó algún producto?
          </legend>
          {lineas.length > 0 && (
            <ul>
              {lineas.map(({ producto, cantidad }) => (
                <li key={producto.id}>
                  <span className="min-w-0 flex-1">
                    <b className="block truncate">{producto.nombre}</b>
                    <small>
                      {mxn.format(producto.precio_venta)} c/u · quedan {producto.existencias}
                    </small>
                  </span>
                  <span className="cobro-cantidad">
                    <button type="button" aria-label={`Una pieza menos de ${producto.nombre}`} onClick={() => cambiarCantidad(producto.id, -1)}>
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <b aria-live="polite">{cantidad}</b>
                    <button
                      type="button"
                      aria-label={`Una pieza más de ${producto.nombre}`}
                      disabled={cantidad >= producto.existencias}
                      onClick={() => cambiarCantidad(producto.id, 1)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </span>
                  <strong>{mxn.format(producto.precio_venta * cantidad)}</strong>
                </li>
              ))}
            </ul>
          )}
          {vendibles.some((p) => !llevados[p.id]) && (
            <label className="cobro-agregar">
              <Plus className="h-4 w-4" aria-hidden />
              <select
                value=""
                aria-label="Agregar producto"
                onChange={(e) => e.target.value && cambiarCantidad(e.target.value, 1)}
              >
                <option value="">{lineas.length === 0 ? "Agregar producto…" : "Agregar otro producto…"}</option>
                {vendibles
                  .filter((p) => !llevados[p.id])
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} — {mxn.format(p.precio_venta)}
                    </option>
                  ))}
              </select>
            </label>
          )}
        </fieldset>
      )}

      <fieldset className="cobro-propina">
        <legend>
          <HandCoins className="h-3.5 w-3.5" /> ¿Dejó propina?
        </legend>
        <div className="cobro-modo" role="radiogroup" aria-label="Tipo de propina">
          <button type="button" role="radio" aria-checked={modo === "pct"} className={modo === "pct" ? "is-on" : ""} onClick={() => { setModo("pct"); setValor(0); }}>
            %
          </button>
          <button type="button" role="radio" aria-checked={modo === "monto"} className={modo === "monto" ? "is-on" : ""} onClick={() => { setModo("monto"); setValor(0); }}>
            $
          </button>
        </div>
        <div className="cobro-rapidos">
          {RAPIDOS[modo].map((n) => (
            <button key={n} type="button" className={valor === n ? "is-on" : ""} onClick={() => setValor(n)}>
              {n === 0 ? "Sin propina" : modo === "pct" ? `${n}%` : mxn.format(n)}
            </button>
          ))}
          <label className="cobro-otro">
            <span className="sr-only">{modo === "pct" ? "Porcentaje de propina" : "Propina exacta en pesos"}</span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              max={modo === "pct" ? 100 : 100000}
              placeholder={modo === "pct" ? "Otro %" : "Otro $"}
              value={(RAPIDOS[modo] as readonly number[]).includes(valor) ? "" : valor || ""}
              onChange={(e) => setValor(Math.max(0, Number(e.target.value) || 0))}
            />
          </label>
        </div>
      </fieldset>

      <div className="cobro-metodos">
        <span className="cobro-metodos-label">¿Cómo pagó {mxn.format(total)}?</span>
        <button type="button" className="cobro-metodo" onClick={() => cobrar("efectivo")}>
          <Banknote className="h-4 w-4" /> Efectivo
        </button>
        <button type="button" className="cobro-metodo" onClick={() => cobrar("tarjeta")}>
          <CreditCard className="h-4 w-4" /> Tarjeta
        </button>
        <button type="button" className="cobro-metodo" onClick={() => cobrar("transferencia")}>
          <ArrowLeftRight className="h-4 w-4" /> Transferencia
        </button>
      </div>
    </div>
  );
}

export const ETIQUETA_METODO: Record<MetodoPago, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
};
