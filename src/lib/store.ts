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
  type Operacion,
  type Producto,
  type RecompensasConfig,
  type Servicio,
  type Sesion,
} from "@/lib/datos/modelo";

// Re-exportados para que las pantallas sigan importando todo desde aquí. En un
// módulo "use client" Next no admite `export *`: la lista tiene que ser explícita.
export {
  BARBERIA_VACIA,
  DIAS_SEMANA,
  NOMBRE_POR_DEFECTO,
  calcularLealtad,
  nombreDelNegocio,
  resumirClientes,
} from "@/lib/datos/modelo";
export type {
  Barbero,
  BarberiaConfig,
  BloqueHorario,
  Cita,
  Cliente,
  ClienteResumen,
  DiaSemana,
  EstadoPago,
  EstadoTarjeta,
  Ficha,
  Gasto,
  HorarioSemanal,
  MetodoPago,
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

type Snapshot = { listo: boolean; sesion: Sesion | null; estado: Estado };

let snapshot: Snapshot = { listo: false, sesion: null, estado: estadoVacio() };
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

let cargaEnCurso: Promise<void> | null = null;

async function cargar() {
  if (cargaEnCurso) return cargaEnCurso;
  cargaEnCurso = (async () => {
    try {
      const res = await fetch("/api/datos", { cache: "no-store", credentials: "same-origin" });
      if (res.ok) aplicarDelServidor(((await res.json()) as { estado: Estado }).estado);
    } catch (err) {
      console.error("No se pudieron cargar los datos", err);
    } finally {
      cargaEnCurso = null;
    }
  })();
  return cargaEnCurso;
}

async function sesionActual(): Promise<Sesion | null> {
  const supabase = getSupabaseBrowser();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { sesionDesdeUsuario } = await import("@/lib/auth/roles");
  return sesionDesdeUsuario(data.user);
}

function iniciar() {
  if (iniciado || typeof window === "undefined") return;
  iniciado = true;

  const refrescarTodo = async () => {
    const sesion = await sesionActual();
    publicar({ sesion });
    await cargar();
    publicar({ listo: true });
  };

  refrescarTodo();

  const supabase = getSupabaseBrowser();
  supabase?.auth.onAuthStateChange((evento) => {
    if (evento === "SIGNED_IN" || evento === "SIGNED_OUT" || evento === "USER_UPDATED") {
      // Fuera del callback: Supabase no admite llamadas a auth dentro de él.
      setTimeout(refrescarTodo, 0);
    }
  });

  // Lo que hagan otros (una reserva nueva, un cobro) llega al volver a la
  // pestaña y, mientras está abierta, cada 30 segundos.
  window.addEventListener("focus", () => void cargar());
  window.setInterval(() => {
    if (document.visibilityState === "visible") void cargar();
  }, 30_000);
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

function logout() {
  publicar({ sesion: null });
  getSupabaseBrowser()?.auth.signOut();
}

function suscribir(f: () => void) {
  oyentes.add(f);
  return () => oyentes.delete(f);
}

const leer = () => snapshot;

// Hook principal: estado compartido + mutadores.
export function useBarberia() {
  const { listo, sesion, estado } = useSyncExternalStore(suscribir, leer, leer);

  useEffect(iniciar, []);

  const horarioDeBarbero = useCallback(
    (barberoId: string): HorarioSemanal => estado.horarios[barberoId] ?? horarioPorDefecto(),
    [estado.horarios]
  );

  return {
    listo,
    sesion,
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
    horarioDeBarbero,
    crearCita,
    marcarAsistida: (id: string) => ejecutar({ tipo: "marcarAsistida", id }),
    cancelarCita: (id: string) => ejecutar({ tipo: "cancelarCita", id }),
    cobrarEfectivo: (id: string) => ejecutar({ tipo: "cobrarEfectivo", id }),
    actualizarBarbero: (id: string, cambios: Partial<Barbero>) => ejecutar({ tipo: "actualizarBarbero", id, cambios }),
    toggleActivoBarbero: (id: string) => ejecutar({ tipo: "toggleActivoBarbero", id }),
    guardarHorarioDia: (barberoId: string, dia: DiaSemana, cambios: Partial<BloqueHorario>) =>
      ejecutar({ tipo: "guardarHorarioDia", barberoId, dia, cambios }),
    agregarFicha,
    actualizarRecompensasConfig: (cambios: Partial<RecompensasConfig>) =>
      ejecutar({ tipo: "actualizarRecompensasConfig", cambios }),
    actualizarBarberiaConfig: (cambios: Partial<BarberiaConfig>) => ejecutar({ tipo: "actualizarBarberiaConfig", cambios }),
    canjearRecompensa: (clienteId: string) => ejecutar({ tipo: "canjearRecompensa", clienteId }),
    agregarServicio,
    actualizarServicio: (id: string, cambios: Partial<Servicio>) => ejecutar({ tipo: "actualizarServicio", id, cambios }),
    agregarProducto,
    ajustarExistencias: (id: string, delta: number) => ejecutar({ tipo: "ajustarExistencias", id, delta }),
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

/**
 * Reserva una cita. A diferencia del resto de cambios, espera al servidor:
 * el horario pudo ocuparse mientras el cliente decidía y no se debe mostrar
 * una confirmación que luego se deshace.
 */
async function crearCita(datos: {
  barbero_id: string;
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
