"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, CheckCircle2, Clock3, Pause, Pencil, Percent, Play, Plus, Tags, Trash2, Wallet } from "lucide-react";
import { PanelShell } from "@/components/shell/PanelShell";
import { EmptyState, Metric, ModulePanel, SinAcceso, moneda, numero } from "@/components/panel/ModuleUI";
import { Campo, Modal } from "@/components/panel/Modal";
import { useBarberia, type Servicio } from "@/lib/store";

const CATEGORIAS: Servicio["categoria"][] = ["Corte", "Barba", "Color", "Ritual", "Paquete"];
const VACIO = { nombre: "", categoria: "Corte" as Servicio["categoria"], precio: "250", duracion_min: "30", comision_pct: "45" };

/**
 * Catálogo de servicios. Aquí vive el precio: la reserva y el mostrador lo
 * toman del servicio elegido, no del barbero. La comisión sólo la ve el
 * administrador.
 */
export default function ServiciosPage() {
  const store = useBarberia();
  const { listo, sesion, servicios, citas } = store;
  const [editando, setEditando] = useState<{ servicio?: Servicio } | null>(null);
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    if (!aviso) return;
    const t = window.setTimeout(() => setAviso(""), 4000);
    return () => window.clearTimeout(t);
  }, [aviso]);

  const activos = useMemo(() => servicios.filter((s) => s.activo), [servicios]);
  const resumen = useMemo(() => {
    if (activos.length === 0) return { precioMedio: 0, duracionMedia: 0, comisionMedia: 0 };
    return {
      precioMedio: Math.round(activos.reduce((a, s) => a + s.precio, 0) / activos.length),
      duracionMedia: Math.round(activos.reduce((a, s) => a + s.duracion_min, 0) / activos.length),
      comisionMedia: Math.round(activos.reduce((a, s) => a + s.comision_pct, 0) / activos.length),
    };
  }, [activos]);

  // Lo que ha vendido cada servicio (citas con llegada confirmada).
  const ventas = useMemo(() => {
    const m = new Map<string, { veces: number; ingresos: number }>();
    for (const c of citas) {
      if (c.estado !== "asistida" || !c.servicio_id) continue;
      const v = m.get(c.servicio_id) ?? { veces: 0, ingresos: 0 };
      v.veces += 1;
      v.ingresos += c.precio;
      m.set(c.servicio_id, v);
    }
    return m;
  }, [citas]);

  if (!listo) return null;
  if (!sesion || sesion.rol !== "admin") return <SinAcceso mensaje="Este módulo es del administrador" />;

  function eliminar(s: Servicio) {
    const v = ventas.get(s.id);
    if (
      !window.confirm(
        `¿Eliminar «${s.nombre}»?${v ? `\n\nTiene ${v.veces} venta(s); se conservan en caja y reportes.` : ""}\n\nSi sólo quieres dejar de ofrecerlo, mejor ponlo en pausa.`
      )
    )
      return;
    if (store.eliminarServicio(s.id)) setAviso(`«${s.nombre}» eliminado del catálogo.`);
  }

  return (
    <PanelShell sesion={sesion} activo="Servicios" onLogout={store.logout}>
      <header className="anim-in mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker">Catálogo y precios</p>
          <h1 className="font-display text-2xl font-bold tracking-tight">Servicios</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
            El precio y la duración de cada cita salen de aquí. La comisión del barbero sólo la ves tú.
          </p>
        </div>
        <button type="button" className="btn-gold px-5 py-2.5 text-sm" onClick={() => setEditando({})}>
          <Plus className="h-4 w-4" /> Nuevo servicio
        </button>
      </header>

      {aviso && (
        <p className="aviso-ok anim-pop mb-4" role="status">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> {aviso}
        </p>
      )}

      <div className="metric-grid anim-in anim-d1">
        <Metric icono={<Tags />} label="Servicios activos" valor={numero.format(activos.length)} nota={`${servicios.length - activos.length} en pausa`} />
        <Metric icono={<Wallet />} label="Precio medio" valor={moneda.format(resumen.precioMedio)} nota="De los servicios activos" />
        <Metric icono={<Clock3 />} label="Duración media" valor={`${resumen.duracionMedia} min`} nota="Tiempo en el sillón" />
        <Metric icono={<Percent />} label="Comisión media" valor={`${resumen.comisionMedia} %`} nota="Parte del barbero · sólo admin" />
      </div>

      <ModulePanel titulo="Catálogo" descripcion={`${servicios.length} servicio${servicios.length === 1 ? "" : "s"}`}>
        {servicios.length === 0 ? (
          <EmptyState icono={<Tags />}>
            Todavía no hay servicios. Sin servicios las citas no llevan precio.{" "}
            <button type="button" className="underline underline-offset-4" onClick={() => setEditando({})}>
              Agregar el primero
            </button>
          </EmptyState>
        ) : (
          <div className="grid gap-2">
            {servicios.map((s) => {
              const v = ventas.get(s.id);
              const caja = Math.round(s.precio * (1 - s.comision_pct / 100));
              return (
                <article key={s.id} className={`fila-servicio ${s.activo ? "" : "is-paused"}`}>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-semibold" style={{ color: "var(--ink)" }}>{s.nombre}</span>
                      <span className="badge badge-neutral">{s.categoria}</span>
                      {!s.activo && <span className="badge badge-warm">En pausa</span>}
                    </p>
                    <p className="mt-1 text-xs" style={{ color: "var(--ink-muted)" }}>
                      {s.duracion_min} min · comisión {s.comision_pct}% ({moneda.format(s.precio - caja)}) · queda en caja{" "}
                      {moneda.format(caja)}
                      {v ? ` · vendido ${v.veces} ${v.veces === 1 ? "vez" : "veces"} (${moneda.format(v.ingresos)})` : ""}
                    </p>
                  </div>
                  <strong className="fila-servicio-precio">{moneda.format(s.precio)}</strong>
                  <div className="flex gap-1.5">
                    <button type="button" className="btn-icono" title="Editar" aria-label={`Editar ${s.nombre}`} onClick={() => setEditando({ servicio: s })}>
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="btn-icono"
                      title={s.activo ? "Pausar" : "Activar"}
                      aria-label={s.activo ? `Pausar ${s.nombre}` : `Activar ${s.nombre}`}
                      onClick={() => store.actualizarServicio(s.id, { activo: !s.activo })}
                    >
                      {s.activo ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </button>
                    <button type="button" className="btn-icono is-danger" title="Eliminar" aria-label={`Eliminar ${s.nombre}`} onClick={() => eliminar(s)}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </ModulePanel>

      {editando && (
        <Modal
          titulo={editando.servicio ? "Editar servicio" : "Nuevo servicio"}
          descripcion="Los cambios aplican a las citas nuevas; las ya agendadas conservan su precio."
          onCerrar={() => setEditando(null)}
        >
          <FormularioServicio
            servicio={editando.servicio}
            onCancelar={() => setEditando(null)}
            onListo={(m) => {
              setEditando(null);
              setAviso(m);
            }}
          />
        </Modal>
      )}
    </PanelShell>
  );
}

function FormularioServicio({
  servicio,
  onListo,
  onCancelar,
}: {
  servicio?: Servicio;
  onListo: (mensaje: string) => void;
  onCancelar: () => void;
}) {
  const store = useBarberia();
  const [f, setF] = useState(
    servicio
      ? {
          nombre: servicio.nombre,
          categoria: servicio.categoria,
          precio: String(servicio.precio),
          duracion_min: String(servicio.duracion_min),
          comision_pct: String(servicio.comision_pct),
        }
      : VACIO
  );
  const [error, setError] = useState("");
  const precio = Number(f.precio);
  const comision = Number(f.comision_pct);
  const valido = Number.isFinite(precio) && Number.isFinite(comision);

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const datos = {
      nombre: f.nombre.trim(),
      categoria: f.categoria,
      precio: Math.round(Number(f.precio)),
      duracion_min: Math.round(Number(f.duracion_min)),
      comision_pct: Math.round(Number(f.comision_pct)),
    };
    if (datos.nombre.length < 2) return setError("Escribe el nombre del servicio.");
    if (!Number.isFinite(datos.precio) || datos.precio < 0) return setError("El precio no es válido.");
    if (!Number.isFinite(datos.duracion_min) || datos.duracion_min < 5) return setError("La duración mínima es 5 minutos.");
    if (!Number.isFinite(datos.comision_pct) || datos.comision_pct < 0 || datos.comision_pct > 100) {
      return setError("La comisión va de 0 a 100 %.");
    }
    if (servicio) {
      if (store.actualizarServicio(servicio.id, datos)) onListo(`«${datos.nombre}» actualizado.`);
    } else if (store.agregarServicio(datos)) {
      onListo(`«${datos.nombre}» agregado al catálogo.`);
    }
  }

  return (
    <form onSubmit={guardar} className="form-grid">
      <Campo label="Nombre" ancho="completo">
        <input className="campo-input" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} placeholder="Corte y barba" required />
      </Campo>
      <Campo label="Categoría">
        <select className="campo-input" value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value as Servicio["categoria"] })}>
          {CATEGORIAS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </Campo>
      <Campo label="Precio (MXN)">
        <input className="campo-input" type="number" inputMode="numeric" min={0} value={f.precio} onChange={(e) => setF({ ...f, precio: e.target.value })} />
      </Campo>
      <Campo label="Duración (min)">
        <input className="campo-input" type="number" inputMode="numeric" min={5} step={5} value={f.duracion_min} onChange={(e) => setF({ ...f, duracion_min: e.target.value })} />
      </Campo>
      <Campo label="Comisión del barbero (%)" ayuda="Sólo la ve el administrador.">
        <input className="campo-input" type="number" inputMode="numeric" min={0} max={100} value={f.comision_pct} onChange={(e) => setF({ ...f, comision_pct: e.target.value })} />
      </Campo>
      {valido && (
        <div className="reparto is-full" aria-label="Reparto del precio">
          <div>
            <small>Cliente paga</small>
            <b>{moneda.format(precio)}</b>
          </div>
          <div>
            <small>Barbero</small>
            <b>{moneda.format(Math.round((precio * comision) / 100))}</b>
          </div>
          <div>
            <small>Queda en caja</small>
            <b>{moneda.format(Math.round(precio * (1 - comision / 100)))}</b>
          </div>
        </div>
      )}
      {error && <p className="form-error is-full" role="alert">{error}</p>}
      <div className="form-acciones is-full">
        <button type="button" className="btn-linea" onClick={onCancelar}>
          Cancelar
        </button>
        <button type="submit" className="btn-gold px-5 py-2.5 text-sm">
          <Check className="h-4 w-4" /> {servicio ? "Guardar cambios" : "Agregar servicio"}
        </button>
      </div>
    </form>
  );
}
