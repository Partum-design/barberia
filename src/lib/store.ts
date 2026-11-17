"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import {
  aplicarOperacion,
  BARBERIA_VACIA,
  estadoVacio,
  horarioPorDefecto,
  normalizarEstado,
  nuevoId,
  numeroDeTarjeta,
  permisosDe,
  PERMISOS_POR_DEFECTO,
  type Barbero,
  type BarberiaConfig,
  type BloqueHorario,
  type Cita,
  type Cliente,
  type DiaSemana,
  type Estado,
  type EstadoTarjeta,
  type Ficha,
  type Gasto,
  type HorarioSemanal,
  type MetodoPago,
  type Operacion,
  type PermisosBarbero,
  type Producto,
  type RecompensasConfig,
  type Servicio,
  type Sesion,
} from "@/lib/datos/modelo";

// Re-exportados para que las pantallas sigan importando todo desde aquí. En un
// módulo "use client" Next no admite `export *`: la lista tiene que ser explícita.
export {
  BARBERIA_VACIA,
  CATEGORIAS_SERVICIO,
  DIAS_SEMANA,
  ETIQUETA_ESTADO_CITA,
  ETIQUETAS_PERMISOS,
  PERMISOS_POR_DEFECTO,
  permisosDe,
  precioDe,
  iniciales,
  normalizarTelefono,
  citaActiva,
  enlaceDeCita,
  idDeCitaEnTexto,
  NOMBRE_POR_DEFECTO,
  calcularLealtad,
  nombreDelNegocio,
  resumirBarberos,
  resumirCitas,
  resumirClientes,
} from "@/lib/datos/modelo";
export type {
  Barbero,
  BarberiaConfig,
  BarberoResumen,
  BloqueHorario,
  Cita,
  Cliente,
  ClienteResumen,
  DiaSemana,
  EstadoCita,
  EstadoPago,
  EstadoTarjeta,
  Ficha,
  Gasto,
  HorarioSemanal,
  MetodoPago,
  PermisosBarbero,
  Producto,
  RecompensasConfig,
  Rol,
  Servicio,
  Sesion,
  TarjetaLealtad,
} from "@/lib/datos/modelo";

// ============================================================================
// Almacén de la barbería en el navegador.
//
// Los datos viven en Supabase y se leen y escriben a través de /api/datos,
// que aplica los permisos de cada rol. Aquí se guarda una copia en memoria,
// compartida por todas las pantallas: cada cambio se aplica primero en local
// (la interfaz responde al instante) y se confirma con el servidor; si el
// servidor lo rechaza, se recarga su versión y se muestra el motivo.
// ============================================================================

type Snapshot = {
  listo: boolean;
  sesion: Sesion | null;
  estado: Estado;
  /** La última carga falló (sin conexión, servidor lento): las pantallas ofrecen reintentar. */
  error: boolean;
};

let snapshot: Snapshot = { listo: false, sesion: null, estado: estadoVacio(), error: false };
const oyentes = new Set<() => void>();
let iniciado = false;

function publicar(cambios: Partial<Snapshot>) {
  snapshot = { ...snapshot, ...cambios };
  oyentes.forEach((f) => f());
}

// Copia del negocio para piezas sueltas (logotipo) que no usan el hook.
const KEY_NEGOCIO = "barberia-v2-negocio";

function recordarNegocio(cfg: BarberiaConfig) {
  try {
    window.localStorage.setItem(KEY_NEGOCIO, JSON.stringify(cfg));
  } catch {
    /* sin almacenamiento: el logotipo cae al nombre por defecto */
  }
  window.dispatchEvent(new Event("barberia:datos"));
}

/** Lectura suelta de los datos del negocio, para piezas que no usan el hook. */
export function leerDatosNegocio(): BarberiaConfig {
  if (typeof window === "undefined") return BARBERIA_VACIA;
  if (snapshot.listo) return snapshot.estado.barberia;
  try {
    const raw = window.localStorage.getItem(KEY_NEGOCIO);
    if (raw) return { ...BARBERIA_VACIA, ...(JSON.parse(raw) as Partial<BarberiaConfig>) };
  } catch {
    /* ignora copias corruptas */
  }
  return BARBERIA_VACIA;
}

function aplicarDelServidor(estado: Partial<Estado>) {
  const normal = normalizarEstado(estado);
  publicar({ estado: normal });
  recordarNegocio(normal.barberia);
}

