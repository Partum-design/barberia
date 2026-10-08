"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Clock3 } from "lucide-react";
import { Campo, Interruptor } from "@/components/panel/Modal";
import { useBarberia, type Barbero } from "@/lib/store";

const DURACIONES = [15, 20, 30, 40, 45, 60, 75, 90, 120];

/** Configuración de un barbero: perfil público, precio, duración y disponibilidad. */
export function EditorBarbero({
  barbero,
  onListo,
  onCancelar,
}: {
  barbero: Barbero;
  onListo: (mensaje: string) => void;
  onCancelar: () => void;
}) {
  const store = useBarberia();
  const [form, setForm] = useState({
    nombre: barbero.nombre,
    especialidad: barbero.especialidad,
    precio_servicio: String(barbero.precio_servicio),
    duracion_cita_min: barbero.duracion_cita_min,
    acepta_domicilio: barbero.acepta_domicilio,
    biografia: barbero.biografia,
    activo: barbero.activo,
  });
  const [error, setError] = useState("");
  const duraciones = DURACIONES.includes(barbero.duracion_cita_min)
    ? DURACIONES
    : [...DURACIONES, barbero.duracion_cita_min].sort((a, b) => a - b);

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const precio = Number(form.precio_servicio);
    if (form.nombre.trim().length < 2) return setError("Escribe el nombre.");
    if (!form.especialidad.trim()) return setError("Escribe su especialidad.");
    if (!Number.isFinite(precio) || precio < 0) return setError("El precio no es válido.");

    const nuevo = {
      nombre: form.nombre.trim(),
      especialidad: form.especialidad.trim(),
      precio_servicio: Math.round(precio),
      duracion_cita_min: form.duracion_cita_min,
      acepta_domicilio: form.acepta_domicilio,
      biografia: form.biografia.trim(),
      activo: form.activo,
    };
    // Sólo se envía lo que cambió.
    const cambios = Object.fromEntries(
      Object.entries(nuevo).filter(([k, v]) => barbero[k as keyof Barbero] !== v)
    ) as Partial<Barbero>;
    if (Object.keys(cambios).length === 0) return onCancelar();
    if (store.actualizarBarbero(barbero.id, cambios)) onListo(`Configuración de ${nuevo.nombre} guardada.`);
  }

  return (
    <form onSubmit={guardar} className="form-grid">
      <Campo label="Nombre">
        <input className="campo-input" value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} required />
      </Campo>
      <Campo label="Especialidad" ayuda="Se muestra en la portada y al reservar.">
        <input
          className="campo-input"
          value={form.especialidad}
          onChange={(e) => setForm((f) => ({ ...f, especialidad: e.target.value }))}
          placeholder="Fades y diseño de barba"
          required
        />
      </Campo>
      <Campo label="Precio del servicio (MXN)" ayuda="Las citas nuevas toman este precio.">
        <input
          className="campo-input"
          type="number"
          inputMode="numeric"
          min={0}
          value={form.precio_servicio}
          onChange={(e) => setForm((f) => ({ ...f, precio_servicio: e.target.value }))}
        />
      </Campo>
      <Campo label="Duración de cada cita" ayuda="Define cada cuánto se ofrecen horarios.">
        <select
          className="campo-input"
          value={form.duracion_cita_min}
          onChange={(e) => setForm((f) => ({ ...f, duracion_cita_min: Number(e.target.value) }))}
        >
          {duraciones.map((d) => (
            <option key={d} value={d}>
              {d} minutos
            </option>
          ))}
        </select>
      </Campo>
      <Campo label="Biografía (opcional)" ancho="completo">
        <textarea
          className="campo-input"
          rows={3}
          value={form.biografia}
          onChange={(e) => setForm((f) => ({ ...f, biografia: e.target.value }))}
          placeholder="Años de experiencia, estilo, lo que lo distingue…"
        />
      </Campo>
      <div className="is-full grid gap-2">
        <Interruptor
          activo={form.acepta_domicilio}
          onChange={(v) => setForm((f) => ({ ...f, acepta_domicilio: v }))}
          label="Ofrece servicio a domicilio"
          ayuda="El cliente podrá elegir domicilio al reservar con él."
        />
        <Interruptor
          activo={form.activo}
          onChange={(v) => setForm((f) => ({ ...f, activo: v }))}
          label="Disponible para reservas"
          ayuda="Si lo desactivas deja de aparecer en la portada y al reservar. Sus citas se conservan."
        />
      </div>
      <Link href="/dashboard/admin/disponibilidad" className="form-nota is-full hover:underline">
        <Clock3 className="h-4 w-4 shrink-0" /> Sus días y horas de trabajo se ajustan en Disponibilidad →
      </Link>
      {error && <p className="form-error is-full" role="alert">{error}</p>}
      <div className="form-acciones is-full">
        <button type="button" className="btn-linea" onClick={onCancelar}>
          Cancelar
        </button>
        <button type="submit" className="btn-gold px-5 py-2.5 text-sm">
          <Check className="h-4 w-4" /> Guardar configuración
        </button>
      </div>
    </form>
  );
}
