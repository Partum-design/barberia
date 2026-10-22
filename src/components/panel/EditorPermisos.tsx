"use client";

import { useState } from "react";
import { Check, RotateCcw } from "lucide-react";
import {
  ETIQUETAS_PERMISOS,
  PERMISOS_POR_DEFECTO,
  permisosDe,
  useBarberia,
  type Barbero,
  type PermisosBarbero,
} from "@/lib/store";
import "@/components/app/app.css";

/** Lo que un miembro del equipo puede hacer en su panel. */
export function EditorPermisos({
  barbero,
  onListo,
  onCancelar,
}: {
  barbero: Barbero;
  onListo: (mensaje: string) => void;
  onCancelar: () => void;
}) {
  const store = useBarberia();
  const [permisos, setPermisos] = useState<PermisosBarbero>(permisosDe(barbero));
  const grupos = [...new Set(ETIQUETAS_PERMISOS.map((p) => p.grupo))];

  function guardar() {
    if (store.actualizarBarbero(barbero.id, { permisos })) {
      onListo(`Permisos de ${barbero.nombre} guardados.`);
    }
  }

  return (
    <div>
      {grupos.map((grupo) => (
        <section key={grupo} className="permisos-grupo">
          <h3>{grupo}</h3>
          {ETIQUETAS_PERMISOS.filter((p) => p.grupo === grupo).map((p) => (
            <button
              key={p.id}
              type="button"
              role="switch"
              aria-checked={permisos[p.id]}
              className="permiso-fila"
              onClick={() => setPermisos((x) => ({ ...x, [p.id]: !x[p.id] }))}
            >
              <span className="min-w-0 flex-1">
                <b>{p.label}</b>
                <small>{p.ayuda}</small>
              </span>
              <span className="permiso-switch" aria-hidden />
            </button>
          ))}
        </section>
      ))}

      <div className="form-acciones mt-5">
        <button type="button" className="btn-linea mr-auto" onClick={() => setPermisos(PERMISOS_POR_DEFECTO)}>
          <RotateCcw className="h-4 w-4" /> Valores por defecto
        </button>
        <button type="button" className="btn-linea" onClick={onCancelar}>
          Cancelar
        </button>
        <button type="button" className="btn-gold px-5 py-2.5 text-sm" onClick={guardar}>
          <Check className="h-4 w-4" /> Guardar permisos
        </button>
      </div>
    </div>
  );
}
