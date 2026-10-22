"use client";

import { Banknote, CreditCard } from "lucide-react";
import type { MetodoPago } from "@/lib/store";

const mxn = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

/** Cobro de una cita: se elige si pagó en efectivo o con tarjeta. */
export function BotonesCobro({
  precio,
  onCobrar,
  compacto = false,
}: {
  precio: number;
  onCobrar: (metodo: MetodoPago) => void;
  compacto?: boolean;
}) {
  return (
    <div className={`cobro-metodos ${compacto ? "is-compacto" : ""}`} role="group" aria-label={`Cobrar ${mxn.format(precio)}`}>
      {!compacto && <span className="cobro-metodos-label">¿Cómo pagó {mxn.format(precio)}?</span>}
      <button type="button" className="cobro-metodo" onClick={() => onCobrar("efectivo")}>
        <Banknote className="h-4 w-4" /> Efectivo
      </button>
      <button type="button" className="cobro-metodo" onClick={() => onCobrar("tarjeta")}>
        <CreditCard className="h-4 w-4" /> Tarjeta
      </button>
    </div>
  );
}
