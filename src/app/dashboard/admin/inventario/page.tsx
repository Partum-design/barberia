"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertTriangle,
  ArrowLeftRight,
  Banknote,
  Boxes,
  Check,
  CheckCircle2,
  CreditCard,
  Eye,
  EyeOff,
  ImagePlus,
  Loader2,
  Minus,
  Pencil,
  Plus,
  ShoppingBag,
  Store,
  Trash2,
  Warehouse,
} from "lucide-react";
import { PanelShell } from "@/components/shell/PanelShell";
import { EmptyState, Metric, ModulePanel, ShareBar, SinAcceso, moneda, numero } from "@/components/panel/ModuleUI";
import { Campo, Interruptor, Modal } from "@/components/panel/Modal";
import { useBarberia, type MetodoPago, type Producto } from "@/lib/store";

const CATEGORIAS: Producto["categoria"][] = ["Cuidado", "Peinado", "Afeitado", "Consumible"];

const FORM_VACIO: Omit<Producto, "id"> = {
  nombre: "",
  categoria: "Peinado",
  existencias: 10,
  minimo: 3,
  costo: 100,
  precio_venta: 250,
  unidad: "pieza",
  publico: true,
  descripcion: "",
  imagen_url: "",
  marca: "",
};

const METODOS: { id: MetodoPago; label: string; icono: React.ReactNode }[] = [
  { id: "efectivo", label: "Efectivo", icono: <Banknote className="h-4 w-4" /> },
  { id: "tarjeta", label: "Tarjeta", icono: <CreditCard className="h-4 w-4" /> },
  { id: "transferencia", label: "Transferencia", icono: <ArrowLeftRight className="h-4 w-4" /> },
];

/**
 * Inventario y tienda: existencias con aviso de reposición, ventas de
 * mostrador (quién vendió y cómo pagó) y qué productos se ven en la tienda
 * de la página web.
 */
