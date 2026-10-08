"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Check, Home, Loader2, MapPin, Search, UserPlus } from "lucide-react";
import { Campo, Interruptor } from "@/components/panel/Modal";
import { FormularioCliente } from "@/components/citas/FormularioCliente";
import { slotsDisponibles } from "@/lib/datos/disponibilidad";
import { ETIQUETA_ESTADO_CITA, useBarberia, type Cita, type EstadoCita } from "@/lib/store";

const ESTADOS: EstadoCita[] = ["confirmada", "asistida", "no_asistio", "cancelada"];

/**
 * Formulario único para agendar una cita desde el mostrador o para editarla:
 * reprogramar, cambiar quién atiende, marcar si asistió y ajustar el cobro.
 */
export function EditorCita({
  cita,
  clienteInicial,
  onListo,
  onCancelar,
}: {
  /** Sin cita: alta nueva. Con cita: edición. */
  cita?: Cita;
  clienteInicial?: string;
  onListo: (mensaje: string) => void;
  onCancelar: () => void;
}) {
  const store = useBarberia();
  const { clientes, barberos, citas, barberiaConfig, horarioDeBarbero, sesion } = store;
  const esAdmin = sesion?.rol === "admin";

  const [clienteId, setClienteId] = useState(cita?.cliente_id ?? clienteInicial ?? "");
  const [busqueda, setBusqueda] = useState("");
  const [nuevoCliente, setNuevoCliente] = useState(false);
  const [barberoId, setBarberoId] = useState(
    cita?.barbero_id ?? (sesion?.rol === "barbero" ? sesion.id : barberos.find((b) => b.activo)?.id ?? "")
  );
  const inicioBase = cita ? new Date(cita.inicio) : null;
  const [fecha, setFecha] = useState(format(inicioBase ?? new Date(), "yyyy-MM-dd"));
  const [hora, setHora] = useState(inicioBase ? format(inicioBase, "HH:mm") : "");
  const barbero = barberos.find((b) => b.id === barberoId);
  const [modalidad, setModalidad] = useState<"presencial" | "domicilio">(cita?.modalidad ?? "presencial");
  const [direccion, setDireccion] = useState(cita?.direccion_domicilio ?? "");
  const [precio, setPrecio] = useState<string>(cita ? String(cita.precio) : "");
  const [estado, setEstado] = useState<EstadoCita>(cita?.estado ?? "confirmada");
  const [pagado, setPagado] = useState(cita?.estado_pago === "pagado");
  const [notas, setNotas] = useState(cita?.notas ?? "");
  const [forzar, setForzar] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const cliente = clientes.find((c) => c.id === clienteId);
  const coincidencias = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const digitos = q.replace(/\D/g, "");
    return clientes
      .filter(
        (c) =>
          !q ||
          c.nombre.toLowerCase().includes(q) ||
          (digitos.length >= 3 && c.telefono.replace(/\D/g, "").includes(digitos)) ||
          c.email.toLowerCase().includes(q)
      )
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
      .slice(0, 8);
  }, [clientes, busqueda]);

  // Horas libres del barbero el día elegido (sin contar esta misma cita).
  const libres = useMemo(() => {
    if (!barbero || !fecha) return [];
    const inicioDia = new Date(`${fecha}T00:00`).getTime();
    if (!Number.isFinite(inicioDia)) return [];
    const otras = citas.filter((c) => c.id !== cita?.id);
    return slotsDisponibles(
      { barbero: { ...barbero, activo: true }, horario: horarioDeBarbero(barbero.id), barberia: barberiaConfig, citas: otras },
      inicioDia,
      1
    ).filter((d) => d.getTime() > Date.now() - 5 * 60_000 && format(d, "yyyy-MM-dd") === fecha);
  }, [barbero, fecha, citas, cita?.id, horarioDeBarbero, barberiaConfig]);

  if (nuevoCliente) {
    return (
      <div>
        <p className="mb-3 text-sm" style={{ color: "var(--ink-muted)" }}>
          Registra al cliente y regresas a la cita con él ya elegido.
        </p>
        <FormularioCliente
          onCancelar={() => setNuevoCliente(false)}
          onListo={(c) => {
            setClienteId(c.id);
            setNuevoCliente(false);
          }}
        />
      </div>
    );
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!clienteId) return setError("Elige al cliente.");
    if (!barbero) return setError("Elige quién lo atiende.");
    if (!fecha || !hora) return setError("Elige el día y la hora.");
    const inicio = new Date(`${fecha}T${hora}`);
    if (!Number.isFinite(inicio.getTime())) return setError("La fecha u hora no es válida.");
    const precioNum = precio.trim() === "" ? undefined : Number(precio);
    if (precioNum !== undefined && (!Number.isFinite(precioNum) || precioNum < 0)) return setError("El precio no es válido.");
    if (modalidad === "domicilio" && direccion.trim().length < 5) return setError("Escribe la dirección del domicilio.");

    setGuardando(true);
    if (!cita) {
      const r = await store.crearCitaPersonal({
        cliente_id: clienteId,
        barbero_id: barbero.id,
        inicio: inicio.toISOString(),
        modalidad,
        direccion_domicilio: direccion.trim(),
        precio: precioNum,
        notas: notas.trim(),
        forzar,
      });
      setGuardando(false);
      if (!r.ok) return setError(r.error ?? "No se pudo agendar.");
      onListo(`Cita agendada: ${cliente?.nombre} con ${barbero.nombre}, ${format(inicio, "dd/MM HH:mm")}.`);
      return;
    }

    const cambios: Parameters<typeof store.actualizarCita>[1] = {};
    if (inicio.toISOString() !== new Date(cita.inicio).toISOString()) cambios.inicio = inicio.toISOString();
    if (barbero.id !== cita.barbero_id) cambios.barbero_id = barbero.id;
    if (estado !== cita.estado) cambios.estado = estado;
    if (esAdmin && precioNum !== undefined && precioNum !== cita.precio) cambios.precio = precioNum;
    if (pagado !== (cita.estado_pago === "pagado")) cambios.estado_pago = pagado ? "pagado" : "pendiente";
    if (notas.trim() !== (cita.notas ?? "")) cambios.notas = notas.trim();
    if (modalidad !== cita.modalidad) cambios.modalidad = modalidad;
    if (modalidad === "domicilio" && direccion.trim() !== (cita.direccion_domicilio ?? "")) {
      cambios.direccion_domicilio = direccion.trim();
    }
    if (Object.keys(cambios).length === 0) {
      setGuardando(false);
      return onCancelar();
    }
    const r = await store.actualizarCita(cita.id, cambios, forzar);
    setGuardando(false);
    if (!r.ok) return setError(r.error ?? "No se pudo guardar.");
    onListo(cambios.inicio ? `Cita reprogramada para el ${format(inicio, "dd/MM 'a las' HH:mm")}.` : "Cita actualizada.");
  }

  const sugerirForzar = esAdmin && /ya tiene una cita|desactivado|fuera de/i.test(error);

  return (
    <form onSubmit={guardar} className="form-grid">
      {/* Cliente */}
      {cita ? (
        <div className="cita-cliente-fijo is-full">
          <span className="client-avatar">{cita.cliente_nombre.charAt(0)}</span>
          <div className="min-w-0">
            <p className="truncate font-semibold">{cita.cliente_nombre}</p>
            <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
              {cliente?.telefono || "Sin teléfono"}
            </p>
          </div>
        </div>
      ) : (
        <div className="is-full">
          <span className="campo-label">Cliente</span>
          {cliente ? (
            <div className="cita-cliente-fijo mt-1.5">
              <span className="client-avatar">{cliente.nombre.charAt(0)}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{cliente.nombre}</p>
                <p className="text-xs" style={{ color: "var(--ink-muted)" }}>{cliente.telefono || cliente.email || "Sin contacto"}</p>
              </div>
              <button type="button" className="btn-linea is-sm" onClick={() => setClienteId("")}>
                Cambiar
              </button>
            </div>
          ) : (
            <div className="selector-cliente mt-1.5">
              <label className="relative flex items-center">
                <Search className="pointer-events-none absolute left-3 h-4 w-4" style={{ color: "var(--ink-faint)" }} />
                <input
                  className="campo-input pl-9"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar por nombre, teléfono o correo"
                  aria-label="Buscar cliente"
                  autoComplete="off"
                />
              </label>
              <ul>
                {coincidencias.map((c) => (
                  <li key={c.id}>
                    <button type="button" onClick={() => setClienteId(c.id)}>
                      <span className="client-avatar is-sm">{c.nombre.charAt(0)}</span>
                      <span className="min-w-0 flex-1 truncate">{c.nombre}</span>
                      <span className="text-xs" style={{ color: "var(--ink-faint)" }}>{c.telefono}</span>
                    </button>
                  </li>
                ))}
                {coincidencias.length === 0 && (
                  <li className="selector-vacio">{clientes.length === 0 ? "Aún no hay clientes registrados." : "Nadie coincide."}</li>
                )}
              </ul>
              <button type="button" className="btn-linea mt-2 w-full justify-center" onClick={() => setNuevoCliente(true)}>
                <UserPlus className="h-4 w-4" /> Registrar cliente nuevo
              </button>
            </div>
          )}
        </div>
      )}

      <Campo label={cita ? "¿Quién atiende?" : "Barbero"} ayuda={cita && !esAdmin ? "Sólo el administrador puede reasignarla." : undefined}>
        <select
          className="campo-input"
          value={barberoId}
          onChange={(e) => {
            setBarberoId(e.target.value);
            if (!cita) setPrecio("");
          }}
          disabled={Boolean(cita) && !esAdmin}
        >
          <option value="" disabled>
            Elige un barbero
          </option>
          {barberos
            .filter((b) => b.activo || b.id === barberoId)
            .filter((b) => esAdmin || b.id === sesion?.id || b.id === cita?.barbero_id)
            .map((b) => (
              <option key={b.id} value={b.id}>
                {b.nombre}
                {!b.activo ? " (inactivo)" : ""}
              </option>
            ))}
        </select>
      </Campo>

      <Campo label="Precio" ayuda={barbero ? `Precio de ${barbero.nombre}: $${barbero.precio_servicio}` : undefined}>
        <input
          className="campo-input"
          type="number"
          inputMode="numeric"
          min={0}
          value={precio}
          onChange={(e) => setPrecio(e.target.value)}
          placeholder={barbero ? String(barbero.precio_servicio) : "0"}
          disabled={!esAdmin}
        />
      </Campo>

      <Campo label="Día">
        <input className="campo-input" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
      </Campo>
      <Campo label="Hora">
        <input className="campo-input" type="time" step={300} value={hora} onChange={(e) => setHora(e.target.value)} required />
      </Campo>

      {barbero && fecha && (
        <div className="is-full">
          <span className="campo-label">Horas libres de {barbero.nombre.split(" ")[0]}</span>
          {libres.length === 0 ? (
            <p className="campo-ayuda mt-1">
              Sin horas libres ese día según su horario.{esAdmin ? " Puedes escribir la hora a mano y activar «Ignorar horario»." : ""}
            </p>
          ) : (
            <div className="chips-horas">
              {libres.map((d) => {
                const hh = format(d, "HH:mm");
                return (
                  <button key={hh} type="button" className={hh === hora ? "is-active" : ""} onClick={() => setHora(hh)}>
                    {hh}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {(barbero?.acepta_domicilio || modalidad === "domicilio") && (
        <div className="is-full">
          <span className="campo-label">Modalidad</span>
          <div className="segmentado mt-1.5">
            {(["presencial", "domicilio"] as const).map((m) => (
              <button key={m} type="button" className={modalidad === m ? "is-active" : ""} onClick={() => setModalidad(m)}>
                {m === "presencial" ? <MapPin className="h-4 w-4" /> : <Home className="h-4 w-4" />}
                {m === "presencial" ? "En barbería" : "A domicilio"}
              </button>
            ))}
          </div>
          {modalidad === "domicilio" && (
            <input
              className="campo-input mt-2"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              placeholder="Dirección completa"
            />
          )}
        </div>
      )}

      {cita && (
        <div className="is-full">
          <span className="campo-label">Estado de la cita</span>
          <div className="segmentado is-4 mt-1.5">
            {ESTADOS.map((e) => (
              <button key={e} type="button" className={`${estado === e ? "is-active" : ""} estado-${e}`} onClick={() => setEstado(e)}>
                {ETIQUETA_ESTADO_CITA[e]}
              </button>
            ))}
          </div>
          {estado === "asistida" && cita.estado !== "asistida" && (
            <p className="campo-ayuda mt-1.5">Al guardar se le suma una visita a su tarjeta de lealtad.</p>
          )}
          {cita.estado === "asistida" && estado !== "asistida" && (
            <p className="campo-ayuda mt-1.5">Se le quitará el sello de esta visita en su tarjeta.</p>
          )}
        </div>
      )}

      {cita && (
        <div className="is-full">
          <Interruptor activo={pagado} onChange={setPagado} label="Pagada" ayuda="Marca si ya se cobró en caja." />
        </div>
      )}

      <Campo label="Notas internas (opcional)" ancho="completo">
        <textarea
          className="campo-input"
          rows={2}
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Ej. Pidió cambiar de hora por WhatsApp"
        />
      </Campo>

      {esAdmin && (
        <div className="is-full">
          <Interruptor
            activo={forzar}
            onChange={setForzar}
            label="Ignorar horario y choques"
            ayuda="Permite agendar fuera del horario del barbero o encima de otra cita."
          />
        </div>
      )}

      {error && (
        <p className="form-error is-full" role="alert">
          {error}
          {sugerirForzar && !forzar && " Activa «Ignorar horario y choques» si quieres agendarla de todos modos."}
        </p>
      )}

      <div className="form-acciones is-full">
        <button type="button" className="btn-linea" onClick={onCancelar}>
          Cancelar
        </button>
        <button type="submit" className="btn-gold px-5 py-2.5 text-sm" disabled={guardando}>
          {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {cita ? "Guardar cambios" : "Agendar cita"}
        </button>
      </div>
    </form>
  );
}
