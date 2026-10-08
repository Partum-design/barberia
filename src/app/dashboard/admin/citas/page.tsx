"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { endOfDay, format, isToday, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import {
  Banknote,
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  CalendarX2,
  CheckCircle2,
  Home,
  Pencil,
  QrCode,
  ScanLine,
  Search,
  Trash2,
  UserX,
  XCircle,
} from "lucide-react";
import { PanelShell } from "@/components/shell/PanelShell";
import { EmptyState, Metric, ModulePanel, ModuleTabs, SinAcceso, moneda, numero } from "@/components/panel/ModuleUI";
import { Modal } from "@/components/panel/Modal";
import { EditorCita } from "@/components/citas/EditorCita";
import { QrCita } from "@/components/citas/QrCita";
import { BotonGuardarQr } from "@/components/citas/BotonGuardarQr";
import { ETIQUETA_ESTADO_CITA, enlaceDeCita, nombreDelNegocio, resumirCitas, useBarberia, type Cita, type EstadoCita } from "@/lib/store";

type Rango = "hoy" | "proximas" | "pasadas" | "todas";

const TONO_ESTADO: Record<EstadoCita, string> = {
  confirmada: "badge-neutral",
  asistida: "badge-ok",
  no_asistio: "badge-warm",
  cancelada: "badge-danger",
};

/**
 * Agenda completa de la barbería con todo lo que pasa en mostrador: agendar a
 * nombre de un cliente, confirmar llegada, marcar falta, reprogramar, cambiar
 * quién atendió, cancelar y cobrar.
 */
