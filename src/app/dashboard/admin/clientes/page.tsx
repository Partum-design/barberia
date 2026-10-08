"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertTriangle,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  Mail,
  Pencil,
  Phone,
  Repeat,
  Trash2,
  Search,
  TrendingUp,
  UserPlus,
  UserRound,
  Users,
} from "lucide-react";
import { Modal } from "@/components/panel/Modal";
import { FormularioCliente } from "@/components/citas/FormularioCliente";
import { PanelShell } from "@/components/shell/PanelShell";
import {
  EmptyState,
  Metric,
  ModulePanel,
  ModuleTabs,
  ShareBar,
  SinAcceso,
  moneda,
  numero,
  porcentaje,
} from "@/components/panel/ModuleUI";
import { calcularLealtad, resumirClientes, useBarberia, type Cliente, type ClienteResumen } from "@/lib/store";

type Filtro = "todos" | "riesgo" | "vip" | "proximos" | "nuevos";

type Fila = ClienteResumen & { registro?: Cliente };

const fecha = (iso: string | null) =>
  iso ? format(new Date(iso), "d MMM yyyy", { locale: es }) : "—";

/**
 * CRM de la barbería. Las cifras (gasto, visitas, cadencia) salen del
 * historial de citas; los datos de contacto, de la ficha de cliente que se da
 * de alta aquí o al registrarse. Quien está dado de alta pero aún no viene
 * aparece igual, con sus cifras en cero.
 */
