"use client";

import { Plus, X } from "lucide-react";
import { precioDe, type Barbero, type Servicio } from "@/lib/store";

const mxn = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

/** Total y duración de varios servicios con los precios de un barbero. */
export function totalServicios(ids: string[], servicios: Servicio[], barbero?: Barbero | null) {
  const lista = ids.map((id) => servicios.find((x) => x.id === id)).filter((x): x is Servicio => Boolean(x));
  return {
    lista,
    precio: lista.reduce((a, sv) => a + precioDe(sv, barbero), 0),
    duracion: lista.reduce((a, sv) => a + sv.duracion_min, 0),
  };
}

/**
 * Lista de servicios de una cita: el primero se elige como siempre y con
 * «Agregar otro servicio» se suman más (corte + barba + facial…). Precio y
 * duración se suman solos.
 */
export function SelectorServicios({
  ids,
  onChange,
  catalogo,
  servicios,
  barbero,
}: {
  ids: string[];
  onChange: (ids: string[]) => void;
  /** Lo que se puede elegir (activos, más los que ya tenía la cita) */
  catalogo: Servicio[];
  servicios: Servicio[];
  barbero?: Barbero | null;
}) {
  const { lista, precio, duracion } = totalServicios(ids, servicios, barbero);
  const disponibles = catalogo.filter((x) => !ids.includes(x.id));

  if (catalogo.length === 0) {
    return <p className="campo-ayuda">Da de alta servicios en «Servicios» para fijar precios.</p>;
  }

  return (
    <div className="sel-servicios">
      {lista.length > 0 && (
        <ul className="sel-servicios-lista">
          {lista.map((sv, i) => (
            <li key={sv.id}>
              <span className="sel-servicios-n">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <b className="block truncate">{sv.nombre}</b>
                <small>
                  {sv.categoria} · {sv.duracion_min} min
                  {precioDe(sv, barbero) !== sv.precio ? ` · lista ${mxn.format(sv.precio)}` : ""}
                </small>
              </span>
              <strong>{mxn.format(precioDe(sv, barbero))}</strong>
              <button
                type="button"
                className="sel-servicios-quitar"
                aria-label={`Quitar ${sv.nombre}`}
                onClick={() => onChange(ids.filter((x) => x !== sv.id))}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {disponibles.length > 0 && (
        <label className="sel-servicios-agregar">
          <Plus className="h-4 w-4" aria-hidden />
          <select
            className="campo-input"
            value=""
            aria-label={lista.length === 0 ? "Elige el servicio" : "Agregar otro servicio"}
            onChange={(e) => e.target.value && onChange([...ids, e.target.value])}
          >
            <option value="">{lista.length === 0 ? "Elige el servicio" : "Agregar otro servicio…"}</option>
            {disponibles.map((x) => (
              <option key={x.id} value={x.id}>
                {x.categoria === "Paquete" ? "📦 " : ""}
                {x.nombre} — {mxn.format(precioDe(x, barbero))} · {x.duracion_min} min
              </option>
            ))}
          </select>
        </label>
      )}
      {lista.length > 1 && (
        <p className="sel-servicios-total">
          {lista.length} servicios · {duracion} min · <b>{mxn.format(precio)}</b>
        </p>
      )}
    </div>
  );
}