// ---------------------------------------------------------------------------
// Carga de datos y sesión.
//
// Antes, el navegador y el servidor renovaban el token de sesión al mismo
// tiempo (sobre todo al reabrir la app instalada después de horas). Supabase
// sólo acepta cada token de renovación una vez: el segundo intento fallaba
// («Refresh Token Already Used»), el servidor trataba a la persona como
// visitante y el panel se quedaba vacío o en blanco.
//
// Ahora el orden es fijo: 1) el navegador renueva el token si venció (con
// tiempo límite, para no colgarse nunca), 2) se piden los datos y la sesión
// al servidor, que ya recibe el token fresco, y 3) si aun así el servidor no
// reconoce la sesión pero el navegador sí la tiene, se reintenta una vez
// antes de darla por terminada. Ninguna espera es infinita.
// ---------------------------------------------------------------------------

type RespuestaDatos = { estado: Estado; sesion?: Sesion | null };

const esperar = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function conLimite<T>(promesa: Promise<T>, ms: number, respaldo: T): Promise<T> {
  return Promise.race([promesa.catch(() => respaldo), esperar(ms).then(() => respaldo)]);
}

/** Renueva el token en el navegador si hace falta. Devuelve si hay sesión guardada. */
async function prepararToken(): Promise<boolean> {
  const supabase = getSupabaseBrowser();
  if (!supabase) return false;
  return conLimite(
    supabase.auth.getSession().then(({ data }) => Boolean(data.session)),
    5000,
    false
  );
}

async function pedirDatos(): Promise<RespuestaDatos | null> {
  const control = new AbortController();
  const limite = setTimeout(() => control.abort(), 20_000);
  try {
    const res = await fetch("/api/datos", { cache: "no-store", credentials: "same-origin", signal: control.signal });
    if (!res.ok) return null;
    return (await res.json()) as RespuestaDatos;
  } catch {
    return null;
  } finally {
    clearTimeout(limite);
  }
}

let cargaEnCurso: Promise<boolean> | null = null;

async function cargar(): Promise<boolean> {
  if (cargaEnCurso) return cargaEnCurso;
  cargaEnCurso = (async () => {
    try {
      const hayLocal = await prepararToken();
      let r = await pedirDatos();
      if (r && !r.sesion && hayLocal) {
        // Otra pestaña o el servidor pudo estar renovando en ese instante.
        await esperar(1500);
        await prepararToken();
        r = (await pedirDatos()) ?? r;
      }
      if (!r) {
        publicar({ error: true });
        return false;
      }
      const sesion = r.sesion ?? null;
      // Con sesión de personal, nunca se reemplazan sus datos por la vista pública.
      if (!sesion && snapshot.sesion && snapshot.sesion.rol !== "cliente" && hayLocal) {
        publicar({ error: true });
        return false;
      }
      publicar({ sesion, error: false });
      aplicarDelServidor(r.estado);
      return true;
    } catch (err) {
      console.error("No se pudieron cargar los datos", err);
      publicar({ error: true });
      return false;
    } finally {
      cargaEnCurso = null;
    }
  })();
  return cargaEnCurso;
}

/** Vuelve a intentar la carga desde cero (botón «Reintentar»). */
async function reintentar() {
  publicar({ error: false });
  const ok = await cargar();
  if (ok) publicar({ listo: true });
}

function iniciar() {
  if (iniciado || typeof window === "undefined") return;
  iniciado = true;

  const refrescarTodo = async () => {
    const ok = await cargar();
    if (ok) publicar({ listo: true });
  };

  void refrescarTodo();

  const supabase = getSupabaseBrowser();
  supabase?.auth.onAuthStateChange((evento) => {
    if (evento === "SIGNED_IN" || evento === "SIGNED_OUT" || evento === "USER_UPDATED") {
      // Fuera del callback: Supabase no admite llamadas a auth dentro de él.
      setTimeout(refrescarTodo, 0);
    }
  });

  // Lo que hagan otros (una reserva nueva, una llegada confirmada en otro
  // teléfono, un cobro) llega al volver a la pestaña y, mientras está
  // abierta, cada 15 segundos: los reportes y contadores se mueven solos.
  // Si la primera carga no se completó, cualquiera de estos la termina.
  const alVolver = () => void refrescarTodo();
  window.addEventListener("focus", alVolver);
  window.addEventListener("online", alVolver);
  window.addEventListener("pageshow", (e) => (e as PageTransitionEvent).persisted && alVolver());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") alVolver();
  });
  window.setInterval(() => {
    if (document.visibilityState === "visible") void refrescarTodo();
  }, 15_000);
}

/**
 * Aplica una operación: primero en pantalla y luego en el servidor. Devuelve
 * false si ni siquiera se pudo aplicar en local (sin permiso, datos inválidos).
 */