export default function ClientesPage() {
  const store = useBarberia();
  const { listo, sesion, citas, recompensasConfig, tarjetas, clientes: registros } = store;
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busqueda, setBusqueda] = useState("");
  const [editando, setEditando] = useState<{ cliente?: Cliente } | null>(null);
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    if (!aviso) return;
    const t = window.setTimeout(() => setAviso(""), 5000);
    return () => window.clearTimeout(t);
  }, [aviso]);

  const clientes = useMemo<Fila[]>(() => {
    const resumen = resumirClientes(citas);
    const porId = new Map(registros.map((r) => [r.id, r]));
    const filas: Fila[] = resumen.map((r) => {
      const registro = porId.get(r.id);
      return { ...r, nombre: registro?.nombre || r.nombre, registro };
    });
    const conCitas = new Set(resumen.map((r) => r.id));
    for (const r of registros) {
      if (conCitas.has(r.id)) continue;
      filas.push({
        id: r.id,
        nombre: r.nombre,
        visitas: 0,
        faltas: 0,
        gastoTotal: 0,
        pagado: 0,
        ticketMedio: 0,
        ultimaVisita: null,
        proximaCita: null,
        barberoPreferido: "—",
        diasDesdeUltima: null,
        cadenciaDias: null,
        enRiesgo: false,
        registro: r,
      });
    }
    return filas;
  }, [citas, registros]);

  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    const digitos = texto.replace(/\D/g, "");
    return clientes
      .filter((c) =>
        texto
          ? c.nombre.toLowerCase().includes(texto) ||
            (c.registro?.email ?? "").toLowerCase().includes(texto) ||
            (digitos.length >= 3 && (c.registro?.telefono ?? "").replace(/\D/g, "").includes(digitos))
          : true
      )
      .filter((c) => {
        if (filtro === "riesgo") return c.enRiesgo;
        if (filtro === "vip") return c.visitas >= 3;
        if (filtro === "proximos") return Boolean(c.proximaCita);
        if (filtro === "nuevos") return c.visitas === 0;
        return true;
      })
      .sort((a, b) =>
        filtro === "nuevos"
          ? (b.registro?.creado_en ?? "").localeCompare(a.registro?.creado_en ?? "")
          : b.gastoTotal - a.gastoTotal || a.nombre.localeCompare(b.nombre)
      );
  }, [clientes, filtro, busqueda]);

  const totales = useMemo(() => {
    const gasto = clientes.reduce((a, c) => a + c.gastoTotal, 0);
    const recurrentes = clientes.filter((c) => c.visitas > 1).length;
    return {
      total: clientes.length,
      gasto,
      ticket: clientes.length > 0 ? Math.round(gasto / Math.max(1, clientes.reduce((a, c) => a + c.visitas, 0))) : 0,
      recurrencia: clientes.length > 0 ? recurrentes / clientes.length : 0,
      riesgo: clientes.filter((c) => c.enRiesgo).length,
    };
  }, [clientes]);

  if (!listo) return null;
  if (!sesion || sesion.rol !== "admin") return <SinAcceso mensaje="Este módulo es del administrador" />;

  async function eliminar(c: Fila) {
    const pendientes = c.proximaCita ? "\n\nSus citas por venir se cancelarán." : "";
    if (
      !window.confirm(
        `¿Eliminar a ${c.nombre}?\n\nSe borran su ficha, su tarjeta de lealtad y su acceso (si tiene). Sus visitas ya atendidas se conservan en caja y reportes.${pendientes}`
      )
    )
      return;
    const r = await store.eliminarCliente(c.id);
    if (!r.ok) window.alert(r.error);
    else setAviso(`${c.nombre} fue eliminado.`);
  }

  const gastoMaximo = Math.max(1, ...clientes.map((c) => c.gastoTotal));

  return (
    <PanelShell sesion={sesion} activo="Clientes" onLogout={store.logout}>
      <header className="anim-in mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker">Relación con el cliente</p>
          <h1 className="font-display text-2xl font-bold tracking-tight">Clientes</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
            Da de alta clientes, corrige sus datos y agenda desde aquí. Cada ficha muestra su gasto, frecuencia y
            barbero de confianza.
          </p>
        </div>
        <button type="button" className="btn-gold px-5 py-2.5 text-sm" onClick={() => setEditando({})}>
          <UserPlus className="h-4 w-4" /> Nuevo cliente
        </button>
      </header>

      {aviso && (
        <p className="aviso-ok anim-pop mb-4" role="status">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> {aviso}
        </p>
      )}

      <div className="metric-grid anim-in anim-d1">
        <Metric icono={<Users />} label="Clientes" valor={numero.format(totales.total)} nota={`${totales.riesgo} en riesgo de fuga`} />
        <Metric icono={<TrendingUp />} label="Consumo" valor={moneda.format(totales.gasto)} nota="Servicios atendidos" />
        <Metric icono={<CalendarClock />} label="Ticket medio" valor={moneda.format(totales.ticket)} nota="Por visita atendida" />
        <Metric icono={<Repeat />} label="Recurrencia" valor={porcentaje(totales.recurrencia, 0)} nota="Clientes con más de una visita" />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <ModuleTabs
          valor={filtro}
          onChange={setFiltro}
          opciones={[
            { id: "todos", label: "Todos" },
            { id: "vip", label: "Recurrentes" },
            { id: "proximos", label: "Con cita próxima" },
            { id: "riesgo", label: "En riesgo" },
            { id: "nuevos", label: "Sin visitas" },
          ]}
        />
      </div>

      <ModulePanel
        titulo="Cartera"
        descripcion={`${visibles.length} de ${clientes.length} clientes`}
        extra={
          <label className="relative flex items-center">
            <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5" style={{ color: "var(--ink-faint)" }} />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Nombre, teléfono o correo"
              aria-label="Buscar cliente"
              className="campo-input is-sm w-56 pl-8"
            />
          </label>
        }
      >
        {visibles.length === 0 ? (
          <EmptyState icono={<UserRound />}>
            {clientes.length === 0 ? "Aún no hay clientes. " : "Ningún cliente coincide con este filtro. "}
            <button type="button" className="underline underline-offset-4" onClick={() => setEditando({})}>
              Dar de alta uno
            </button>
          </EmptyState>
        ) : (
          <div className="grid gap-2">
            {visibles.map((c) => {
              const tarjeta = tarjetas.find((t) => t.cliente_id === c.id);
              const lealtad = calcularLealtad(
                citas,
                c.id,
                recompensasConfig.citas_requeridas,
                tarjeta?.sellos_extra ?? 0
              );
              return (
                <article key={c.id} className="client-row">
                  <span className="client-avatar">{c.nombre.charAt(0)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold" style={{ color: "var(--ink)" }}>
                      {c.nombre}
                      {c.enRiesgo && (
                        <span className="badge badge-warm ml-2 align-middle">
                          <AlertTriangle /> {c.diasDesdeUltima} días sin volver
                        </span>
                      )}
                    </p>
                    {(c.registro?.telefono || c.registro?.email) && (
                      <p className="mt-0.5 flex flex-wrap gap-x-3 text-[0.7rem]" style={{ color: "var(--ink-muted)" }}>
                        {c.registro?.telefono && (
                          <a href={`tel:${c.registro.telefono.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {c.registro.telefono}
                          </a>
                        )}
                        {c.registro?.email && (
                          <span className="inline-flex min-w-0 items-center gap-1 truncate">
                            <Mail className="h-3 w-3" /> {c.registro.email}
                          </span>
                        )}
                      </p>
                    )}
                    <p className="mt-0.5 text-[0.68rem]" style={{ color: "var(--ink-muted)" }}>
                      {c.visitas === 0
                        ? `Sin visitas todavía${c.registro ? ` · alta ${fecha(c.registro.creado_en)}` : ""}`
                        : `${c.visitas} visita${c.visitas === 1 ? "" : "s"} · última ${fecha(c.ultimaVisita)} · barbero de confianza: ${c.barberoPreferido}`}
                      {c.faltas > 0 && ` · ${c.faltas} falta${c.faltas === 1 ? "" : "s"}`}
                      {c.cadenciaDias !== null && ` · vuelve cada ~${c.cadenciaDias} días`}
                      {c.proximaCita && ` · próxima cita ${fecha(c.proximaCita)}`}
                    </p>
                    <div className="mt-1.5 max-w-56">
                      <ShareBar valor={c.gastoTotal / gastoMaximo} tono={c.enRiesgo ? "ox" : "oro"} />
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-num text-sm font-semibold" style={{ color: "var(--ink)" }}>
                      {moneda.format(c.gastoTotal)}
                    </p>
                    <p className="text-[0.62rem]" style={{ color: "var(--ink-faint)" }}>
                      {c.gastoTotal > c.pagado ? `debe ${moneda.format(c.gastoTotal - c.pagado)}` : `ticket ${moneda.format(c.ticketMedio)}`}
                    </p>
                    <p className="mt-1 text-[0.62rem]" style={{ color: "var(--gold)" }}>
                      {tarjeta ? `${tarjeta.numero} · ` : ""}lealtad {lealtad.progreso}/{lealtad.requerido}
                    </p>
                    <div className="mt-2 flex justify-end gap-1.5">
                      <Link
                        href={`/dashboard/admin/citas?nueva=${encodeURIComponent(c.id)}`}
                        className="btn-icono"
                        aria-label={`Agendar cita a ${c.nombre}`}
                        title="Agendar cita"
                      >
                        <CalendarPlus className="h-4 w-4" />
                      </Link>
                      <button
                        type="button"
                        className="btn-icono"
                        aria-label={`Editar a ${c.nombre}`}
                        title="Editar datos"
                        onClick={() =>
                          setEditando({
                            cliente: c.registro ?? { id: c.id, nombre: c.nombre, telefono: "", email: "", creado_en: new Date().toISOString() },
                          })
                        }
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="btn-icono is-danger"
                        aria-label={`Eliminar a ${c.nombre}`}
                        title="Eliminar cliente"
                        onClick={() => void eliminar(c)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </ModulePanel>

      {editando && (
        <Modal
          titulo={editando.cliente ? "Editar cliente" : "Nuevo cliente"}
          descripcion={editando.cliente ? "Corrige su nombre o datos de contacto." : "Alta desde mostrador. Se le emite su tarjeta de lealtad."}
          onCerrar={() => setEditando(null)}
        >
          <FormularioCliente
            cliente={editando.cliente}
            onCancelar={() => setEditando(null)}
            onListo={(cli) => {
              setEditando(null);
              setAviso(editando.cliente ? `Datos de ${cli.nombre} actualizados.` : `${cli.nombre} dado de alta con su tarjeta de lealtad.`);
            }}
          />
        </Modal>
      )}
    </PanelShell>
  );
}