export default function CitasAdminPage() {
  const store = useBarberia();
  const { listo, sesion, citas, barberos } = store;
  const [rango, setRango] = useState<Rango>("hoy");
  const [estado, setEstado] = useState<EstadoCita | "todas">("todas");
  const [barbero, setBarbero] = useState("todos");
  const [busqueda, setBusqueda] = useState("");
  const [editor, setEditor] = useState<{ cita?: Cita; cliente?: string } | null>(null);
  const [qr, setQr] = useState<Cita | null>(null);
  const [aviso, setAviso] = useState("");

  // Accesos directos: ?nueva=<clienteId> abre el alta, ?editar=<citaId> la edición.
  useEffect(() => {
    if (!listo) return;
    const p = new URLSearchParams(window.location.search);
    const nueva = p.get("nueva");
    const editar = p.get("editar");
    if (nueva !== null) setEditor({ cliente: nueva || undefined });
    else if (editar) {
      const c = citas.find((x) => x.id === editar);
      if (c) setEditor({ cita: c });
    }
    if (nueva !== null || editar) window.history.replaceState(null, "", window.location.pathname);
    // Sólo al cargar: después la URL ya no manda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listo]);

  useEffect(() => {
    if (!aviso) return;
    const t = window.setTimeout(() => setAviso(""), 5000);
    return () => window.clearTimeout(t);
  }, [aviso]);

  const metricas = useMemo(() => {
    const hoy = resumirCitas(citas.filter((c) => isToday(new Date(c.inicio))));
    return { hoy: hoy.total, porLlegar: hoy.porVenir, llegaron: hoy.atendidas, faltas: hoy.faltas, porCobrar: hoy.porCobrar, ingresos: hoy.ingresos };
  }, [citas]);

  const grupos = useMemo(() => {
    const ahora = Date.now();
    const q = busqueda.trim().toLowerCase();
    const filtradas = citas
      .filter((c) => {
        const t = new Date(c.inicio).getTime();
        if (rango === "hoy") return t >= startOfDay(ahora).getTime() && t <= endOfDay(ahora).getTime();
        if (rango === "proximas") return t >= startOfDay(ahora).getTime();
        if (rango === "pasadas") return t < startOfDay(ahora).getTime();
        return true;
      })
      .filter((c) => estado === "todas" || c.estado === estado)
      .filter((c) => barbero === "todos" || c.barbero_id === barbero)
      .filter((c) => !q || c.cliente_nombre.toLowerCase().includes(q) || c.barbero_nombre.toLowerCase().includes(q))
      .sort((a, b) => (rango === "pasadas" ? b.inicio.localeCompare(a.inicio) : a.inicio.localeCompare(b.inicio)));

    const porDia = new Map<string, Cita[]>();
    for (const c of filtradas) {
      const dia = format(new Date(c.inicio), "yyyy-MM-dd");
      porDia.set(dia, [...(porDia.get(dia) ?? []), c]);
    }
    return { total: filtradas.length, dias: [...porDia.entries()] };
  }, [citas, rango, estado, barbero, busqueda]);

  if (!listo) return null;
  if (!sesion || sesion.rol !== "admin") return <SinAcceso mensaje="Este módulo es del administrador" />;

  async function eliminar(c: Cita) {
    if (
      !window.confirm(
        `¿Eliminar la cita de ${c.cliente_nombre || "este cliente"}?\n\nSe borra por completo: deja de contar en caja, reportes y sellos de lealtad. Si sólo no va a venir, mejor cancélala.`
      )
    )
      return;
    const r = await store.eliminarCita(c.id);
    if (!r.ok) window.alert(r.error);
    else setAviso("Cita eliminada.");
  }

  async function eliminarTodas() {
    if (citas.length === 0) return;
    const escrito = window.prompt(
      `Vas a borrar las ${citas.length} citas de la barbería (pasadas y futuras). Caja, reportes y sellos de lealtad que salen de ellas quedan en cero.\n\nNo se puede deshacer. Escribe ELIMINAR para confirmar.`
    );
    if (escrito?.trim().toUpperCase() !== "ELIMINAR") return;
    const r = await store.eliminarTodasLasCitas();
    if (!r.ok) window.alert(r.error);
    else setAviso("Se eliminaron todas las citas.");
  }

  async function cambiarEstado(c: Cita, nuevo: EstadoCita, mensaje: string) {
    const r = await store.actualizarCita(c.id, { estado: nuevo });
    if (!r.ok) window.alert(r.error);
    else setAviso(mensaje);
  }

  return (
    <PanelShell sesion={sesion} activo="Citas" onLogout={store.logout}>
      <header className="anim-in mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker">Agenda</p>
          <h1 className="font-display text-2xl font-bold tracking-tight">Citas</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
            Agenda, confirma llegadas, reprograma y registra faltas. Cada llegada confirmada suma una visita a la tarjeta
            del cliente.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {citas.length > 0 && (
            <button type="button" className="btn-linea is-danger" onClick={eliminarTodas}>
              <Trash2 className="h-4 w-4" /> Eliminar todas
            </button>
          )}
          <Link href="/dashboard/admin/confirmar" className="btn-linea">
            <ScanLine className="h-4 w-4" /> Escanear QR
          </Link>
          <button type="button" className="btn-gold px-5 py-2.5 text-sm" onClick={() => setEditor({})}>
            <CalendarPlus className="h-4 w-4" /> Nueva cita
          </button>
        </div>
      </header>

      {aviso && (
        <p className="aviso-ok anim-pop mb-4" role="status">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> {aviso}
        </p>
      )}

      <div className="metric-grid anim-in anim-d1">
        <Metric icono={<CalendarClock />} label="Citas hoy" valor={numero.format(metricas.hoy)} nota={`${metricas.porLlegar} por llegar`} />
        <Metric icono={<CalendarCheck />} label="Llegaron hoy" valor={numero.format(metricas.llegaron)} nota={`${moneda.format(metricas.ingresos)} en servicios`} />
        <Metric icono={<UserX />} label="Faltas hoy" valor={numero.format(metricas.faltas)} nota="Marcadas como no asistió" />
        <Metric icono={<Banknote />} label="Por cobrar hoy" valor={moneda.format(metricas.porCobrar)} nota="Atendidas sin pago" />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <ModuleTabs
          valor={rango}
          onChange={setRango}
          opciones={[
            { id: "hoy", label: "Hoy" },
            { id: "proximas", label: "Próximas" },
            { id: "pasadas", label: "Pasadas" },
            { id: "todas", label: "Todas" },
          ]}
        />
      </div>

      <ModulePanel
        titulo="Agenda"
        descripcion={`${grupos.total} cita${grupos.total === 1 ? "" : "s"}`}
        extra={
          <div className="filtros-citas">
            <label className="relative flex items-center">
              <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5" style={{ color: "var(--ink-faint)" }} />
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar cliente o barbero"
                aria-label="Buscar cita"
                className="campo-input is-sm pl-8"
              />
            </label>
            <select className="campo-input is-sm" value={estado} onChange={(e) => setEstado(e.target.value as EstadoCita | "todas")} aria-label="Filtrar por estado">
              <option value="todas">Todos los estados</option>
              {(Object.keys(ETIQUETA_ESTADO_CITA) as EstadoCita[]).map((e) => (
                <option key={e} value={e}>
                  {ETIQUETA_ESTADO_CITA[e]}
                </option>
              ))}
            </select>
            <select className="campo-input is-sm" value={barbero} onChange={(e) => setBarbero(e.target.value)} aria-label="Filtrar por barbero">
              <option value="todos">Todos los barberos</option>
              {barberos.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nombre}
                </option>
              ))}
            </select>
          </div>
        }
      >
        {grupos.total === 0 ? (
          <EmptyState icono={<CalendarX2 />}>
            {rango === "hoy" ? "No hay citas para hoy con estos filtros." : "No hay citas con estos filtros."}{" "}
            <button type="button" className="underline underline-offset-4" onClick={() => setEditor({})}>
              Agendar una
            </button>
          </EmptyState>
        ) : (
          <div className="space-y-5">
            {grupos.dias.map(([dia, lista]) => (
              <div key={dia}>
                {(() => {
                  const t = resumirCitas(lista);
                  return (
                    <p className="dia-citas">
                      {isToday(new Date(`${dia}T12:00`)) ? "Hoy · " : ""}
                      {format(new Date(`${dia}T12:00`), "EEEE d 'de' MMMM", { locale: es })}
                      <span className="dia-citas-totales">
                        {t.atendidas} atendida{t.atendidas === 1 ? "" : "s"} · {moneda.format(t.ingresos)}
                        {t.porCobrar > 0 && ` · ${moneda.format(t.porCobrar)} por cobrar`}
                        {t.porVenir > 0 && ` · ${t.porVenir} por llegar (${moneda.format(t.agendado)})`}
                      </span>
                    </p>
                  );
                })()}
                <div className="grid gap-2">
                  {lista.map((c) => (
                    <FilaCita
                      key={c.id}
                      cita={c}
                      onLlego={() => cambiarEstado(c, "asistida", `Llegada de ${c.cliente_nombre} confirmada: visita sumada a su tarjeta.`)}
                      onFalta={() => cambiarEstado(c, "no_asistio", `${c.cliente_nombre} quedó como «No asistió».`)}
                      onCancelar={() => {
                        if (window.confirm(`¿Cancelar la cita de ${c.cliente_nombre}?`)) {
                          void cambiarEstado(c, "cancelada", "Cita cancelada.");
                        }
                      }}
                      onCobrar={() => {
                        store.cobrarEfectivo(c.id);
                        setAviso(`Cobro de ${moneda.format(c.precio)} registrado.`);
                      }}
                      onEditar={() => setEditor({ cita: c })}
                      onEliminar={() => void eliminar(c)}
                      onQr={() => setQr(c)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </ModulePanel>

      {editor && (
        <Modal
          titulo={editor.cita ? "Editar cita" : "Nueva cita"}
          descripcion={
            editor.cita
              ? "Reprograma, cambia quién atiende o corrige el estado."
              : "Agenda a nombre de un cliente: mostrador, llamada o WhatsApp."
          }
          onCerrar={() => setEditor(null)}
          ancho="lg"
        >
          <EditorCita
            cita={editor.cita}
            clienteInicial={editor.cliente}
            onCancelar={() => setEditor(null)}
            onListo={(m) => {
              setEditor(null);
              setAviso(m);
            }}
          />
        </Modal>
      )}

      {qr && (
        <Modal titulo="QR de la cita" descripcion="El cliente lo muestra al llegar y se escanea en «Confirmar cita»." onCerrar={() => setQr(null)}>
          <div className="flex flex-col items-center gap-3 text-center">
            <QrCita citaId={qr.id} />
            <p className="font-semibold">{qr.cliente_nombre}</p>
            <p className="text-sm capitalize" style={{ color: "var(--ink-muted)" }}>
              {qr.barbero_nombre} · {format(new Date(qr.inicio), "EEEE d MMM, HH:mm", { locale: es })}
            </p>
            <p className="text-xs" style={{ color: "var(--ink-faint)" }}>
              Código: {qr.id}
              {(() => {
                const t = store.tarjetas.find((x) => x.cliente_id === qr.cliente_id);
                return t ? ` · Tarjeta: ${t.numero}` : "";
              })()}
            </p>
            <BotonGuardarQr
              datos={{
                contenido: enlaceDeCita(qr.id, window.location.origin),
                titulo: nombreDelNegocio(store.barberiaConfig),
                subtitulo: "Cita",
                codigo: qr.id,
                detalles: [
                  qr.cliente_nombre,
                  `${qr.barbero_nombre} · ${format(new Date(qr.inicio), "d MMM yyyy, HH:mm 'h'", { locale: es })}`,
                  ...(() => {
                    const t = store.tarjetas.find((x) => x.cliente_id === qr.cliente_id);
                    return t ? [`Tarjeta de lealtad ${t.numero}`] : [];
                  })(),
                ],
                archivo: `cita-${qr.id}`,
              }}
            />
          </div>
        </Modal>
      )}
    </PanelShell>
  );
}

function FilaCita({
  cita: c,
  onLlego,
  onFalta,
  onCancelar,
  onCobrar,
  onEditar,
  onEliminar,
  onQr,
}: {
  cita: Cita;
  onLlego: () => void;
  onFalta: () => void;
  onCancelar: () => void;
  onCobrar: () => void;
  onEditar: () => void;
  onEliminar: () => void;
  onQr: () => void;
}) {
  const pasada = new Date(c.fin).getTime() < Date.now();
  return (
    <article className={`fila-cita estado-${c.estado}`}>
      <div className="fila-cita-hora">
        <strong>{format(new Date(c.inicio), "HH:mm")}</strong>
        <small>{format(new Date(c.fin), "HH:mm")}</small>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold" style={{ color: "var(--ink)" }}>
          {c.cliente_nombre}
        </p>
        <p className="truncate text-xs" style={{ color: "var(--ink-muted)" }}>
          {c.servicio_nombre ? `${c.servicio_nombre} · ` : ""}
          {c.barbero_nombre}
          {c.modalidad === "domicilio" && (
            <>
              {" · "}
              <Home className="inline h-3 w-3" /> Domicilio
            </>
          )}
          {" · "}
          {moneda.format(c.precio)}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <span className={`badge ${TONO_ESTADO[c.estado]}`}>
            {ETIQUETA_ESTADO_CITA[c.estado]}
            {c.estado === "asistida" && c.llegada_en ? ` · ${format(new Date(c.llegada_en), "HH:mm")}` : ""}
          </span>
          {c.estado !== "cancelada" && c.estado !== "no_asistio" && (
            <span className={`badge ${c.estado_pago === "pagado" ? "badge-gold" : "badge-neutral"}`}>
              {c.estado_pago === "pagado" ? "Pagada" : "Sin pagar"}
            </span>
          )}
          {c.estado === "confirmada" && pasada && <span className="badge badge-warm">Hora pasada</span>}
        </div>
        {c.notas && <p className="fila-cita-nota">{c.notas}</p>}
      </div>
      <div className="fila-cita-acciones">
        {c.estado === "confirmada" && (
          <>
            <button type="button" className="btn-gold is-sm" onClick={onLlego}>
              <CheckCircle2 className="h-4 w-4" /> Llegó
            </button>
            <button type="button" className="btn-linea is-sm" onClick={onFalta} title="Marcar que no asistió">
              <UserX className="h-4 w-4" /> No vino
            </button>
          </>
        )}
        {c.estado === "asistida" && c.estado_pago === "pendiente" && (
          <button type="button" className="btn-gold is-sm" onClick={onCobrar}>
            <Banknote className="h-4 w-4" /> Cobrar
          </button>
        )}
        <button type="button" className="btn-icono" onClick={onEditar} aria-label="Editar o reprogramar" title="Editar o reprogramar">
          <Pencil className="h-4 w-4" />
        </button>
        {c.estado === "confirmada" && (
          <>
            <button type="button" className="btn-icono" onClick={onQr} aria-label="Ver QR" title="Ver QR">
              <QrCode className="h-4 w-4" />
            </button>
            <button type="button" className="btn-icono is-danger" onClick={onCancelar} aria-label="Cancelar cita" title="Cancelar cita">
              <XCircle className="h-4 w-4" />
            </button>
          </>
        )}
        <button type="button" className="btn-icono is-danger" onClick={onEliminar} aria-label="Eliminar cita" title="Eliminar cita">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}
