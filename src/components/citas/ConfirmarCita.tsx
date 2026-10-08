"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format, isSameDay, isToday } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertTriangle,
  CalendarPlus,
  CheckCircle2,
  Gift,
  Keyboard,
  Loader2,
  ScanLine,
  Stamp,
  XCircle,
} from "lucide-react";
import { EscanerQR } from "@/components/citas/EscanerQR";
import {
  calcularLealtad,
  ETIQUETA_ESTADO_CITA,
  idDeCitaEnTexto,
  useBarberia,
  type Cita,
} from "@/lib/store";

type Resultado =
  | { tipo: "confirmada"; cita: Cita; yaEstaba: boolean }
  | { tipo: "revisar"; cita: Cita; motivo: string }
  | { tipo: "tarjeta"; clienteId: string; tarjetaId: string; citasHoy: Cita[] }
  | { tipo: "error"; mensaje: string };

const hora = (iso: string) => format(new Date(iso), "HH:mm");

/**
 * Mostrador de llegadas. Se escanea el QR de la cita (o el de la tarjeta de
 * lealtad) y la llegada queda confirmada al instante: la cita pasa a
 * «Asistió» y eso le pone el sello en su tarjeta. Si el código es de otro día
 * o de una cita cancelada, se pide confirmación en lugar de hacerlo a ciegas.
 */