function ejecutar(op: Operacion): boolean {
  const { sesion, estado } = snapshot;
  if (!sesion) {
    window.alert("Tu sesión terminó. Vuelve a iniciar sesión.");
    return false;
  }
  let cambios: Partial<Estado>;
  try {
    cambios = aplicarOperacion(estado, op, sesion);
  } catch (err) {
    window.alert(err instanceof Error ? err.message : "No se pudo completar la acción.");
    return false;
  }
  publicar({ estado: { ...estado, ...cambios } });
  if (cambios.barberia) recordarNegocio(cambios.barberia);

  fetch("/api/datos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ op }),
  })
    .then(async (res) => {
      const cuerpo = (await res.json().catch(() => ({}))) as { estado?: Estado; error?: string };
      if (res.ok && cuerpo.estado) {
        aplicarDelServidor(cuerpo.estado);
        return;
      }
      window.alert(cuerpo.error ?? "No se pudo guardar el cambio.");
      await cargar();
    })
    .catch(async () => {
      window.alert("Sin conexión: el cambio no se guardó.");
      await cargar();
    });
  return true;
}

async function logout() {
  publicar({ sesion: null });
  // Se espera al cierre real: si se navega antes, la cookie puede seguir viva
  // y el middleware devolvería a la persona a su panel.
  await getSupabaseBrowser()?.auth.signOut();
}

function suscribir(f: () => void) {
  oyentes.add(f);
  return () => oyentes.delete(f);
}

const leer = () => snapshot;

// Hook principal: estado compartido + mutadores.
/** Sólo el estado de la carga, para la pantalla de «Cargando…». */
export function useCargaBarberia() {
  const { listo, error } = useSyncExternalStore(suscribir, leer, leer);
  useEffect(iniciar, []);
  return { listo, error, reintentar };
}

export function useBarberia() {
  const { listo, sesion, estado, error } = useSyncExternalStore(suscribir, leer, leer);

  useEffect(iniciar, []);

  const horarioDeBarbero = useCallback(
    (barberoId: string): HorarioSemanal => estado.horarios[barberoId] ?? horarioPorDefecto(),
    [estado.horarios]
  );

  // Lo que la sesión puede hacer: el administrador todo; el barbero según lo que le dieron.
  const permisos: PermisosBarbero =
    sesion?.rol === "admin"
      ? (Object.fromEntries(Object.keys(PERMISOS_POR_DEFECTO).map((k) => [k, true])) as PermisosBarbero)
      : sesion?.rol === "barbero"
        ? permisosDe(estado.barberos.find((b) => b.id === sesion.id))
        : (Object.fromEntries(Object.keys(PERMISOS_POR_DEFECTO).map((k) => [k, false])) as PermisosBarbero);

  return {
    listo,
    error,
    sesion,
    permisos,
    citas: estado.citas,
    barberos: estado.barberos,
    fichas: estado.fichas,
    recompensasConfig: estado.recompensas,
    barberiaConfig: estado.barberia,
    canjes: estado.canjes,
    servicios: estado.servicios,
    productos: estado.productos,
    gastos: estado.gastos,
    clientes: estado.clientes,
    tarjetas: estado.tarjetas,
    logout,
    recargar: cargar,
    reintentar,
    horarioDeBarbero,
    crearCita,
    crearCitaPersonal,
    actualizarCita: (id: string, cambios: CambiosCita, forzar = false) =>
      ejecutarEnServidor({ tipo: "actualizarCita", id, cambios, forzar }),
    confirmarLlegada: (id: string) => ejecutarEnServidor({ tipo: "marcarAsistida", id }),
    marcarAsistida: (id: string) => ejecutar({ tipo: "marcarAsistida", id }),
    cancelarCita: (id: string) => ejecutar({ tipo: "cancelarCita", id }),
    eliminarCita: (id: string) => ejecutarEnServidor({ tipo: "eliminarCita", id }),
    eliminarTodasLasCitas: () => ejecutarEnServidor({ tipo: "eliminarTodasLasCitas" }),
    cobrarEfectivo: (id: string) => ejecutar({ tipo: "cobrarCita", id, metodo: "efectivo" }),
    cobrar: (id: string, metodo: MetodoPago) => ejecutar({ tipo: "cobrarCita", id, metodo }),
    actualizarBarbero: (id: string, cambios: Partial<Barbero>) => ejecutar({ tipo: "actualizarBarbero", id, cambios }),
    toggleActivoBarbero: (id: string) => ejecutar({ tipo: "toggleActivoBarbero", id }),
    eliminarBarbero: (id: string) => eliminarPersona("barbero", id),
    eliminarCliente: (id: string) => eliminarPersona("cliente", id),
    eliminarServicio: (id: string) => ejecutar({ tipo: "eliminarServicio", id }),
    guardarHorarioDia: (barberoId: string, dia: DiaSemana, cambios: Partial<BloqueHorario>) =>
      ejecutar({ tipo: "guardarHorarioDia", barberoId, dia, cambios }),
    agregarFicha,
    actualizarRecompensasConfig: (cambios: Partial<RecompensasConfig>) =>
      ejecutar({ tipo: "actualizarRecompensasConfig", cambios }),
    actualizarBarberiaConfig: (cambios: Partial<BarberiaConfig>) => ejecutar({ tipo: "actualizarBarberiaConfig", cambios }),
    canjearRecompensa: (clienteId: string) => ejecutar({ tipo: "canjearRecompensa", clienteId }),
    agregarServicio,
    agregarServicios: (servicios: Servicio[]) => ejecutarEnServidor({ tipo: "agregarServicios", servicios }),
    actualizarServicio: (id: string, cambios: Partial<Servicio>) => ejecutar({ tipo: "actualizarServicio", id, cambios }),
    agregarProducto,
    ajustarExistencias: (id: string, delta: number) => ejecutar({ tipo: "ajustarExistencias", id, delta }),
    actualizarProducto: (id: string, cambios: Partial<Omit<Producto, "id">>) =>
      ejecutar({ tipo: "actualizarProducto", id, cambios }),
    eliminarProducto: (id: string) => ejecutar({ tipo: "eliminarProducto", id }),
    agregarGasto,
    eliminarGasto: (id: string) => ejecutar({ tipo: "eliminarGasto", id }),
    registrarCliente,
    actualizarCliente: (id: string, cambios: Partial<Omit<Cliente, "id">>) =>
      ejecutar({ tipo: "actualizarCliente", id, cambios }),
    asegurarClienteDeSesion,
    ajustarSellos: (tarjetaId: string, delta: number) => ejecutar({ tipo: "ajustarSellos", tarjetaId, delta }),
    cambiarEstadoTarjeta: (tarjetaId: string, estado: EstadoTarjeta) =>
      ejecutar({ tipo: "cambiarEstadoTarjeta", tarjetaId, estado }),
    marcarWalletGuardada: (tarjetaId: string) =>
      ejecutar({ tipo: "marcarWalletGuardada", tarjetaId, fecha: new Date().toISOString() }),
  };
}

