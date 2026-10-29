"use client";

import { useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import { es } from "date-fns/locale";
import {
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  Banknote,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  CreditCard,
  HandCoins,
  Loader2,
  Lock,
  Plus,
  Printer,
  Receipt,
  ShoppingBag,
  Trash2,
  Wallet,
} from "lucide-react";
import { PanelShell } from "@/components/shell/PanelShell";
import { EmptyState, Metric, ModulePanel, ShareBar, SinAcceso, moneda, numero, porcentaje } from "@/components/panel/ModuleUI";
import { Campo, Modal } from "@/components/panel/Modal";
import {
  DIAS_SEMANA,
  calcularCorte,
  citaActiva,
  semanaDeCorte,
  useBarberia,
  type CorteCaja,
  type DiaSemana,
  type Gasto,
} from "@/lib/store";

const CATEGORIAS: Gasto["categoria"][] = ["Renta", "Insumos", "Nómina", "Publicidad", "Servicios", "Otros"];

type Modo = "semana" | "mes" | "fechas";

const dia = (d: Date) => format(d, "yyyy-MM-dd");
const rango = (desde: Date, hasta: Date) => {
  const fin = addDays(hasta, -1);
  const mismoAnio = desde.getFullYear() === fin.getFullYear();
  return `${format(desde, mismoAnio ? "EEE d MMM" : "d MMM yyyy", { locale: es })} – ${format(fin, "EEE d MMM yyyy", { locale: es })}`;
};

/**
 * Caja: corte de un periodo (semana de corte, mes o fechas elegidas) con
 * servicios, productos, propinas, desglose por método, lo que toca a cada
 * barbero y gastos. «Hacer corte» congela los números en el historial.
 */
export default function CajaPage() {
  const store = useBarberia();
  const { listo, sesion, citas, gastos, ventas, cortes, barberiaConfig } = store;
  const inicioSemana: DiaSemana = barberiaConfig.corte_inicio ?? "lun";

  const [modo, setModo] = useState<Modo>("semana");
  const [desplazar, setDesplazar] = useState(0);
  const hoy = dia(new Date());
  const [fechas, setFechas] = useState({ desde: dia(addDays(new Date(), -6)), hasta: hoy });
  const [cortando, setCortando] = useState(false);
  const [abiertoGasto, setAbiertoGasto] = useState(false);
  const [form, setForm] = useState({ concepto: "", categoria: "Insumos" as Gasto["categoria"], monto: 0 });
  const [detalle, setDetalle] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");

  const periodo = useMemo(() => {
    if (modo === "semana") {
      const s = semanaDeCorte(addDays(new Date(), desplazar * 7), inicioSemana);
      return { desde: s.desde, hasta: s.hasta };
    }
    if (modo === "mes") {
      const base = new Date();
      const desde = new Date(base.getFullYear(), base.getMonth() + desplazar, 1);
      const hasta = new Date(base.getFullYear(), base.getMonth() + desplazar + 1, 1);
      return { desde, hasta };
    }
    const desde = new Date(`${fechas.desde}T00:00`);
    const hasta = addDays(new Date(`${fechas.hasta}T00:00`), 1);
    return { desde, hasta };
  }, [modo, desplazar, inicioSemana, fechas]);

  const valido = Number.isFinite(periodo.desde.getTime()) && Number.isFinite(periodo.hasta.getTime()) && periodo.hasta > periodo.desde;

  const datos = useMemo(() => {
    if (!valido) return null;
    const desde = periodo.desde.getTime();
    const hasta = periodo.hasta.getTime();
    const corte = calcularCorte({ citas, ventas, gastos }, desde, hasta);
    const porCobrar = citas.filter(
      (c) => c.estado === "asistida" && c.estado_pago === "pendiente" && citaActiva(c) && new Date(c.inicio).getTime() >= desde && new Date(c.inicio).getTime() < hasta
    );
    const gastosPeriodo = gastos.filter((g) => new Date(g.fecha).getTime() >= desde && new Date(g.fecha).getTime() < hasta);
    const yaCortado = cortes.find((c) => new Date(c.desde).getTime() === desde && new Date(c.hasta).getTime() === hasta);
    return {
      ...corte,
      porCobrar: porCobrar.reduce((a, c) => a + c.precio, 0),
      pendientes: porCobrar.length,
      gastosPeriodo,
      yaCortado,
    };
  }, [valido, periodo, citas, ventas, gastos, cortes]);

  const porCategoria = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const g of datos?.gastosPeriodo ?? []) mapa.set(g.categoria, (mapa.get(g.categoria) ?? 0) + g.monto);
    return [...mapa.entries()].map(([categoria, monto]) => ({ categoria, monto })).sort((a, b) => b.monto - a.monto);
  }, [datos]);

  if (!listo) return null;
  if (!sesion || sesion.rol !== "admin") return <SinAcceso mensaje="Este módulo es del administrador" />;

  function registrarGasto(e: React.FormEvent) {
    e.preventDefault();
    if (!form.concepto.trim() || form.monto <= 0) return;
    store.agregarGasto({ ...form, concepto: form.concepto.trim() });
    setForm({ concepto: "", categoria: "Insumos", monto: 0 });
    setAbiertoGasto(false);
  }

  const totalEntrada = datos ? datos.efectivo + datos.tarjeta + datos.transferencia : 0;
  const base = Math.max(1, totalEntrada);
  const maxGasto = Math.max(1, ...porCategoria.map((c) => c.monto));
  const esActual = modo !== "fechas" && desplazar === 0;

  return (
    <PanelShell sesion={sesion} activo="Caja y finanzas" onLogout={store.logout}>
      <header className="anim-in mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker">Caja y cortes</p>
          <h1 className="font-display text-2xl font-bold tracking-tight">Caja y finanzas</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
            Servicios, productos y propinas del periodo; cómo se cobró, lo que toca a cada barbero y lo que quedó.
          </p>
        </div>
        <button type="button" className="btn-gold px-5 py-2.5 text-sm" onClick={() => setCortando(true)} disabled={!datos}>
          <Lock className="h-4 w-4" /> Hacer corte
        </button>
      </header>

      {aviso && (
        <p className="aviso-ok anim-pop mb-4" role="status">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> {aviso}
        </p>
      )}

      {/* Periodo */}
      <section className="caja-periodo anim-in" aria-label="Periodo del corte">
        <div className="filtro-chips" role="tablist" aria-label="Tipo de periodo">
          {(
            [
              ["semana", "Semanal"],
              ["mes", "Mensual"],
              ["fechas", "Elegir fechas"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={modo === id}
              className={modo === id ? "is-on" : ""}
              onClick={() => {
                setModo(id);
                setDesplazar(0);
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {modo === "fechas" ? (
          <div className="caja-fechas">
            <label>
              <span>Desde</span>
              <input type="date" className="campo-input" value={fechas.desde} max={fechas.hasta} onChange={(e) => setFechas({ ...fechas, desde: e.target.value })} />
            </label>
            <label>
              <span>Hasta (incluido)</span>
              <input type="date" className="campo-input" value={fechas.hasta} min={fechas.desde} onChange={(e) => setFechas({ ...fechas, hasta: e.target.value })} />
            </label>
          </div>
        ) : (
          <div className="caja-nav">
            <button type="button" className="btn-icono" aria-label="Periodo anterior" onClick={() => setDesplazar((d) => d - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p>
              <b className="capitalize">{valido ? rango(periodo.desde, periodo.hasta) : "—"}</b>
              <small>{esActual ? (modo === "semana" ? "Semana en curso" : "Mes en curso") : "Periodo anterior"}</small>
            </p>
            <button type="button" className="btn-icono" aria-label="Periodo siguiente" onClick={() => setDesplazar((d) => Math.min(0, d + 1))} disabled={desplazar >= 0}>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {modo === "semana" && (
          <label className="caja-inicio">
            <span>La semana de corte empieza el</span>
            <select
              className="campo-input is-sm"
              value={inicioSemana}
              onChange={(e) => store.actualizarBarberiaConfig({ corte_inicio: e.target.value as DiaSemana })}
            >
              {DIAS_SEMANA.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label.toLowerCase()}
                </option>
              ))}
            </select>
          </label>
        )}

        {datos?.yaCortado && (
          <p className="caja-cortado">
            <Lock className="h-3.5 w-3.5" /> Este periodo ya tiene corte, hecho el{" "}
            {format(new Date(datos.yaCortado.creado_en), "d MMM 'a las' HH:mm", { locale: es })} por {datos.yaCortado.creado_por}.
          </p>
        )}
      </section>

      {!datos ? (
        <EmptyState icono={<Receipt />}>Elige un rango de fechas válido.</EmptyState>
      ) : (
        <>
          <div className="metric-grid anim-in anim-d1 mt-3">
            <Metric icono={<Wallet />} label="Entró a caja" valor={moneda.format(totalEntrada)} nota={`${datos.citas} cobros · ${datos.ventas} productos`} />
            <Metric icono={<ShoppingBag />} label="Productos vendidos" valor={moneda.format(datos.productos)} nota={`Servicios ${moneda.format(datos.servicios)}`} />
            <Metric icono={<HandCoins />} label="Propinas" valor={moneda.format(datos.propinas)} nota="Son del equipo" />
            <Metric
              icono={datos.utilidad >= 0 ? <ArrowUpRight /> : <ArrowDownRight />}
              label="Utilidad"
              valor={moneda.format(datos.utilidad)}
              nota={`Comisiones ${moneda.format(datos.comisiones)} · gastos ${moneda.format(datos.gastos)}`}
            />
          </div>

          {datos.pendientes > 0 && (
            <p className="data-source-note mt-3">
              <Receipt />
              <span>
                <b>{moneda.format(datos.porCobrar)} por cobrar</b> en {datos.pendientes} cita{datos.pendientes === 1 ? "" : "s"} atendida
                {datos.pendientes === 1 ? "" : "s"} del periodo. No entran al corte hasta que se cobren.
              </span>
            </p>
          )}

          <div className="module-split mt-3">
            <div>
              <ModulePanel titulo="Cómo se cobró" descripcion="Servicios, productos y propinas por método de pago">
                <div className="grid gap-3">
                  {(
                    [
                      ["efectivo", "Efectivo", <Banknote key="e" className="h-3.5 w-3.5" />, "ox"],
                      ["tarjeta", "Tarjeta", <CreditCard key="t" className="h-3.5 w-3.5" />, "oro"],
                      ["transferencia", "Transferencia", <ArrowLeftRight key="x" className="h-3.5 w-3.5" />, "ok"],
                    ] as const
                  ).map(([k, label, icono, tono]) => (
                    <div key={k}>
                      <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
                        <span className="inline-flex items-center gap-1.5" style={{ color: "var(--ink)" }}>
                          {icono} {label}
                        </span>
                        <span className="font-num" style={{ color: "var(--ink-muted)" }}>
                          {moneda.format(datos[k])} · {porcentaje(datos[k] / base, 0)}
                        </span>
                      </div>
                      <ShareBar valor={datos[k] / base} tono={tono} />
                    </div>
                  ))}
                </div>
              </ModulePanel>

              <ModulePanel titulo="Equipo" descripcion="Lo que generó cada quien y lo que le toca (comisión + propinas)">
                {datos.equipo.length === 0 ? (
                  <EmptyState icono={<Wallet />}>Sin cobros ni ventas en el periodo.</EmptyState>
                ) : (
                  <TablaEquipo equipo={datos.equipo} />
                )}
              </ModulePanel>
            </div>

            <div>
              <ModulePanel
                titulo="Gastos"
                descripcion={`${moneda.format(datos.gastos)} en el periodo`}
                extra={
                  <button type="button" className="btn-gold px-3 py-2 text-xs" onClick={() => setAbiertoGasto((v) => !v)}>
                    <Plus className="h-3.5 w-3.5" /> Registrar
                  </button>
                }
              >
                {abiertoGasto && (
                  <form onSubmit={registrarGasto} className="mb-3 grid gap-2 rounded-xl border p-3" style={{ borderColor: "var(--line)" }}>
                    <input
                      value={form.concepto}
                      onChange={(e) => setForm({ ...form, concepto: e.target.value })}
                      placeholder="Concepto del gasto"
                      required
                      className="campo-input"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value as Gasto["categoria"] })} className="campo-input">
                        {CATEGORIAS.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={1}
                        value={form.monto || ""}
                        onChange={(e) => setForm({ ...form, monto: Number(e.target.value) })}
                        placeholder="Monto"
                        required
                        className="campo-input"
                      />
                    </div>
                    <button type="submit" className="btn-gold py-2 text-xs">
                      <Check className="h-3.5 w-3.5" /> Guardar gasto
                    </button>
                  </form>
                )}

                {porCategoria.length > 0 && (
                  <div className="mb-3 grid gap-2">
                    {porCategoria.map((c) => (
                      <div key={c.categoria}>
                        <div className="mb-1 flex items-baseline justify-between gap-3 text-[0.68rem]">
                          <span style={{ color: "var(--ink)" }}>{c.categoria}</span>
                          <span className="font-num" style={{ color: "var(--ink-muted)" }}>
                            {moneda.format(c.monto)}
                          </span>
                        </div>
                        <ShareBar valor={c.monto / maxGasto} tono="ox" />
                      </div>
                    ))}
                  </div>
                )}

                {datos.gastosPeriodo.length === 0 ? (
                  <EmptyState icono={<Receipt />}>Sin gastos en el periodo.</EmptyState>
                ) : (
                  <div className="grid gap-1.5">
                    {datos.gastosPeriodo.map((g) => (
                      <div key={g.id} className="flex items-center gap-2 rounded-xl border p-2.5" style={{ borderColor: "var(--line)" }}>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium" style={{ color: "var(--ink)" }}>
                            {g.concepto}
                          </p>
                          <p className="text-[0.62rem]" style={{ color: "var(--ink-faint)" }}>
                            {g.categoria} · {format(new Date(g.fecha), "d MMM", { locale: es })}
                          </p>
                        </div>
                        <span className="font-num text-xs" style={{ color: "var(--ink)" }}>
                          {moneda.format(g.monto)}
                        </span>
                        <button
                          type="button"
                          aria-label={`Eliminar ${g.concepto}`}
                          onClick={() => store.eliminarGasto(g.id)}
                          className="grid h-7 w-7 place-items-center rounded-lg btn-danger-ghost"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </ModulePanel>
            </div>
          </div>
        </>
      )}

      <ModulePanel titulo="Historial de cortes" descripcion={`${cortes.length} corte${cortes.length === 1 ? "" : "s"} guardado${cortes.length === 1 ? "" : "s"}`}>
        {cortes.length === 0 ? (
          <EmptyState icono={<Lock />}>Aún no hay cortes. Elige el periodo arriba y toca «Hacer corte».</EmptyState>
        ) : (
          <div className="grid gap-2">
            {cortes.map((c) => (
              <FilaCorte
                key={c.id}
                corte={c}
                abierto={detalle === c.id}
                onAlternar={() => setDetalle(detalle === c.id ? null : c.id)}
                onEliminar={() => {
                  if (window.confirm(`¿Eliminar el corte del ${rango(new Date(c.desde), new Date(c.hasta))}?\n\nLos cobros y ventas no se borran; sólo el registro del corte.`)) {
                    store.eliminarCorte(c.id);
                  }
                }}
              />
            ))}
          </div>
        )}
      </ModulePanel>

      {cortando && datos && (
        <Modal titulo="Hacer corte de caja" descripcion={`Periodo: ${rango(periodo.desde, periodo.hasta)}`} onCerrar={() => setCortando(false)}>
          <FormularioCorte
            desde={periodo.desde}
            hasta={periodo.hasta}
            efectivo={datos.efectivo}
            total={totalEntrada}
            yaCortado={Boolean(datos.yaCortado)}
            onCancelar={() => setCortando(false)}
            onListo={(m) => {
              setCortando(false);
              setAviso(m);
            }}
          />
        </Modal>
      )}
    </PanelShell>
  );
}

function TablaEquipo({ equipo }: { equipo: CorteCaja["equipo"] }) {
  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Quién</th>
            <th className="num">Servicios</th>
            <th className="num">Comisión</th>
            <th className="num">Propinas</th>
            <th className="num">Vendió</th>
            <th className="num">Le toca</th>
          </tr>
        </thead>
        <tbody>
          {equipo.map((b) => (
            <tr key={b.id}>
              <td className="strong">{b.nombre}</td>
              <td className="num">{moneda.format(b.servicios)}</td>
              <td className="num muted">{moneda.format(b.comision)}</td>
              <td className="num muted">{moneda.format(b.propinas)}</td>
              <td className="num muted">{b.productos > 0 ? moneda.format(b.productos) : "—"}</td>
              <td className="num strong">{moneda.format(b.comision + b.propinas)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FilaCorte({
  corte: c,
  abierto,
  onAlternar,
  onEliminar,
}: {
  corte: CorteCaja;
  abierto: boolean;
  onAlternar: () => void;
  onEliminar: () => void;
}) {
  const entro = c.efectivo + c.tarjeta + c.transferencia;
  const diferencia = c.efectivo_contado === null || c.efectivo_contado === undefined ? null : c.efectivo_contado - c.efectivo;
  return (
    <article className={`corte-fila ${abierto ? "is-open" : ""}`}>
      <button type="button" className="corte-cabeza" onClick={onAlternar} aria-expanded={abierto}>
        <span className="min-w-0 flex-1 text-left">
          <b className="block truncate capitalize">{rango(new Date(c.desde), new Date(c.hasta))}</b>
          <small>
            Hecho el {format(new Date(c.creado_en), "d MMM HH:mm", { locale: es })} · {c.creado_por}
          </small>
        </span>
        <span className="corte-cifras">
          <span>
            <small>Entró</small>
            <b>{moneda.format(entro)}</b>
          </span>
          <span>
            <small>Utilidad</small>
            <b className={c.utilidad >= 0 ? "" : "is-neg"}>{moneda.format(c.utilidad)}</b>
          </span>
          {diferencia !== null && (
            <span className={`badge ${diferencia === 0 ? "badge-ok" : "badge-warm"}`}>
              {diferencia === 0 ? "Cuadró" : `${diferencia > 0 ? "Sobran" : "Faltan"} ${moneda.format(Math.abs(diferencia))}`}
            </span>
          )}
        </span>
        <ChevronDown className="corte-flecha h-4 w-4" aria-hidden />
      </button>
      {abierto && (
        <div className="corte-detalle">
          <dl className="corte-dl">
            <div><dt>Servicios</dt><dd>{moneda.format(c.servicios)}</dd></div>
            <div><dt>Productos</dt><dd>{moneda.format(c.productos)}</dd></div>
            <div><dt>Propinas</dt><dd>{moneda.format(c.propinas)}</dd></div>
            <div><dt>Efectivo</dt><dd>{moneda.format(c.efectivo)}</dd></div>
            <div><dt>Tarjeta</dt><dd>{moneda.format(c.tarjeta)}</dd></div>
            <div><dt>Transferencia</dt><dd>{moneda.format(c.transferencia)}</dd></div>
            <div><dt>Comisiones</dt><dd>{moneda.format(c.comisiones)}</dd></div>
            <div><dt>Gastos</dt><dd>{moneda.format(c.gastos)}</dd></div>
            {c.efectivo_contado !== null && c.efectivo_contado !== undefined && (
              <div><dt>Efectivo contado</dt><dd>{moneda.format(c.efectivo_contado)}</dd></div>
            )}
            <div><dt>Cobros / piezas</dt><dd>{numero.format(c.citas)} / {numero.format(c.ventas)}</dd></div>
          </dl>
          {c.equipo.length > 0 && <TablaEquipo equipo={c.equipo} />}
          {c.notas && <p className="mt-2 text-xs" style={{ color: "var(--ink-muted)" }}>Notas: {c.notas}</p>}
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <button type="button" className="btn-linea is-sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Imprimir
            </button>
            <button type="button" className="btn-linea is-sm" onClick={onEliminar}>
              <Trash2 className="h-4 w-4" /> Eliminar corte
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

function FormularioCorte({
  desde,
  hasta,
  efectivo,
  total,
  yaCortado,
  onListo,
  onCancelar,
}: {
  desde: Date;
  hasta: Date;
  efectivo: number;
  total: number;
  yaCortado: boolean;
  onListo: (m: string) => void;
  onCancelar: () => void;
}) {
  const store = useBarberia();
  const [contado, setContado] = useState("");
  const [notas, setNotas] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const contadoNum = contado.trim() === "" ? null : Math.max(0, Math.round(Number(contado) || 0));
  const diferencia = contadoNum === null ? null : contadoNum - efectivo;

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    const r = await store.hacerCorte({
      desde: desde.toISOString(),
      hasta: hasta.toISOString(),
      efectivo_contado: contadoNum,
      notas: notas.trim(),
    });
    setGuardando(false);
    if (!r.ok) return setError(r.error ?? "No se pudo guardar el corte.");
    onListo(`Corte guardado: ${moneda.format(total)} del ${rango(desde, hasta)}.`);
  }

  return (
    <form onSubmit={guardar} className="form-grid">
      {yaCortado && (
        <p className="form-error is-full" role="status">
          Este periodo ya tiene un corte. Si lo haces otra vez quedarán dos en el historial.
        </p>
      )}
      <div className="reparto is-full">
        <div>
          <small>Entró a caja</small>
          <b>{moneda.format(total)}</b>
        </div>
        <div>
          <small>Efectivo esperado</small>
          <b>{moneda.format(efectivo)}</b>
        </div>
        <div>
          <small>Diferencia</small>
          <b style={{ color: diferencia === null ? undefined : diferencia === 0 ? "#5cc08d" : "#e8a94a" }}>
            {diferencia === null ? "—" : `${diferencia > 0 ? "+" : ""}${moneda.format(diferencia)}`}
          </b>
        </div>
      </div>
      <Campo label="Efectivo contado en caja (opcional)" ancho="completo" ayuda="Cuenta los billetes y monedas: te decimos si cuadra.">
        <input className="campo-input" type="number" inputMode="numeric" min={0} value={contado} onChange={(e) => setContado(e.target.value)} placeholder={String(efectivo)} />
      </Campo>
      <Campo label="Notas (opcional)" ancho="completo">
        <textarea className="campo-input" rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Ej. Se pagó la nómina en efectivo" />
      </Campo>
      {error && (
        <p className="form-error is-full" role="alert">
          {error}
        </p>
      )}
      <div className="form-acciones is-full">
        <button type="button" className="btn-linea" onClick={onCancelar}>
          Cancelar
        </button>
        <button type="submit" className="btn-gold px-5 py-2.5 text-sm" disabled={guardando}>
          {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />} Guardar corte
        </button>
      </div>
    </form>
  );
}
