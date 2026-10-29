"use client";

import { useState } from "react";
import { ArrowLeftRight, Banknote, CreditCard, HandCoins, X } from "lucide-react";
import type { MetodoPago } from "@/lib/store";

const mxn = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

const RAPIDOS = { pct: [0, 10, 15, 20], monto: [0, 20, 50, 100] } as const;

/** Propina en pesos según el modo: porcentaje del servicio o monto exacto. */
export function calcularPropina(precio: number, modo: "pct" | "monto", valor: number) {
  if (!Number.isFinite(valor) || valor <= 0) return 0;
  return Math.round(modo === "pct" ? (precio * Math.min(100, valor)) / 100 : valor);
}

/**
 * Cobro de una cita: propina opcional (exacta o en porcentaje) y método de
 * pago. En las listas (compacto) primero se ve un botón «Cobrar» y al
 * tocarlo se despliega el panel.
 */
export function BotonesCobro({
  precio,
  onCobrar,
  compacto = false,
}: {
  precio: number;
  onCobrar: (metodo: MetodoPago, propina: number) => void;
  compacto?: boolean;
}) {
  const [abierto, setAbierto] = useState(!compacto);
  const [modo, setModo] = useState<"pct" | "monto">("pct");
  const [valor, setValor] = useState(0);
  const propina = calcularPropina(precio, modo, valor);

  if (!abierto) {
    return (
      <button type="button" className="cobro-metodo" onClick={() => setAbierto(true)}>
        <Banknote className="h-4 w-4" /> Cobrar {mxn.format(precio)}
      </button>
    );
  }

  const cobrar = (metodo: MetodoPago) => {
    onCobrar(metodo, propina);
    setValor(0);
    if (compacto) setAbierto(false);
  };

  return (
    <div className={`cobro-panel ${compacto ? "is-compacto" : ""}`} role="group" aria-label={`Cobrar ${mxn.format(precio)}`}>
      <div className="cobro-panel-cabeza">
        <span>
          <small>Servicio</small>
          <b>{mxn.format(precio)}</b>
        </span>
        {propina > 0 && (
          <span>
            <small>Propina</small>
            <b>+{mxn.format(propina)}</b>
          </span>
        )}
        <span className="is-total">
          <small>Total a cobrar</small>
          <b>{mxn.format(precio + propina)}</b>
        </span>
        {compacto && (
          <button type="button" className="cobro-cerrar" aria-label="Cerrar cobro" onClick={() => setAbierto(false)}>
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

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
        <span className="cobro-metodos-label">¿Cómo pagó {mxn.format(precio + propina)}?</span>
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
