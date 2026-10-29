"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgeDollarSign, Check, CheckCircle2, Clock3, ListPlus, Package, Pause, Pencil, Percent, Play, Plus, Tags, Trash2, Wallet } from "lucide-react";
import { PanelShell } from "@/components/shell/PanelShell";
import { EmptyState, Metric, ModulePanel, SinAcceso, moneda, numero } from "@/components/panel/ModuleUI";
import { Campo, Modal } from "@/components/panel/Modal";
import { EditorPrecios } from "@/components/panel/EditorPrecios";
import { CATEGORIAS_SERVICIO, precioDe, serviciosDeCita, useBarberia, type Servicio } from "@/lib/store";
import { PERFIL } from "@/lib/negocio/perfil";

const VACIO = {
  nombre: "",
  categoria: "Corte" as Servicio["categoria"],
  descripcion: "",
  desde: false,
  precio: "250",
  duracion_min: "30",
  comision_pct: "45",
  incluye: [] as string[],
};

/**
 * Catálogo de servicios. Aquí vive el precio de lista; cada barbero puede
 * tener un precio especial por servicio («Precios por barbero»). La comisión
 * sólo la ve el administrador.
 */
export default function ServiciosPage() {
  const store = useBarberia();
  const { listo, sesion, servicios, citas, barberos } = store;
  const [editando, setEditando] = useState<{ servicio?: Servicio; paquete?: boolean } | null>(null);
  const [precios, setPrecios] = useState(false);
  const [aviso, setAviso] = useState("");
  const [filtro, setFiltro] = useState<string>("Todos");

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
      const ids = serviciosDeCita(c);
      if (c.estado !== "asistida" || ids.length === 0) continue;
      // Con varios servicios, el cobro se reparte según el precio de lista de cada uno.
      const listas = ids.map((id) => servicios.find((x) => x.id === id)?.precio ?? 0);
      const totalLista = listas.reduce((a, n) => a + n, 0);
      ids.forEach((id, i) => {
        const v = m.get(id) ?? { veces: 0, ingresos: 0 };
        v.veces += 1;
        v.ingresos += totalLista > 0 ? Math.round((c.precio * listas[i]) / totalLista) : Math.round(c.precio / ids.length);
        m.set(id, v);
      });
    }
    return m;
  }, [citas, servicios]);

  if (!listo) return null;
  if (!sesion || sesion.rol !== "admin") return <SinAcceso mensaje="Este módulo es del administrador" />;

  const categorias = ["Todos", ...CATEGORIAS_SERVICIO.filter((c) => servicios.some((s) => s.categoria === c))];
  const visibles = filtro === "Todos" ? servicios : servicios.filter((s) => s.categoria === filtro);

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

  // Servicios del menú impreso que todavía no están en el catálogo.
  const faltantes = PERFIL.menu.filter(
    (m) => !servicios.some((s) => s.nombre.trim().toLowerCase() === m.nombre.toLowerCase())
  );

  async function cargarMenu() {
    const r = await store.agregarServicios(
      faltantes.map((m) => ({
        ...m,
        id: `srv-${crypto.randomUUID().slice(0, 8)}`,
        comision_pct: Number(VACIO.comision_pct),
        activo: true,
      }))
    );
    if (!r.ok) window.alert(r.error);
    else setAviso(`Se agregaron ${faltantes.length} servicios del menú.`);
  }

  return (
    <PanelShell sesion={sesion} activo="Servicios" onLogout={store.logout}>
      <header className="anim-in mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker">Catálogo y precios</p>
          <h1 className="font-display text-2xl font-bold tracking-tight">Servicios</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
            El precio y la duración de cada cita salen de aquí. Si un barbero cobra distinto, ponlo en «Precios por barbero».
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {faltantes.length > 0 && (
            <button type="button" className="btn-linea" onClick={cargarMenu} title="Agrega los servicios del menú impreso que faltan">
              <ListPlus className="h-4 w-4" /> Cargar menú ({faltantes.length})
            </button>
          )}
          {servicios.length > 0 && barberos.length > 0 && (
            <button type="button" className="btn-linea" onClick={() => setPrecios(true)}>
              <BadgeDollarSign className="h-4 w-4" /> Precios por barbero
            </button>
          )}
          <button type="button" className="btn-gold px-5 py-2.5 text-sm" onClick={() => setEditando({})}>
            <Plus className="h-4 w-4" /> Nuevo servicio
          </button>
        </div>
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

      <ModulePanel
        titulo="Catálogo"
        descripcion={`${servicios.length} servicio${servicios.length === 1 ? "" : "s"} · toca el lápiz para editar precio, duración o lo que incluye`}
        extra={
          <button type="button" className="btn-linea is-sm" onClick={() => setEditando({ servicio: undefined, paquete: true })}>
            <Package className="h-4 w-4" /> Nuevo paquete
          </button>
        }
      >
        {categorias.length > 2 && (
          <div className="filtro-chips mb-3" role="tablist" aria-label="Filtrar por categoría">
            {categorias.map((c) => (
              <button key={c} type="button" role="tab" aria-selected={filtro === c} className={filtro === c ? "is-on" : ""} onClick={() => setFiltro(c)}>
                {c}
                <small>{c === "Todos" ? servicios.length : servicios.filter((s) => s.categoria === c).length}</small>
              </button>
            ))}
          </div>
        )}
        {servicios.length === 0 ? (
          <EmptyState icono={<Tags />}>
            Todavía no hay servicios. Sin servicios las citas no llevan precio.{" "}
            <button type="button" className="underline underline-offset-4" onClick={() => setEditando({})}>
              Agregar el primero
            </button>
          </EmptyState>
        ) : (
          <div className="grid gap-2">
            {visibles.map((s) => {
              const v = ventas.get(s.id);
              const caja = Math.round(s.precio * (1 - s.comision_pct / 100));
              return (
                <article key={s.id} className={`fila-servicio ${s.activo ? "" : "is-paused"}`}>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-semibold" style={{ color: "var(--ink)" }}>{s.nombre}</span>
                      <span className="badge badge-neutral">{s.categoria}</span>
                      {!s.activo && <span className="badge badge-warm">En pausa</span>}
                      {s.categoria === "Paquete" && (s.incluye?.length ?? 0) > 0 && (
                        <span className="badge badge-gold">{s.incluye!.length} servicios</span>
                      )}
                    </p>
                    <p className="mt-1 text-xs" style={{ color: "var(--ink-muted)" }}>
                      {s.descripcion ? `${s.descripcion} · ` : ""}
                      {s.duracion_min} min · comisión {s.comision_pct}% ({moneda.format(s.precio - caja)}) · queda en caja{" "}
                      {moneda.format(caja)}
                      {v ? ` · vendido ${v.veces} ${v.veces === 1 ? "vez" : "veces"} (${moneda.format(v.ingresos)})` : ""}
                    </p>
                    {barberos.some((b) => precioDe(s, b) !== s.precio) && (
                      <button type="button" className="servicio-especiales" onClick={() => setPrecios(true)} title="Editar precios por barbero">
                        {barberos
                          .filter((b) => precioDe(s, b) !== s.precio)
                          .map((b) => (
                            <span key={b.id}>
                              {b.nombre.split(" ")[0]} {moneda.format(precioDe(s, b))}
                            </span>
                          ))}
                      </button>
                    )}
                  </div>
                  <strong className="fila-servicio-precio">
                    {s.desde && <small className="mr-1 font-normal">desde</small>}
                    {moneda.format(s.precio)}
                  </strong>
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

      {precios && (
        <Modal
          titulo="Precios por barbero"
          descripcion="Deja vacío para cobrar el precio de lista. Aplica a las citas nuevas; las ya agendadas conservan su precio."
          onCerrar={() => setPrecios(false)}
          ancho="lg"
        >
          <EditorPrecios
            onCancelar={() => setPrecios(false)}
            onListo={(m) => {
              setPrecios(false);
              setAviso(m);
            }}
          />
        </Modal>
      )}

      {editando && (
        <Modal
          titulo={editando.servicio ? `Editar ${editando.servicio.categoria === "Paquete" ? "paquete" : "servicio"}` : editando.paquete ? "Nuevo paquete" : "Nuevo servicio"}
          descripcion="Los cambios aplican a las citas nuevas; las ya agendadas conservan su precio."
          onCerrar={() => setEditando(null)}
        >
          <FormularioServicio
            servicio={editando.servicio}
            paquete={editando.paquete}
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
  paquete,
  onListo,
  onCancelar,
}: {
  servicio?: Servicio;
  paquete?: boolean;
  onListo: (mensaje: string) => void;
  onCancelar: () => void;
}) {
  const store = useBarberia();
  const catalogo = store.servicios.filter((x) => x.id !== servicio?.id && x.categoria !== "Paquete");
  const [f, setF] = useState(
    servicio
      ? {
          nombre: servicio.nombre,
          categoria: servicio.categoria,
          descripcion: servicio.descripcion ?? "",
          desde: Boolean(servicio.desde),
          precio: String(servicio.precio),
          duracion_min: String(servicio.duracion_min),
          comision_pct: String(servicio.comision_pct),
          incluye: servicio.incluye ?? [],
        }
      : { ...VACIO, ...(paquete ? { categoria: "Paquete" as Servicio["categoria"], duracion_min: "60", precio: "" } : {}) }
  );
  const [error, setError] = useState("");
  const precio = Number(f.precio);
  const comision = Number(f.comision_pct);
  const valido = Number.isFinite(precio) && Number.isFinite(comision);
  const incluidos = catalogo.filter((x) => f.incluye.includes(x.id));
  const sumaIncluidos = incluidos.reduce((a, x) => a + x.precio, 0);
  const duracionIncluidos = incluidos.reduce((a, x) => a + x.duracion_min, 0);

  /** Marca o desmarca un servicio del paquete y rehace el texto «Incluye». */
  function alternarIncluido(id: string) {
    const incluye = f.incluye.includes(id) ? f.incluye.filter((x) => x !== id) : [...f.incluye, id];
    const nombres = catalogo.filter((x) => incluye.includes(x.id)).map((x) => x.nombre);
    const texto = nombres.length > 1 ? `${nombres.slice(0, -1).join(", ")} y ${nombres.at(-1)}` : (nombres[0] ?? "");
    setF({ ...f, incluye, descripcion: texto || f.descripcion });
  }

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const datos = {
      nombre: f.nombre.trim(),
      categoria: f.categoria,
      descripcion: f.descripcion.trim(),
      desde: f.desde,
      precio: Math.round(Number(f.precio)),
      duracion_min: Math.round(Number(f.duracion_min)),
      comision_pct: Math.round(Number(f.comision_pct)),
      incluye: f.categoria === "Paquete" ? f.incluye : [],
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
          {CATEGORIAS_SERVICIO.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </Campo>
      {f.categoria === "Paquete" && catalogo.length > 0 && (
        <div className="is-full">
          <span className="campo-label">Servicios del paquete</span>
          <div className="paquete-incluye mt-1.5">
            {catalogo.map((x) => {
              const on = f.incluye.includes(x.id);
              return (
                <button key={x.id} type="button" className={on ? "is-on" : ""} aria-pressed={on} onClick={() => alternarIncluido(x.id)}>
                  <Check className="h-3.5 w-3.5" aria-hidden /> {x.nombre}
                  <small>{moneda.format(x.precio)}</small>
                </button>
              );
            })}
          </div>
          {incluidos.length > 0 && (
            <p className="campo-ayuda mt-1.5">
              Por separado: {moneda.format(sumaIncluidos)} · {duracionIncluidos} min.
              {Number.isFinite(precio) && precio < sumaIncluidos && (
                <b style={{ color: "#5cc08d" }}> El cliente ahorra {moneda.format(sumaIncluidos - precio)}.</b>
              )}{" "}
              <button
                type="button"
                className="underline underline-offset-4"
                onClick={() => setF({ ...f, precio: String(sumaIncluidos), duracion_min: String(Math.max(5, duracionIncluidos)) })}
              >
                Usar suma
              </button>
            </p>
          )}
        </div>
      )}
      <Campo label="Incluye" ancho="completo" ayuda="Opcional. Se ve en la portada, p. ej. «Corte y facial».">
        <input className="campo-input" value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} placeholder="Corte y facial" />
      </Campo>
      <Campo label="Precio (MXN)">
        <input className="campo-input" type="number" inputMode="numeric" min={0} value={f.precio} onChange={(e) => setF({ ...f, precio: e.target.value })} />
      </Campo>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={f.desde} onChange={(e) => setF({ ...f, desde: e.target.checked })} /> Precio «a partir de»
      </label>
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
