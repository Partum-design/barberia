"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertCircle,
  ArrowLeft,
  Banknote,
  CalendarPlus,
  CheckCircle2,
  Home,
  IdCard,
  KeyRound,
  Loader2,
  MapPin,
  UserRound,
} from "lucide-react";
import { enlaceDeCita, nombreDelNegocio, normalizarTelefono, precioDe, useBarberia, type Barbero, type Servicio } from "@/lib/store";
import { slotsDisponibles } from "@/lib/datos/disponibilidad";
import { AVISO_PAGO, FORMAS_DE_PAGO, PERFIL } from "@/lib/negocio/perfil";
import { QrCita } from "@/components/citas/QrCita";
import { BotonGuardarQr } from "@/components/citas/BotonGuardarQr";
import { BotonesContacto } from "@/components/contacto/BotonesContacto";
import { useAntibot } from "@/components/formularios/Antibot";
import { Campo, enfocarPrimerError, errorDeNombre, errorDeTelefono, hayErrores, type Errores } from "@/components/formularios/Campo";

type Paso = "barbero" | "servicio" | "horario" | "datos" | "confirmada";

type Confirmacion = {
  id: string;
  inicio: string;
  fin: string;
  barbero: string;
  servicio: string;
  precio: number;
  /** Reservó sin sesión */
  invitado: boolean;
  /** El número ya era cliente: no se muestra nada privado */
  yaEraCliente: boolean;
  nombre: string;
  telefono: string;
  tarjeta: string | null;
};

const mxn = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

/** "Zuriel Hernández" → "zuriel-hernandez" */
export const slug = (texto: string) =>
  texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Acepta el id, el nombre completo o sólo el primer nombre ("lupita"). */
function coincide(valor: string | null, item: { id: string; nombre: string }) {
  if (!valor) return false;
  const v = slug(valor);
  return item.id === valor || slug(item.nombre) === v || slug(item.nombre.split(" ")[0]) === v;
}