// --- Mutadores que devuelven lo creado --------------------------------------

type CambiosCita = Extract<Operacion, { tipo: "actualizarCita" }>["cambios"];

/**
 * Igual que `ejecutar`, pero espera la respuesta del servidor y devuelve el
 * error en lugar de mostrar una alerta: lo usan los formularios de citas y el
 * escáner, que enseñan el motivo en su propia pantalla.
 */
async function ejecutarEnServidor(op: Operacion): Promise<{ ok: boolean; error: string | null }> {
  const { sesion, estado } = snapshot;
  if (!sesion) return { ok: false, error: "Tu sesión terminó. Vuelve a iniciar sesión." };
  try {
    // Se aplica en pantalla al instante; si el servidor lo rechaza se recarga su versión.
    const cambios = aplicarOperacion(estado, op, sesion);
    publicar({ estado: { ...estado, ...cambios } });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No se pudo completar la acción." };
  }
  try {
    const res = await fetch("/api/datos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ op }),
    });
    const cuerpo = (await res.json().catch(() => ({}))) as { estado?: Estado; error?: string };
    if (!res.ok || !cuerpo.estado) {
      await cargar();
      return { ok: false, error: cuerpo.error ?? "No se pudo guardar el cambio." };
    }
    aplicarDelServidor(cuerpo.estado);
    return { ok: true, error: null };
  } catch {
    await cargar();
    return { ok: false, error: "Sin conexión. Intenta de nuevo." };
  }
}

/**
 * Elimina a un barbero o cliente. Si tiene cuenta de acceso, la borra el
 * servidor junto con sus datos; si sólo existe en el panel, basta la operación.
 */