export function ConfirmarCita({ citaInicial }: { citaInicial?: string | null }) {
  const store = useBarberia();
  const { citas, clientes, tarjetas, recompensasConfig, canjes, sesion } = store;
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [manual, setManual] = useState("");
  const [camara, setCamara] = useState(true);
  const inicialHecha = useRef(false);

  // El escáner llama con el estado más reciente aunque su efecto no se rehaga.
  const citasRef = useRef(citas);
  citasRef.current = citas;

  const confirmar = useCallback(
    async (cita: Cita) => {
      setProcesando(true);
      const r = await store.confirmarLlegada(cita.id);
      setProcesando(false);
      if (!r.ok) {
        setResultado({ tipo: "error", mensaje: r.error ?? "No se pudo confirmar." });
        return;
      }
      navigator.vibrate?.([60, 40, 120]);
      setResultado({ tipo: "confirmada", cita, yaEstaba: false });
    },
    [store]
  );

  const procesar = useCallback(
    async (texto: string) => {
      const lista = citasRef.current;
      const limpio = texto.trim();
      if (!limpio) return;

      const citaId = idDeCitaEnTexto(limpio);
      if (citaId) {
        const cita = lista.find((c) => c.id === citaId);
        if (!cita) {
          setResultado({ tipo: "error", mensaje: "Ese código no corresponde a ninguna cita de esta barbería." });
          return;
        }
        if (cita.estado === "asistida") {
          setResultado({ tipo: "confirmada", cita, yaEstaba: true });
          return;
        }
        if (cita.estado === "cancelada" || cita.estado === "no_asistio") {
          setResultado({
            tipo: "revisar",
            cita,
            motivo: `Esta cita está marcada como «${ETIQUETA_ESTADO_CITA[cita.estado]}».`,
          });
          return;
        }
        if (!isToday(new Date(cita.inicio))) {
          setResultado({
            tipo: "revisar",
            cita,
            motivo: `La cita es para el ${format(new Date(cita.inicio), "EEEE d 'de' MMMM", { locale: es })}, no para hoy.`,
          });
          return;
        }
        await confirmar(cita);
        return;
      }

      // QR de la tarjeta de lealtad (LC-0000-0000) o el número dictado.
      const numero = limpio.toUpperCase().replace(/\s+/g, "");
      const tarjeta = store.tarjetas.find(
        (t) => t.numero === numero || t.numero.replace(/-/g, "") === numero.replace(/-/g, "")
      );
      if (tarjeta) {
        const citasHoy = lista
          .filter((c) => c.cliente_id === tarjeta.cliente_id && c.estado === "confirmada" && isToday(new Date(c.inicio)))
          .sort((a, b) => a.inicio.localeCompare(b.inicio));
        if (citasHoy.length === 1) {
          await confirmar(citasHoy[0]);
          return;
        }
        setResultado({ tipo: "tarjeta", clienteId: tarjeta.cliente_id, tarjetaId: tarjeta.id, citasHoy });
        return;
      }

      setResultado({ tipo: "error", mensaje: "No reconozco ese código. Escanea el QR de la cita o de la tarjeta de lealtad." });
    },
    [confirmar, store.tarjetas]
  );

  // Llegada por enlace (?cita=...): se procesa una sola vez cuando hay datos.
  useEffect(() => {
    if (!citaInicial || inicialHecha.current || citas.length === 0) return;
    inicialHecha.current = true;
    void procesar(citaInicial);
  }, [citaInicial, citas.length, procesar]);

  const pendientesHoy = useMemo(
    () =>
      citas
        .filter(
          (c) =>
            c.estado === "confirmada" &&
            isSameDay(new Date(c.inicio), new Date()) &&
            (sesion?.rol === "admin" || c.barbero_id === sesion?.id)
        )
        .sort((a, b) => a.inicio.localeCompare(b.inicio)),
    [citas, sesion]
  );
  const llegadasHoy = useMemo(
    () =>
      citas
        .filter((c) => c.estado === "asistida" && c.llegada_en && isToday(new Date(c.llegada_en)))
        .sort((a, b) => (b.llegada_en ?? "").localeCompare(a.llegada_en ?? ""))
        .slice(0, 6),
    [citas]
  );

  function lealtadDe(clienteId: string) {
    const tarjeta = tarjetas.find((t) => t.cliente_id === clienteId);
    const l = calcularLealtad(citas, clienteId, recompensasConfig.citas_requeridas, tarjeta?.sellos_extra ?? 0);
    return { ...l, tarjeta, disponibles: Math.max(0, l.recompensasGanadas - (canjes[clienteId] ?? 0)) };
  }

  return (
    <div className="confirmar-grid">
      <section className="module-panel confirmar-escaner">
        <div className="module-panel-head">
          <div>
            <p>Escanear código</p>
            <span>QR de la cita o de la tarjeta de lealtad</span>
          </div>
          <button type="button" className="btn-linea is-sm" onClick={() => setCamara((v) => !v)}>
            {camara ? <Keyboard className="h-4 w-4" /> : <ScanLine className="h-4 w-4" />}
            {camara ? "Escribir código" : "Usar cámara"}
          </button>
        </div>

        {camara && <EscanerQR onLeer={procesar} pausado={procesando || resultado?.tipo === "revisar"} />}

        <form
          className="confirmar-manual"
          onSubmit={(e) => {
            e.preventDefault();
            void procesar(manual);
            setManual("");
          }}
        >
          <input
            className="campo-input"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="Número de tarjeta (LC-…) o código de cita"
            aria-label="Código manual"
            autoComplete="off"
          />
          <button type="submit" className="btn-gold px-4 text-sm" disabled={!manual.trim()}>
            Buscar
          </button>
        </form>
      </section>

      <div className="space-y-4">
        <div aria-live="polite">
          {procesando && (
            <div className="resultado-escaneo">
              <Loader2 className="h-6 w-6 animate-spin" /> Confirmando…
            </div>
          )}
          {!procesando && resultado && (
            <ResultadoEscaneo
              resultado={resultado}
              lealtadDe={lealtadDe}
              nombreDe={(id) => clientes.find((c) => c.id === id)?.nombre ?? "Cliente"}
              onConfirmar={confirmar}
              onForzar={async (cita) => {
                setProcesando(true);
                const r = await store.actualizarCita(cita.id, { estado: "asistida" });
                setProcesando(false);
                setResultado(r.ok ? { tipo: "confirmada", cita, yaEstaba: false } : { tipo: "error", mensaje: r.error ?? "No se pudo confirmar." });
              }}
              onSello={(tarjetaId, clienteId) => {
                if (store.ajustarSellos(tarjetaId, 1)) {
                  setResultado({
                    tipo: "confirmada",
                    cita: {
                      id: "",
                      cliente_id: clienteId,
                      cliente_nombre: clientes.find((c) => c.id === clienteId)?.nombre ?? "Cliente",
                      barbero_id: "",
                      barbero_nombre: "Visita sin cita",
                      especialidad: "",
                      inicio: new Date().toISOString(),
                      fin: new Date().toISOString(),
                      modalidad: "presencial",
                      estado: "asistida",
                      precio: 0,
                      direccion_domicilio: null,
                      metodo_pago: "efectivo",
                      estado_pago: "pendiente",
                    },
                    yaEstaba: false,
                  });
                }
              }}
              onCerrar={() => setResultado(null)}
              puedeAgendar={sesion?.rol === "admin"}
            />
          )}
          {!procesando && !resultado && (
            <div className="resultado-escaneo is-idle">
              <ScanLine className="h-7 w-7" />
              <p>
                Apunta la cámara al QR que el cliente trae en su teléfono. La llegada se confirma sola y se le suma la
                visita a su tarjeta.
              </p>
            </div>
          )}
        </div>

        <section className="module-panel">
          <div className="module-panel-head">
            <div>
              <p>Por llegar hoy</p>
              <span>{pendientesHoy.length === 0 ? "Nadie pendiente" : `${pendientesHoy.length} pendientes · confirma sin QR`}</span>
            </div>
          </div>
          <ul className="lista-llegadas">
            {pendientesHoy.map((c) => (
              <li key={c.id}>
                <span className="lista-llegadas-hora">{hora(c.inicio)}</span>
                <span className="min-w-0 flex-1">
                  <b className="block truncate">{c.cliente_nombre}</b>
                  <small className="block truncate">{c.barbero_nombre}</small>
                </span>
                <button type="button" className="btn-gold is-sm" onClick={() => void confirmar(c)} disabled={procesando}>
                  <CheckCircle2 className="h-4 w-4" /> Llegó
                </button>
              </li>
            ))}
          </ul>
          {llegadasHoy.length > 0 && (
            <>
              <p className="lista-llegadas-titulo">Ya llegaron</p>
              <ul className="lista-llegadas is-hechas">
                {llegadasHoy.map((c) => (
                  <li key={c.id}>
                    <span className="lista-llegadas-hora">{hora(c.llegada_en!)}</span>
                    <span className="min-w-0 flex-1 truncate">{c.cliente_nombre}</span>
                    <CheckCircle2 className="h-4 w-4 text-[var(--cm-orange)]" />
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function ResultadoEscaneo({
  resultado,
  lealtadDe,
  nombreDe,
  onConfirmar,
  onForzar,
  onSello,
  onCerrar,
  puedeAgendar,
}: {
  puedeAgendar: boolean;
  resultado: Resultado;
  lealtadDe: (clienteId: string) => ReturnType<typeof calcularLealtad> & { disponibles: number };
  nombreDe: (id: string) => string;
  onConfirmar: (cita: Cita) => void;
  onForzar: (cita: Cita) => void;
  onSello: (tarjetaId: string, clienteId: string) => void;
  onCerrar: () => void;
}) {
  if (resultado.tipo === "error") {
    return (
      <div className="resultado-escaneo is-error anim-pop">
        <XCircle className="h-8 w-8" />
        <p>{resultado.mensaje}</p>
        <button type="button" className="btn-linea is-sm" onClick={onCerrar}>
          Escanear otro
        </button>
      </div>
    );
  }

  if (resultado.tipo === "confirmada") {
    const { cita, yaEstaba } = resultado;
    const l = lealtadDe(cita.cliente_id);
    return (
      <div className="resultado-escaneo is-ok anim-pop">
        <CheckCircle2 className="h-10 w-10" />
        <p className="resultado-titulo">{yaEstaba ? "Esta llegada ya estaba confirmada" : "¡Llegada confirmada!"}</p>
        <p className="resultado-nombre">{cita.cliente_nombre}</p>
        {cita.barbero_id && (
          <p className="resultado-detalle">
            {cita.barbero_nombre} · {hora(cita.inicio)} h
            {yaEstaba && cita.llegada_en ? ` · llegó a las ${hora(cita.llegada_en)}` : ""}
          </p>
        )}
        <div className="resultado-sellos" role="img" aria-label={`${l.progreso} de ${l.requerido} sellos`}>
          {Array.from({ length: l.requerido }).map((_, i) => (
            <span key={i} className={i < l.progreso ? "is-on" : ""} />
          ))}
        </div>
        <p className="resultado-detalle">
          <Stamp className="inline h-4 w-4" /> {l.puntos} visitas · {l.progreso}/{l.requerido} en la tarjeta
        </p>
        {l.disponibles > 0 && (
          <p className="resultado-premio">
            <Gift className="h-4 w-4" /> Tiene {l.disponibles} recompensa{l.disponibles === 1 ? "" : "s"} por canjear
          </p>
        )}
        <button type="button" className="btn-linea is-sm" onClick={onCerrar}>
          Escanear otro
        </button>
      </div>
    );
  }

  if (resultado.tipo === "revisar") {
    const { cita, motivo } = resultado;
    return (
      <div className="resultado-escaneo is-warn anim-pop">
        <AlertTriangle className="h-8 w-8" />
        <p className="resultado-nombre">{cita.cliente_nombre}</p>
        <p className="resultado-detalle">
          {cita.barbero_nombre} · {format(new Date(cita.inicio), "d MMM, HH:mm", { locale: es })}
        </p>
        <p>{motivo}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            className="btn-gold is-sm"
            onClick={() => (cita.estado === "confirmada" ? onConfirmar(cita) : onForzar(cita))}
          >
            <CheckCircle2 className="h-4 w-4" /> Confirmar llegada de todos modos
          </button>
          <button type="button" className="btn-linea is-sm" onClick={onCerrar}>
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  const { clienteId, tarjetaId, citasHoy } = resultado;
  return (
    <div className="resultado-escaneo anim-pop">
      <p className="resultado-nombre">{nombreDe(clienteId)}</p>
      {citasHoy.length > 1 ? (
        <>
          <p>Tiene {citasHoy.length} citas hoy. ¿Cuál confirmas?</p>
          <div className="flex flex-wrap justify-center gap-2">
            {citasHoy.map((c) => (
              <button key={c.id} type="button" className="btn-gold is-sm" onClick={() => onConfirmar(c)}>
                {hora(c.inicio)} · {c.barbero_nombre.split(" ")[0]}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <p>No tiene cita agendada para hoy.</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" className="btn-gold is-sm" onClick={() => onSello(tarjetaId, clienteId)}>
              <Stamp className="h-4 w-4" /> Registrar visita sin cita (+1 sello)
            </button>
            {puedeAgendar && (
              <a className="btn-linea is-sm" href={`/dashboard/admin/citas?nueva=${encodeURIComponent(clienteId)}`}>
                <CalendarPlus className="h-4 w-4" /> Agendarle cita
              </a>
            )}
          </div>
        </>
      )}
      <button type="button" className="btn-linea is-sm" onClick={onCerrar}>
        Escanear otro
      </button>
    </div>
  );
}