/** Archivo .ics para "Agregar a mi calendario". */
function descargarIcs(c: Confirmacion) {
  const f = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const esc = (t: string) => t.replace(/[\\,;]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CortMart//Reservas//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${c.id}@cortmart`,
    `DTSTAMP:${f(new Date().toISOString())}`,
    `DTSTART:${f(c.inicio)}`,
    `DTEND:${f(c.fin)}`,
    `SUMMARY:${esc(`${c.servicio || "Cita"} con ${c.barbero} · CortMart`)}`,
    `DESCRIPTION:${esc(`${AVISO_PAGO} ¿Necesitas cambiarla? Llama al ${PERFIL.telefono}.`)}`,
    `LOCATION:${esc(PERFIL.direccion)}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Tu cita en CortMart",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `cita-cortmart-${format(new Date(c.inicio), "yyyy-MM-dd-HHmm")}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Reserva en cuatro pasos: barbero, servicio (fija precio y duración),
 * fecha y hora, y tus datos. No hace falta cuenta: sin sesión basta con
 * nombre y celular, y al confirmar se crea la ficha con su tarjeta de
 * lealtad (ver /api/reservas). Se paga al llegar: transferencia, tarjeta o efectivo.
 *
 * Acepta ?barbero=, ?servicio= e ?inicio= para llegar con algo ya elegido
 * (los botones "Agendar con…" de la portada y el regreso del login).
 */
export function FlujoReserva() {
  const store = useBarberia();
  const params = useSearchParams();
  const { barberos, citas, barberiaConfig, horarioDeBarbero, servicios, sesion } = store;
  const catalogo = useMemo(() => servicios.filter((x) => x.activo), [servicios]);
  const activos = useMemo(() => barberos.filter((b) => b.activo), [barberos]);

  const [paso, setPaso] = useState<Paso>("barbero");
  const [barbero, setBarbero] = useState<Barbero | null>(null);
  const [servicio, setServicio] = useState<Servicio | null>(null);
  const [slot, setSlot] = useState<Date | null>(null);
  const [modalidad, setModalidad] = useState<"presencial" | "domicilio">("presencial");
  const [direccion, setDireccion] = useState("");
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [errores, setErrores] = useState<Errores>({});
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [hecha, setHecha] = useState<Confirmacion | null>(null);
  const antibot = useAntibot();
  const preseleccion = useRef(false);
  const tituloRef = useRef<HTMLHeadingElement>(null);

  const conDuracion = (b: Barbero) => (servicio ? { ...b, duracion_cita_min: servicio.duracion_min } : b);
  const slotsDe = (b: Barbero) =>
    slotsDisponibles({ barbero: conDuracion(b), horario: horarioDeBarbero(b.id), barberia: barberiaConfig, citas });

  // Horarios libres de los próximos 7 días por barbero activo.
  const disponibles = useMemo(
    () => activos.map((b) => ({ barbero: b, slots: slotsDe(b) })).filter((x) => x.slots.length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activos, citas, barberiaConfig, horarioDeBarbero, servicio]
  );
  const slots = useMemo(() => (barbero ? slotsDe(barbero) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [barbero, citas, barberiaConfig, horarioDeBarbero, servicio]);
  const porDia = useMemo(() => {
    const m = new Map<string, Date[]>();
    for (const s of slots) {
      const k = format(s, "yyyy-MM-dd");
      m.set(k, [...(m.get(k) ?? []), s]);
    }
    return [...m.values()];
  }, [slots]);

  // Llegó con barbero, servicio u hora en la dirección: se dejan elegidos.
  useEffect(() => {
    if (preseleccion.current || !store.listo || activos.length === 0) return;
    preseleccion.current = true;
    const b = activos.find((x) => coincide(params.get("barbero"), x)) ?? null;
    const sv = catalogo.find((x) => coincide(params.get("servicio"), x)) ?? null;
    const inicio = params.get("inicio");
    if (b) setBarbero(b);
    if (sv) setServicio(sv);
    if (b && (sv || catalogo.length === 0) && inicio && !Number.isNaN(Date.parse(inicio))) {
      setSlot(new Date(inicio));
      setPaso("datos");
    } else if (b && (sv || catalogo.length === 0)) setPaso("horario");
    else if (b) setPaso("servicio");
  }, [store.listo, activos, catalogo, params]);

  // Cada paso lleva el foco a su título: quien usa lector de pantalla oye dónde está.
  const montado = useRef(false);
  useEffect(() => {
    if (!montado.current) {
      montado.current = true;
      return;
    }
    tituloRef.current?.focus();
  }, [paso]);

  const precio = servicio ? precioDe(servicio, barbero) : 0;
  const precioLista = (x: Servicio) => {
    if (barbero) return `${x.desde ? "desde " : ""}${mxn.format(precioDe(x, barbero))}`;
    const precios = activos.map((b) => precioDe(x, b));
    const min = precios.length ? Math.min(...precios) : x.precio;
    return `${x.desde || precios.some((p) => p !== min) ? "desde " : ""}${mxn.format(min)}`;
  };

  const esCliente = sesion?.rol === "cliente";
  const esPersonal = sesion && sesion.rol !== "cliente";

  function elegirBarbero(b: Barbero) {
    setBarbero(b);
    setSlot(null);
    setModalidad("presencial");
    setError("");
    setPaso(catalogo.length > 0 && !servicio ? "servicio" : "horario");
  }

  function elegirServicio(x: Servicio) {
    setServicio(x);
    setSlot(null);
    setError("");
    setPaso("horario");
  }

  const volverA = (p: Paso) => {
    setError("");
    setPaso(p);
  };

  /** Enlace al login que regresa aquí con todo lo elegido. */
  const enlaceLogin = () => {
    const q = new URLSearchParams();
    if (barbero) q.set("barbero", barbero.id);
    if (servicio) q.set("servicio", servicio.id);
    if (slot) q.set("inicio", slot.toISOString());
    return `/login?next=${encodeURIComponent(`/reservar?${q.toString()}`)}`;
  };

  async function confirmar(e?: React.FormEvent) {
    e?.preventDefault();
    if (!barbero || !slot) return;
    setError("");

    if (!esCliente) {
      const errs: Errores = { nombre: errorDeNombre(nombre), telefono: errorDeTelefono(telefono) };
      if (modalidad === "domicilio" && direccion.trim().length < 8) errs.direccion = "Escribe la dirección completa.";
      setErrores(errs);
      if (hayErrores(errs)) {
        enfocarPrimerError(errs, ["direccion", "nombre", "telefono"]);
        return;
      }
    }

    setCargando(true);
    const datos = {
      barbero_id: barbero.id,
      servicio_id: servicio?.id ?? null,
      inicio: slot.toISOString(),
      modalidad,
      direccion_domicilio: direccion.trim(),
    };

    if (esCliente) {
      const { cita, error: err } = await store.crearCita(datos);
      setCargando(false);
      if (err || !cita) return fallo(err ?? "No se pudo reservar.");
      setHecha({
        id: cita.id,
        inicio: cita.inicio,
        fin: cita.fin,
        barbero: cita.barbero_nombre,
        servicio: cita.servicio_nombre ?? "",
        precio: cita.precio,
        invitado: false,
        yaEraCliente: true,
        nombre: sesion!.nombre.split(" ")[0],
        telefono: "",
        tarjeta: store.tarjetas.find((t) => t.cliente_id === sesion!.id)?.numero ?? null,
      });
      setPaso("confirmada");
      return;
    }

    try {
      const res = await fetch("/api/reservas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...datos, nombre: nombre.trim(), telefono: normalizarTelefono(telefono), antibot: antibot.datos() }),
      });
      const r = (await res.json().catch(() => ({}))) as {
        error?: string;
        campo?: string;
        cita?: Omit<Confirmacion, "invitado" | "yaEraCliente" | "nombre" | "telefono" | "tarjeta">;
        yaEraCliente?: boolean;
        nombre?: string;
        telefono?: string;
        tarjeta?: string | null;
      };
      setCargando(false);
      if (!res.ok || !r.cita) {
        // Ficha caducada o rechazada: se pide otra. "Muy rápido" no reinicia el reloj.
        if (res.status === 403 && !/rápido/.test(r.error ?? "")) antibot.renovar();
        if (r.campo) {
          setErrores({ [r.campo]: r.error });
          document.getElementById(r.campo)?.focus();
          return;
        }
        return fallo(r.error ?? "No se pudo reservar.", res.status === 409);
      }
      setHecha({
        ...r.cita,
        invitado: true,
        yaEraCliente: Boolean(r.yaEraCliente),
        nombre: r.nombre ?? nombre.split(" ")[0],
        telefono: r.telefono ?? normalizarTelefono(telefono),
        tarjeta: r.tarjeta ?? null,
      });
      void store.recargar();
      setPaso("confirmada");
    } catch {
      setCargando(false);
      fallo("Sin conexión. Revisa tu internet e inténtalo de nuevo.");
    }
  }

  /** Si el horario se ocupó, se vuelve a elegir con la disponibilidad fresca. */
  function fallo(mensaje: string, ocupado = true) {
    setError(mensaje);
    if (ocupado && /ocupad|ya tiene una cita|ya pasó|horario/i.test(mensaje)) {
      setSlot(null);
      void store.recargar();
      setPaso("horario");
    }
  }

  const resumen = (
    <p className="reserva-resumen">
      {barbero && (
        <span>
          <b>Barbero:</b> {barbero.nombre}
        </span>
      )}
      {servicio && (
        <span>
          <b>Servicio:</b> {servicio.nombre} · {servicio.duracion_min} min · {precioLista(servicio)}
        </span>
      )}
      {slot && (
        <span className="capitalize">
          <b>Cuándo:</b> {format(slot, "EEEE d 'de' MMMM, HH:mm 'h'", { locale: es })}
        </span>
      )}
    </p>
  );

  const titulo = (texto: string) => (
    <h2 ref={tituloRef} tabIndex={-1} className="reserva-titulo">
      {texto}
    </h2>
  );

  return (
    <div className="booking-flow space-y-4">
      {paso !== "confirmada" && <Stepper actual={paso} conServicio={catalogo.length > 0} />}

      {error && (
        <p className="login-alert is-error" role="alert">
          <AlertCircle aria-hidden /> {error}
        </p>
      )}

      {/* Paso 1: barbero */}
      {paso === "barbero" && (
        <div className="space-y-3">
          {titulo("¿Con quién quieres tu cita?")}
          {disponibles.length === 0 && (
            <div className="reserva-vacio">
              No hay barberos con horarios disponibles esta semana. Llámanos o escríbenos para apartar tu lugar.
              <BotonesContacto />
            </div>
          )}
          {disponibles.map(({ barbero: m, slots: libres }) => (
            <button key={m.id} type="button" onClick={() => elegirBarbero(m)} className="reserva-opcion">
              <span className="reserva-avatar" aria-hidden>
                {m.nombre.charAt(0)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="reserva-opcion-titulo">{m.nombre}</span>
                <span className="reserva-opcion-sub">
                  {m.especialidad}
                  {m.acepta_domicilio && (
                    <span className="ml-2 inline-flex items-center gap-1">
                      <Home className="h-4 w-4" aria-hidden /> Domicilio
                    </span>
                  )}
                </span>
                <span className="reserva-opcion-sub capitalize">
                  Próximo horario: {format(libres[0], "EEEE d MMM, HH:mm", { locale: es })}
                </span>
              </span>
              <span className="reserva-opcion-accion" aria-hidden>
                Elegir →
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Paso 2: servicio */}
      {paso === "servicio" && (
        <div className="space-y-3">
          {titulo("¿Qué servicio quieres?")}
          {resumen}
          <button type="button" onClick={() => volverA("barbero")} className="reserva-volver">
            <ArrowLeft className="h-4 w-4" aria-hidden /> Cambiar barbero
          </button>
          <div className="grid gap-3 sm:grid-cols-2">
            {catalogo.map((x) => (
              <button key={x.id} type="button" onClick={() => elegirServicio(x)} className="reserva-servicio">
                <span className="min-w-0">
                  <span className="reserva-servicio-cat">{x.categoria}</span>
                  <span className="reserva-opcion-titulo">{x.nombre}</span>
                  <span className="reserva-opcion-sub">{x.duracion_min} min</span>
                </span>
                <span className="reserva-servicio-precio">{precioLista(x)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Paso 3: fecha y hora */}
      {paso === "horario" && barbero && (
        <div className="space-y-3">
          {titulo("Elige día y hora")}
          {resumen}
          <button type="button" onClick={() => volverA(catalogo.length > 0 ? "servicio" : "barbero")} className="reserva-volver">
            <ArrowLeft className="h-4 w-4" aria-hidden /> {catalogo.length > 0 ? "Cambiar servicio" : "Cambiar barbero"}
          </button>
          {slots.length === 0 && (
            <div className="reserva-vacio">
              {barbero.nombre} no tiene horarios libres en los próximos 7 días.{" "}
              <button type="button" className="reserva-volver" onClick={() => volverA("barbero")}>
                Elegir otro barbero
              </button>
            </div>
          )}
          {porDia.map((dia) => (
            <section key={dia[0].toISOString()} className="reserva-dia" aria-label={format(dia[0], "EEEE d 'de' MMMM", { locale: es })}>
              <h3 className="capitalize">{format(dia[0], "EEEE d 'de' MMMM", { locale: es })}</h3>
              <div className="reserva-horas">
                {dia.map((s) => (
                  <button
                    key={s.toISOString()}
                    type="button"
                    onClick={() => {
                      setSlot(s);
                      setError("");
                      setPaso("datos");
                    }}
                    className="reserva-hora"
                  >
                    {format(s, "HH:mm")}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Paso 4: tus datos y confirmar */}
      {paso === "datos" && barbero && slot && (
        <form onSubmit={confirmar} noValidate className="reserva-datos">
          {titulo("Tus datos")}
          <button type="button" onClick={() => volverA("horario")} className="reserva-volver">
            <ArrowLeft className="h-4 w-4" aria-hidden /> Cambiar horario
          </button>

          <dl className="reserva-dl">
            {servicio && <Fila k="Servicio" v={`${servicio.nombre} · ${servicio.duracion_min} min`} />}
            <Fila k="Barbero" v={barbero.nombre} />
            <Fila k="Fecha" v={format(slot, "EEEE d 'de' MMMM, HH:mm 'h'", { locale: es })} />
            <Fila k="Total" v={servicio ? mxn.format(precio) : "Se cotiza en la barbería"} destacado />
            <Fila k="Pago" v={`Al llegar: ${FORMAS_DE_PAGO}`} />
          </dl>

          {barbero.acepta_domicilio && (
            <fieldset className="reserva-modalidad">
              <legend>¿Dónde?</legend>
              {(["presencial", "domicilio"] as const).map((m) => (
                <button key={m} type="button" aria-pressed={modalidad === m} onClick={() => setModalidad(m)}>
                  {m === "presencial" ? <MapPin className="h-5 w-5" aria-hidden /> : <Home className="h-5 w-5" aria-hidden />}
                  {m === "presencial" ? "En la barbería" : "A domicilio"}
                </button>
              ))}
            </fieldset>
          )}
          {modalidad === "domicilio" && (
            <Campo id="direccion" label="Dirección del domicilio" error={errores.direccion}>
              {(aria) => (
                <input {...aria} value={direccion} onChange={(e) => setDireccion(e.target.value)} autoComplete="street-address" />
              )}
            </Campo>
          )}

          {esCliente ? (
            <p className="reserva-quien">
              <UserRound aria-hidden /> La cita queda a nombre de <b>{sesion!.nombre}</b>.
            </p>
          ) : esPersonal ? (
            <p className="login-alert is-error">
              <AlertCircle aria-hidden /> Entraste con una cuenta del personal. Para agendar a un cliente usa el panel (Citas).
            </p>
          ) : (
            <>
              <p className="reserva-quien">Sólo necesitamos tu nombre y tu celular. No hace falta crear cuenta.</p>
              <Campo id="nombre" label="Nombre" error={errores.nombre}>
                {(aria) => (
                  <input {...aria} value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="name" placeholder="Tu nombre" />
                )}
              </Campo>
              <Campo id="telefono" label="Celular (10 dígitos)" ayuda="Por si necesitamos avisarte de un cambio." error={errores.telefono}>
                {(aria) => (
                  <input
                    {...aria}
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="55 1234 5678"
                  />
                )}
              </Campo>
              {antibot.campos}
            </>
          )}

          <p className="reserva-nota">
            <Banknote aria-hidden /> Tu horario queda apartado al confirmar. {AVISO_PAGO}
          </p>

          {!esPersonal && (
            <button type="submit" disabled={cargando} className="btn-gold login-submit">
              {cargando && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmar cita
            </button>
          )}

          {!sesion && (
            <p className="reserva-quien">
              ¿Ya tienes cuenta? <Link href={enlaceLogin()}>Inicia sesión</Link> y regresas aquí con tu cita elegida.
            </p>
          )}
        </form>
      )}

      {/* Confirmación */}
      {paso === "confirmada" && hecha && <Confirmada c={hecha} negocio={nombreDelNegocio(barberiaConfig)} tituloRef={tituloRef} />}
    </div>
  );
}

function Confirmada({
  c,
  negocio,
  tituloRef,
}: {
  c: Confirmacion;
  negocio: string;
  tituloRef: React.RefObject<HTMLHeadingElement | null>;
}) {
  const inicio = new Date(c.inicio);
  return (
    <div className="reserva-confirmada anim-pop" role="status">
      <CheckCircle2 className="reserva-check" aria-hidden />
      <h2 ref={tituloRef} tabIndex={-1} className="reserva-titulo">
        {c.invitado && c.yaEraCliente ? `Ya eres cliente, ${c.nombre}. ¡Cita confirmada!` : `¡Cita confirmada${c.nombre ? `, ${c.nombre}` : ""}!`}
      </h2>

      <dl className="reserva-dl">
        <Fila k="Barbero" v={c.barbero} />
        {c.servicio && <Fila k="Servicio" v={c.servicio} />}
        <Fila k="Fecha" v={format(inicio, "EEEE d 'de' MMMM", { locale: es })} />
        <Fila k="Hora" v={format(inicio, "HH:mm 'h'")} />
        <Fila k="Precio" v={c.servicio ? mxn.format(c.precio) : "Se cotiza en la barbería"} destacado />
        <Fila k="Pago" v={`Al llegar: ${FORMAS_DE_PAGO}`} />
      </dl>

      <button type="button" className="contacto-boton" onClick={() => descargarIcs(c)}>
        <CalendarPlus aria-hidden /> Agregar a mi calendario
      </button>

      <div className="reserva-qr">
        <QrCita citaId={c.id} tamano={180} />
        <p>Muestra este código al llegar: confirma tu cita{c.invitado && c.yaEraCliente ? "" : " y suma un sello a tu tarjeta"}.</p>
        {c.tarjeta && (
          <p>
            <IdCard className="inline h-4 w-4" aria-hidden /> Tu tarjeta de lealtad: <b>{c.tarjeta}</b>
          </p>
        )}
        <BotonGuardarQr
          datos={{
            contenido: enlaceDeCita(c.id, window.location.origin),
            titulo: negocio,
            subtitulo: "Tu cita",
            codigo: c.id,
            detalles: [`${c.barbero} · ${format(inicio, "d MMM yyyy, HH:mm 'h'", { locale: es })}`, ...(c.tarjeta ? [`Tarjeta de lealtad ${c.tarjeta}`] : [])],
            archivo: `cita-${c.id}`,
          }}
        />
      </div>

      {c.invitado ? (
        <div className="reserva-cuenta">
          <p>
            {c.yaEraCliente
              ? "Para ver todas tus citas, tu QR y tus sellos, inicia sesión con tu número."
              : "Opcional: crea tu contraseña para ver después tus citas, tu QR y tus sellos."}
          </p>
          <Link href={`/login?tel=${encodeURIComponent(c.telefono)}`} className="btn-gold login-submit">
            <KeyRound className="h-4 w-4" aria-hidden /> {c.yaEraCliente ? "Iniciar sesión" : "Guardar mi cuenta: crea tu contraseña"}
          </Link>
        </div>
      ) : (
        <div className="reserva-cuenta">
          <Link href="/cuenta" className="btn-gold login-submit">
            Ver en mi cuenta
          </Link>
          <Link href="/cuenta/tarjeta" className="contacto-boton">
            <IdCard aria-hidden /> Mi tarjeta de lealtad
          </Link>
        </div>
      )}

      <p className="reserva-quien">¿Necesitas cambiarla? Llámanos o escríbenos:</p>
      <BotonesContacto
        textoWhatsApp={`Hola CortMart, quiero cambiar mi cita del ${format(inicio, "d 'de' MMMM 'a las' HH:mm", { locale: es })} con ${c.barbero}.`}
      />
    </div>
  );
}

function Stepper({ actual, conServicio }: { actual: Paso; conServicio: boolean }) {
  const pasos: { id: Paso; label: string }[] = [
    { id: "barbero", label: "Barbero" },
    ...(conServicio ? [{ id: "servicio" as Paso, label: "Servicio" }] : []),
    { id: "horario", label: "Día y hora" },
    { id: "datos", label: "Tus datos" },
  ];
  const idx = pasos.findIndex((p) => p.id === actual);
  return (
    <ol className="reserva-stepper" aria-label={`Paso ${idx + 1} de ${pasos.length}`}>
      {pasos.map((p, i) => (
        <li key={p.id} className={i <= idx ? "is-hecho" : ""} aria-current={i === idx ? "step" : undefined}>
          <span aria-hidden />
          {p.label}
        </li>
      ))}
    </ol>
  );
}

function Fila({ k, v, destacado }: { k: string; v: string; destacado?: boolean }) {
  return (
    <div>
      <dt>{k}</dt>
      <dd className={destacado ? "is-destacado" : ""}>{v}</dd>
    </div>
  );
}