async function eliminarPersona(tipo: "barbero" | "cliente", id: string): Promise<{ ok: boolean; error: string | null }> {
  try {
    const res = await fetch(`/api/admin/usuarios?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    if (res.ok) {
      await cargar();
      return { ok: true, error: null };
    }
    if (res.status !== 404) {
      const cuerpo = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: cuerpo.error ?? "No se pudo eliminar." };
    }
  } catch {
    return { ok: false, error: "Sin conexión. Intenta de nuevo." };
  }
  return ejecutarEnServidor({ tipo: tipo === "barbero" ? "eliminarBarbero" : "eliminarCliente", id });
}

/** El personal agenda a nombre de un cliente (mostrador, teléfono, WhatsApp). */
async function crearCitaPersonal(datos: Omit<Extract<Operacion, { tipo: "crearCitaPersonal" }>, "tipo" | "id">) {
  const op: Operacion = { tipo: "crearCitaPersonal", id: nuevoId("c"), ...datos };
  const r = await ejecutarEnServidor(op);
  return { ...r, id: r.ok ? op.id : null };
}

/**
 * Reserva una cita. A diferencia del resto de cambios, espera al servidor:
 * el horario pudo ocuparse mientras el cliente decidía y no se debe mostrar
 * una confirmación que luego se deshace.
 */
async function crearCita(datos: {
  barbero_id: string;
  servicio_id?: string | null;
  inicio: string;
  modalidad: "presencial" | "domicilio";
  direccion_domicilio?: string;
}): Promise<{ cita: Cita | null; error: string | null }> {
  const op: Operacion = { tipo: "crearCita", id: nuevoId("c"), metodo_pago: "efectivo", fin: datos.inicio, ...datos };
  try {
    const res = await fetch("/api/datos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ op }),
    });
    const cuerpo = (await res.json().catch(() => ({}))) as { estado?: Estado; error?: string };
    if (!res.ok || !cuerpo.estado) {
      void cargar();
      return { cita: null, error: cuerpo.error ?? "No se pudo reservar." };
    }
    aplicarDelServidor(cuerpo.estado);
    return { cita: snapshot.estado.citas.find((c) => c.id === op.id) ?? null, error: null };
  } catch {
    return { cita: null, error: "Sin conexión. Intenta de nuevo." };
  }
}

function agregarFicha(datos: Omit<Ficha, "id" | "creado_en">): Ficha | null {
  const ficha: Ficha = { id: nuevoId("ficha"), creado_en: new Date().toISOString(), ...datos };
  return ejecutar({ tipo: "agregarFicha", ficha }) ? ficha : null;
}

function agregarServicio(datos: Omit<Servicio, "id" | "activo">): Servicio | null {
  const servicio: Servicio = { id: nuevoId("srv"), activo: true, ...datos };
  return ejecutar({ tipo: "agregarServicio", servicio }) ? servicio : null;
}

function agregarProducto(datos: Omit<Producto, "id">): Producto | null {
  const producto: Producto = { id: nuevoId("prd"), ...datos };
  return ejecutar({ tipo: "agregarProducto", producto }) ? producto : null;
}

function agregarGasto(datos: Omit<Gasto, "id" | "fecha"> & { fecha?: string }): Gasto | null {
  const gasto: Gasto = {
    id: nuevoId("gto"),
    fecha: datos.fecha ?? new Date().toISOString(),
    concepto: datos.concepto,
    categoria: datos.categoria,
    monto: datos.monto,
  };
  return ejecutar({ tipo: "agregarGasto", gasto }) ? gasto : null;
}

/** Da de alta a un cliente (o reutiliza el existente) y le emite su tarjeta. */
function registrarCliente(datos: Omit<Cliente, "id" | "creado_en"> & { id?: string }): Cliente {
  const existente = datos.id ? snapshot.estado.clientes.find((c) => c.id === datos.id) : undefined;
  const cliente: Cliente = existente ?? {
    id: datos.id ?? nuevoId("cli"),
    nombre: datos.nombre.trim(),
    telefono: datos.telefono.trim(),
    email: datos.email.trim(),
    creado_en: new Date().toISOString(),
  };
  const yaTieneTarjeta = snapshot.estado.tarjetas.some((t) => t.cliente_id === cliente.id);
  if (!existente || !yaTieneTarjeta) {
    ejecutar({
      tipo: "registrarCliente",
      cliente,
      tarjetaId: nuevoId("tlc"),
      numeroTarjeta: numeroDeTarjeta(new Set(snapshot.estado.tarjetas.map((t) => t.numero))),
    });
  }
  return cliente;
}

/**
 * Garantiza que la persona con sesión tenga ficha de cliente y tarjeta. Se
 * llama al abrir "Mi tarjeta" por si el alta no alcanzó a emitirla.
 */
function asegurarClienteDeSesion(s: Sesion) {
  if (s.rol !== "cliente") return null;
  const existente = snapshot.estado.clientes.find((c) => c.id === s.id);
  if (existente && snapshot.estado.tarjetas.some((t) => t.cliente_id === s.id)) return existente;
  return registrarCliente({ id: s.id, nombre: s.nombre, telefono: "", email: "" });
}