export default function InventarioPage() {
  const store = useBarberia();
  const { listo, sesion, productos, ventas } = store;
  const [editor, setEditor] = useState<{ producto?: Producto } | null>(null);
  const [venta, setVenta] = useState<{ productoId?: string } | null>(null);
  const [aviso, setAviso] = useState("");

  const resumen = useMemo(() => {
    const valorAlmacen = productos.reduce((a, p) => a + p.existencias * p.costo, 0);
    const bajos = productos.filter((p) => p.existencias <= p.minimo);
    const mes = new Date();
    mes.setDate(1);
    mes.setHours(0, 0, 0, 0);
    const delMes = ventas.filter((v) => new Date(v.fecha) >= mes);
    return {
      referencias: productos.length,
      valorAlmacen,
      bajos,
      enTienda: productos.filter((p) => p.publico && p.precio_venta > 0).length,
      vendidoMes: delMes.reduce((a, v) => a + v.total, 0),
      piezasMes: delMes.reduce((a, v) => a + v.cantidad, 0),
    };
  }, [productos, ventas]);

  if (!listo) return null;
  if (!sesion || sesion.rol !== "admin") return <SinAcceso mensaje="Este módulo es del administrador" />;

  function eliminar(p: Producto) {
    if (!window.confirm(`¿Eliminar «${p.nombre}» del inventario?\n\nEsta acción no se puede deshacer.`)) return;
    if (store.eliminarProducto(p.id)) setAviso(`«${p.nombre}» eliminado del inventario.`);
  }

  function alternarTienda(p: Producto) {
    if (!p.publico && p.precio_venta <= 0) {
      window.alert("Ponle un precio de venta para mostrarlo en la tienda.");
      return setEditor({ producto: p });
    }
    if (store.actualizarProducto(p.id, { publico: !p.publico })) {
      setAviso(p.publico ? `«${p.nombre}» ya no se ve en la tienda.` : `«${p.nombre}» ahora se ve en la tienda de la página.`);
    }
  }

  return (
    <PanelShell sesion={sesion} activo="Inventario" onLogout={store.logout}>
      <header className="anim-in mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker">Almacén y tienda</p>
          <h1 className="font-display text-2xl font-bold tracking-tight">Inventario</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
            Existencias, ventas de mostrador y lo que se ve en la{" "}
            <Link href="/productos" className="underline underline-offset-4" target="_blank">
              tienda de la página
            </Link>
            .
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-linea" onClick={() => setEditor({})}>
            <Plus className="h-4 w-4" /> Nuevo producto
          </button>
          <button type="button" className="btn-gold px-5 py-2.5 text-sm" onClick={() => setVenta({})} disabled={productos.length === 0}>
            <ShoppingBag className="h-4 w-4" /> Registrar venta
          </button>
        </div>
      </header>

      {aviso && (
        <p className="aviso-ok anim-pop mb-4" role="status">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> {aviso}
        </p>
      )}

      <div className="metric-grid anim-in anim-d1">
        <Metric icono={<Boxes />} label="Productos" valor={numero.format(resumen.referencias)} nota={`${resumen.bajos.length} bajo mínimo`} />
        <Metric icono={<ShoppingBag />} label="Vendido este mes" valor={moneda.format(resumen.vendidoMes)} nota={`${resumen.piezasMes} piezas`} />
        <Metric icono={<Store />} label="En la tienda" valor={numero.format(resumen.enTienda)} nota="Visibles en la página" />
        <Metric icono={<Warehouse />} label="Valor del almacén" valor={moneda.format(resumen.valorAlmacen)} nota="A precio de costo" />
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

      <ModulePanel titulo="Productos" descripcion="El ojo decide si sale en la tienda de la página; + y − registran entradas y salidas.">
        {productos.length === 0 ? (
          <EmptyState icono={<Boxes />}>
            El almacén está vacío.{" "}
            <button type="button" className="underline underline-offset-4" onClick={() => setEditor({})}>
              Agregar el primero
            </button>
          </EmptyState>
        ) : (
          <div className="inv-lista">
            {productos.map((p) => {
              const bajo = p.existencias <= p.minimo;
              const nivel = p.minimo > 0 ? p.existencias / (p.minimo * 3) : 1;
              const enTienda = Boolean(p.publico) && p.precio_venta > 0;
              return (
                <article key={p.id} className={`inv-fila ${enTienda ? "" : "is-oculto"}`}>
                  <div className="inv-foto">
                    {p.imagen_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imagen_url} alt="" loading="lazy" />
                    ) : (
                      <Boxes className="h-5 w-5" aria-hidden />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5">
                      <b className="truncate">{p.nombre}</b>
                      {bajo && <span className="badge badge-warm">bajo</span>}
                      {enTienda ? <span className="badge badge-gold">En tienda</span> : <span className="badge badge-neutral">Oculto</span>}
                    </p>
                    <p className="inv-meta">
                      {p.marca ? `${p.marca} · ` : ""}
                      {p.categoria} · costo {moneda.format(p.costo)} · venta {p.precio_venta > 0 ? moneda.format(p.precio_venta) : "—"}
                    </p>
                    <div className="inv-nivel">
                      <ShareBar valor={Math.min(1, nivel)} tono={bajo ? "ox" : "ok"} />
                      <span>
                        {numero.format(p.existencias)} {p.unidad}
                        {p.existencias === 1 ? "" : "s"} · mín. {p.minimo}
                      </span>
                    </div>
                  </div>
                  <div className="inv-acciones">
                    <span className="inline-flex gap-1">
                      <button type="button" className="btn-icono" aria-label={`Restar una unidad de ${p.nombre}`} onClick={() => store.ajustarExistencias(p.id, -1)}>
                        <Minus className="h-4 w-4" />
                      </button>
                      <button type="button" className="btn-icono" aria-label={`Sumar una unidad de ${p.nombre}`} onClick={() => store.ajustarExistencias(p.id, 1)}>
                        <Plus className="h-4 w-4" />
                      </button>
                    </span>
                    <span className="inline-flex gap-1">
                      <button
                        type="button"
                        className={`btn-icono ${enTienda ? "is-on" : ""}`}
                        aria-pressed={enTienda}
                        aria-label={enTienda ? `Ocultar ${p.nombre} de la tienda` : `Mostrar ${p.nombre} en la tienda`}
                        title={enTienda ? "Ocultar de la tienda" : "Mostrar en la tienda"}
                        onClick={() => alternarTienda(p)}
                      >
                        {enTienda ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </button>
                      <button type="button" className="btn-icono" aria-label={`Editar ${p.nombre}`} title="Editar" onClick={() => setEditor({ producto: p })}>
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button type="button" className="btn-icono is-danger" aria-label={`Eliminar ${p.nombre}`} title="Eliminar" onClick={() => eliminar(p)}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </span>
                    <button
                      type="button"
                      className="btn-gold is-sm"
                      disabled={p.existencias <= 0}
                      onClick={() => setVenta({ productoId: p.id })}
                      title={p.existencias <= 0 ? "Sin existencias" : "Registrar venta"}
                    >
                      <ShoppingBag className="h-3.5 w-3.5" /> Vender
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </ModulePanel>

      <ModulePanel titulo="Ventas recientes" descripcion="Cada venta descuenta del almacén y entra en el corte de caja.">
        {ventas.length === 0 ? (
          <EmptyState icono={<ShoppingBag />}>Todavía no hay ventas de producto.</EmptyState>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Producto</th>
                  <th>Vendió</th>
                  <th>Pago</th>
                  <th className="num">Total</th>
                  <th className="num" aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {ventas.slice(0, 40).map((v) => (
                  <tr key={v.id}>
                    <td className="muted">{format(new Date(v.fecha), "d MMM HH:mm", { locale: es })}</td>
                    <td className="strong">
                      {v.cantidad > 1 ? `${v.cantidad} × ` : ""}
                      {v.producto_nombre}
                      {v.cliente_nombre && (
                        <span className="block text-[0.62rem]" style={{ color: "var(--ink-faint)" }}>
                          a {v.cliente_nombre}
                        </span>
                      )}
                    </td>
                    <td>{v.vendedor_nombre}</td>
                    <td>
                      <span className="badge badge-neutral">{METODOS.find((m) => m.id === v.metodo_pago)?.label ?? "Efectivo"}</span>
                    </td>
                    <td className="num">{moneda.format(v.total)}</td>
                    <td className="num">
                      <button
                        type="button"
                        className="btn-icono is-danger"
                        aria-label={`Deshacer venta de ${v.producto_nombre}`}
                        title="Deshacer venta (regresa las piezas al almacén)"
                        onClick={() => {
                          if (window.confirm(`¿Deshacer la venta de ${v.cantidad} × ${v.producto_nombre}?\n\nLas piezas regresan al almacén.`)) {
                            if (store.eliminarVenta(v.id)) setAviso("Venta deshecha: las piezas regresaron al almacén.");
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ModulePanel>

      {editor && (
        <Modal
          titulo={editor.producto ? `Editar «${editor.producto.nombre}»` : "Nuevo producto"}
          descripcion="Lo que escribas en descripción, marca y foto es lo que ve el cliente en la tienda."
          onCerrar={() => setEditor(null)}
          ancho="lg"
        >
          <FormularioProducto
            producto={editor.producto}
            onCancelar={() => setEditor(null)}
            onListo={(m) => {
              setEditor(null);
              setAviso(m);
            }}
          />
        </Modal>
      )}

      {venta && (
        <Modal titulo="Registrar venta" descripcion="Se descuenta del almacén y entra en el corte de caja." onCerrar={() => setVenta(null)}>
          <FormularioVenta
            productoInicial={venta.productoId}
            onCancelar={() => setVenta(null)}
            onListo={(m) => {
              setVenta(null);
              setAviso(m);
            }}
          />
        </Modal>
      )}
    </PanelShell>
  );
}

/** Reduce la foto en el navegador (WebP, máx. 900 px) antes de subirla. */
async function reducirImagen(archivo: File): Promise<Blob> {
  const bitmap = await createImageBitmap(archivo);
  const escala = Math.min(1, 900 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo procesar la imagen."))), "image/webp", 0.85)
  );
}

function FormularioProducto({
  producto,
  onListo,
  onCancelar,
}: {
  producto?: Producto;
  onListo: (mensaje: string) => void;
  onCancelar: () => void;
}) {
  const store = useBarberia();
  const [f, setF] = useState<Omit<Producto, "id">>(() => {
    if (!producto) return FORM_VACIO;
    const { id: _id, ...datos } = producto;
    void _id;
    return { ...FORM_VACIO, ...datos, publico: Boolean(datos.publico) };
  });
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState("");

  async function subir(archivo: File | undefined) {
    if (!archivo) return;
    setError("");
    setSubiendo(true);
    try {
      const datos = new FormData();
      datos.append("archivo", await reducirImagen(archivo), "foto.webp");
      const res = await fetch("/api/productos/imagen", { method: "POST", body: datos, credentials: "same-origin" });
      const cuerpo = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !cuerpo.url) throw new Error(cuerpo.error ?? "No se pudo subir la foto.");
      setF((prev) => ({ ...prev, imagen_url: cuerpo.url }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir la foto.");
    } finally {
      setSubiendo(false);
    }
  }

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const nombre = f.nombre.trim();
    if (nombre.length < 2) return setError("Escribe el nombre del producto.");
    if (f.publico && f.precio_venta <= 0) return setError("Para mostrarlo en la tienda necesita precio de venta.");
    const datos = { ...f, nombre, unidad: f.unidad.trim() || "pieza" };
    if (producto) {
      if (store.actualizarProducto(producto.id, datos)) onListo(`«${nombre}» actualizado.`);
    } else if (store.agregarProducto(datos)) {
      onListo(`«${nombre}» agregado${datos.publico ? " y publicado en la tienda" : ""}.`);
    }
  }

  const num = (k: "existencias" | "minimo" | "costo" | "precio_venta") => ({
    type: "number" as const,
    inputMode: "numeric" as const,
    min: 0,
    value: f[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: Number(e.target.value) }),
    className: "campo-input",
  });

  return (
    <form onSubmit={guardar} className="form-grid">
      <div className="inv-editor-foto is-full">
        <label className={`inv-subir ${f.imagen_url ? "has-foto" : ""}`}>
          {f.imagen_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={f.imagen_url} alt="Foto del producto" />
          ) : subiendo ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <>
              <ImagePlus className="h-6 w-6" />
              <span>Subir foto</span>
            </>
          )}
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => void subir(e.target.files?.[0])} disabled={subiendo} />
        </label>
        <div className="min-w-0 flex-1 grid gap-2">
          <Campo label="…o pega el enlace de una foto">
            <input
              className="campo-input"
              value={f.imagen_url ?? ""}
              onChange={(e) => setF({ ...f, imagen_url: e.target.value })}
              placeholder="https://…"
              inputMode="url"
            />
          </Campo>
          {f.imagen_url && (
            <button type="button" className="btn-linea is-sm w-fit" onClick={() => setF({ ...f, imagen_url: "" })}>
              Quitar foto
            </button>
          )}
        </div>
      </div>

      <Campo label="Producto" ancho="completo">
        <input className="campo-input" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} required placeholder="Cera mate fijación fuerte" />
      </Campo>
      <Campo label="Marca">
        <input className="campo-input" value={f.marca ?? ""} onChange={(e) => setF({ ...f, marca: e.target.value })} placeholder="Reuzel" />
      </Campo>
      <Campo label="Categoría">
        <select className="campo-input" value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value as Producto["categoria"] })}>
          {CATEGORIAS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </Campo>
      <Campo label="Descripción para la tienda" ancho="completo" ayuda="Para qué sirve, aroma, acabado. Corto y directo.">
        <textarea
          className="campo-input"
          rows={2}
          value={f.descripcion ?? ""}
          onChange={(e) => setF({ ...f, descripcion: e.target.value })}
          placeholder="Fijación fuerte, acabado mate. Se lava fácil."
        />
      </Campo>
      <Campo label="Precio de venta">
        <input {...num("precio_venta")} />
      </Campo>
      <Campo label="Costo">
        <input {...num("costo")} />
      </Campo>
      <Campo label="Existencias">
        <input {...num("existencias")} />
      </Campo>
      <Campo label="Mínimo (aviso)">
        <input {...num("minimo")} />
      </Campo>
      <Campo label="Unidad">
        <input className="campo-input" value={f.unidad} onChange={(e) => setF({ ...f, unidad: e.target.value })} placeholder="pieza" />
      </Campo>
      <div className="is-full">
        <Interruptor
          activo={Boolean(f.publico)}
          onChange={(v) => setF({ ...f, publico: v })}
          label="Mostrar en la tienda de la página"
          ayuda="Los clientes lo ven con foto, precio y si hay existencias. El costo nunca se muestra."
        />
      </div>
      {error && (
        <p className="form-error is-full" role="alert">
          {error}
        </p>
      )}
      <div className="form-acciones is-full">
        <button type="button" className="btn-linea" onClick={onCancelar}>
          Cancelar
        </button>
        <button type="submit" className="btn-gold px-5 py-2.5 text-sm" disabled={subiendo}>
          <Check className="h-4 w-4" /> {producto ? "Guardar cambios" : "Agregar producto"}
        </button>
      </div>
    </form>
  );
}

function FormularioVenta({
  productoInicial,
  onListo,
  onCancelar,
}: {
  productoInicial?: string;
  onListo: (mensaje: string) => void;
  onCancelar: () => void;
}) {
  const store = useBarberia();
  const { productos, barberos, sesion } = store;
  const disponibles = productos.filter((p) => p.existencias > 0);
  const [productoId, setProductoId] = useState(productoInicial ?? disponibles[0]?.id ?? "");
  const producto = productos.find((p) => p.id === productoId);
  const [cantidad, setCantidad] = useState(1);
  const [precio, setPrecio] = useState(String(producto?.precio_venta ?? ""));
  const [vendedor, setVendedor] = useState(sesion?.id ?? "");
  const [metodo, setMetodo] = useState<MetodoPago>("efectivo");
  const [cliente, setCliente] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const unitario = Math.max(0, Math.round(Number(precio) || 0));

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!producto) return setError("Elige el producto.");
    if (cantidad < 1) return setError("La cantidad mínima es 1.");
    if (cantidad > producto.existencias) return setError(`Sólo quedan ${producto.existencias}.`);
    setGuardando(true);
    const r = await store.venderProducto({
      producto_id: producto.id,
      cantidad,
      precio_unitario: unitario,
      metodo_pago: metodo,
      vendedor_id: vendedor,
      cliente_nombre: cliente.trim(),
    });
    setGuardando(false);
    if (!r.ok) return setError(r.error ?? "No se pudo registrar.");
    const quien = vendedor === sesion?.id ? "tú" : (barberos.find((b) => b.id === vendedor)?.nombre ?? "");
    onListo(`Venta registrada: ${cantidad} × ${producto.nombre} por ${moneda.format(unitario * cantidad)} (vendió ${quien}).`);
  }

  return (
    <form onSubmit={guardar} className="form-grid">
      <Campo label="Producto" ancho="completo">
        <select
          className="campo-input"
          value={productoId}
          onChange={(e) => {
            setProductoId(e.target.value);
            setPrecio(String(productos.find((p) => p.id === e.target.value)?.precio_venta ?? ""));
            setCantidad(1);
          }}
        >
          {disponibles.length === 0 && <option value="">Sin existencias</option>}
          {disponibles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre} — {moneda.format(p.precio_venta)} ({p.existencias} disp.)
            </option>
          ))}
        </select>
      </Campo>
      <Campo label="Cantidad">
        <div className="inv-cantidad">
          <button type="button" className="btn-icono" aria-label="Una menos" onClick={() => setCantidad((c) => Math.max(1, c - 1))}>
            <Minus className="h-4 w-4" />
          </button>
          <input
            className="campo-input text-center"
            type="number"
            inputMode="numeric"
            min={1}
            max={producto?.existencias ?? 1}
            value={cantidad}
            onChange={(e) => setCantidad(Math.max(1, Math.round(Number(e.target.value) || 1)))}
          />
          <button
            type="button"
            className="btn-icono"
            aria-label="Una más"
            onClick={() => setCantidad((c) => Math.min(producto?.existencias ?? 1, c + 1))}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </Campo>
      <Campo label="Precio por pieza" ayuda="Cámbialo sólo si hiciste descuento.">
        <input className="campo-input" type="number" inputMode="numeric" min={0} value={precio} onChange={(e) => setPrecio(e.target.value)} />
      </Campo>
      <Campo label="¿Quién lo vendió?" ancho="completo">
        <select className="campo-input" value={vendedor} onChange={(e) => setVendedor(e.target.value)}>
          {sesion && <option value={sesion.id}>{sesion.nombre} (administración)</option>}
          {barberos
            .filter((b) => b.activo)
            .map((b) => (
              <option key={b.id} value={b.id}>
                {b.nombre}
              </option>
            ))}
        </select>
      </Campo>
      <div className="is-full">
        <span className="campo-label">¿Cómo pagó?</span>
        <div className="segmentado is-3 mt-1.5">
          {METODOS.map((m) => (
            <button key={m.id} type="button" className={metodo === m.id ? "is-active" : ""} onClick={() => setMetodo(m.id)}>
              {m.icono} {m.label}
            </button>
          ))}
        </div>
      </div>
      <Campo label="Cliente (opcional)" ancho="completo">
        <input className="campo-input" value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Nombre del cliente" />
      </Campo>
      <div className="reparto is-full" aria-label="Total de la venta">
        <div>
          <small>Piezas</small>
          <b>{cantidad}</b>
        </div>
        <div>
          <small>Por pieza</small>
          <b>{moneda.format(unitario)}</b>
        </div>
        <div>
          <small>Total</small>
          <b>{moneda.format(unitario * cantidad)}</b>
        </div>
      </div>
      {error && (
        <p className="form-error is-full" role="alert">
          {error}
        </p>
      )}
      <div className="form-acciones is-full">
        <button type="button" className="btn-linea" onClick={onCancelar}>
          Cancelar
        </button>
        <button type="submit" className="btn-gold px-5 py-2.5 text-sm" disabled={guardando || !producto}>
          {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Registrar venta
        </button>
      </div>
    </form>
  );
}
