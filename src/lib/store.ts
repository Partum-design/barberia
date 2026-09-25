"use client";

import { useCallback, useEffect, useState } from "react";
import { authDisponible, getSupabaseBrowser } from "@/lib/supabase/client";

// ============================================================================
// Almacén de la barbería. Mientras el proyecto no esté conectado a Supabase,
// los datos viven en localStorage del navegador: agendar, cobrar, dar de alta
// barberos o emitir tarjetas de lealtad funciona de verdad y persiste entre
// recargas. Arranca vacío: no trae clientes, barberos ni cifras de ejemplo.
//
// La sesión es el único dato que ya no es siempre local: si el proyecto tiene
// credenciales de Supabase, `useBarberia` toma la sesión real (Google OAuth,
// contraseña o enlace mágico) y la traduce al mismo tipo `Sesion` que ya
// consumían todas las páginas. Así la autenticación pasa a ser real sin que
// ninguna pantalla del producto tenga que cambiar.
// ============================================================================

export type Rol = "cliente" | "barbero" | "admin";

export type MetodoPago = "tarjeta" | "efectivo";
export type EstadoPago = "pagado" | "pendiente";

export type Sesion = {
  rol: Rol;
  id: string;
  nombre: string;
  subtitulo: string;
};

export type Cita = {
  id: string;
  cliente_id: string;
  cliente_nombre: string;
  barbero_id: string;
  barbero_nombre: string;
  especialidad: string;
  inicio: string; // ISO
  fin: string;
  modalidad: "presencial" | "domicilio";
  estado: "confirmada" | "asistida" | "cancelada";
  precio: number;
  direccion_domicilio: string | null;
  metodo_pago: MetodoPago;
  estado_pago: EstadoPago;
};

export type Barbero = {
  id: string;
  nombre: string;
  especialidad: string;
  precio_servicio: number;
  duracion_cita_min: number;
  acepta_domicilio: boolean;
  biografia: string;
  activo: boolean;
};

export type DiaSemana = "lun" | "mar" | "mie" | "jue" | "vie" | "sab" | "dom";

export const DIAS_SEMANA: { id: DiaSemana; label: string }[] = [
  { id: "lun", label: "Lunes" },
  { id: "mar", label: "Martes" },
  { id: "mie", label: "Miércoles" },
  { id: "jue", label: "Jueves" },
  { id: "vie", label: "Viernes" },
  { id: "sab", label: "Sábado" },
  { id: "dom", label: "Domingo" },
];

export type BloqueHorario = { activo: boolean; inicio: string; fin: string };
export type HorarioSemanal = Record<DiaSemana, BloqueHorario>;

export type Ficha = {
  id: string;
  cliente_id: string;
  cliente_nombre: string;
  barbero_id: string;
  servicio: string;
  notas: string;
  creado_en: string; // ISO
};

export type RecompensasConfig = {
  citas_requeridas: number;
  valor_descuento: number;
};

export type BarberiaConfig = {
  nombre: string;
  /** Frase corta bajo el nombre en la portada */
  eslogan: string;
  /** Quiénes son: el párrafo de la sección "Nosotros" de la portada */
  descripcion: string;
  direccion: string;
  /** Enlace de Google Maps para el botón "Cómo llegar" */
  mapa_url: string;
  telefono: string;
  whatsapp: string;
  email: string;
  instagram: string;
  facebook: string;
  tiktok: string;
  anio_fundacion: string;
  /** Horario de atención al público, mostrado en la portada */
  horario: HorarioSemanal;
};

// --- Clientes y tarjetas de lealtad ----------------------------------------

export type Cliente = {
  id: string;
  nombre: string;
  telefono: string;
  email: string;
  creado_en: string; // ISO
};

export type EstadoTarjeta = "activa" | "suspendida";

/**
 * Tarjeta de lealtad: una por cliente, con número propio para identificarla
 * en mostrador (código QR) y en Google Wallet.
 *
 * Los sellos salen de dos fuentes: las citas asistidas del cliente, que se
 * cuentan solas, y los `sellos_extra` que el mostrador pone a mano para las
 * visitas sin cita. Así nunca hay que llevar dos contadores sincronizados.
 */
export type TarjetaLealtad = {
  id: string;
  numero: string;
  cliente_id: string;
  emitida_en: string; // ISO
  sellos_extra: number;
  estado: EstadoTarjeta;
  /** Última vez que el cliente la guardó en Google Wallet */
  wallet_guardada_en: string | null;
};

// --- Catálogo, inventario y caja -------------------------------------------

export type Servicio = {
  id: string;
  nombre: string;
  categoria: "Corte" | "Barba" | "Color" | "Ritual" | "Paquete";
  precio: number;
  duracion_min: number;
  /** Porcentaje del servicio que se lleva el barbero */
  comision_pct: number;
  activo: boolean;
};

export type Producto = {
  id: string;
  nombre: string;
  categoria: "Cuidado" | "Peinado" | "Afeitado" | "Consumible";
  existencias: number;
  minimo: number;
  costo: number;
  precio_venta: number;
  unidad: string;
};

export type Gasto = {
  id: string;
  concepto: string;
  categoria: "Renta" | "Insumos" | "Nómina" | "Publicidad" | "Servicios" | "Otros";
  monto: number;
  fecha: string; // ISO
};

const PREFIJO = "barberia-v1";
const KEY_CITAS = `${PREFIJO}-citas`;
const KEY_SESION = `${PREFIJO}-sesion`;
const KEY_BARBEROS = `${PREFIJO}-barberos`;
const KEY_HORARIOS = `${PREFIJO}-horarios`;
const KEY_FICHAS = `${PREFIJO}-fichas`;
const KEY_RECOMPENSAS = `${PREFIJO}-recompensas`;
const KEY_BARBERIA = `${PREFIJO}-barberia`;
const KEY_CANJES = `${PREFIJO}-canjes`;
const KEY_SERVICIOS = `${PREFIJO}-servicios`;
const KEY_PRODUCTOS = `${PREFIJO}-productos`;
const KEY_GASTOS = `${PREFIJO}-gastos`;
const KEY_CLIENTES = `${PREFIJO}-clientes`;
const KEY_TARJETAS = `${PREFIJO}-tarjetas`;

/** Sesión del administrador cuando todavía no hay Supabase conectado. */
export const SESION_ADMIN_LOCAL: Sesion = {
  rol: "admin",
  id: "admin-local",
  nombre: "Administración",
  subtitulo: "Administrador",
};

const vacio = <T,>(): T[] => [];

function horarioPorDefecto(): HorarioSemanal {
  const finde: DiaSemana[] = ["sab", "dom"];
  return DIAS_SEMANA.reduce((acc, d) => {
    acc[d.id] = { activo: !finde.includes(d.id), inicio: "09:00", fin: "14:00" };
    return acc;
  }, {} as HorarioSemanal);
}

/** Horario del local sin configurar: todo cerrado hasta que el admin lo llene. */
function horarioLocalVacio(): HorarioSemanal {
  return DIAS_SEMANA.reduce((acc, d) => {
    acc[d.id] = { activo: false, inicio: "10:00", fin: "20:00" };
    return acc;
  }, {} as HorarioSemanal);
}

export const BARBERIA_VACIA: BarberiaConfig = {
  nombre: "",
  eslogan: "",
  descripcion: "",
  direccion: "",
  mapa_url: "",
  telefono: "",
  whatsapp: "",
  email: "",
  instagram: "",
  facebook: "",
  tiktok: "",
  anio_fundacion: "",
  horario: horarioLocalVacio(),
};

/**
 * Número legible de tarjeta: cuatro letras del negocio no hacen falta, basta
 * un prefijo fijo y ocho cifras aleatorias agrupadas para dictarlo en voz alta.
 */
function numeroDeTarjeta(existentes: Set<string>) {
  let numero = "";
  do {
    const cifras = Array.from(crypto.getRandomValues(new Uint32Array(2)))
      .map((n) => String(n % 10_000).padStart(4, "0"))
      .join("-");
    numero = `LC-${cifras}`;
  } while (existentes.has(numero));
  return numero;
}

function leerJSON<T>(key: string, fallback: () => T): T {
  if (typeof window === "undefined") return fallback();
  const raw = window.localStorage.getItem(key);
  if (raw) {
    try {
      return JSON.parse(raw) as T;
    } catch {
      /* re-seed */
    }
  }
  const seed = fallback();
  window.localStorage.setItem(key, JSON.stringify(seed));
  return seed;
}

function leerCitas(): Cita[] {
  return leerJSON(KEY_CITAS, vacio<Cita>);
}

function leerSesion(): Sesion | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(KEY_SESION);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Sesion;
  } catch {
    return null;
  }
}

function leerBarberos(): Barbero[] {
  return leerJSON(KEY_BARBEROS, vacio<Barbero>);
}

function guardarBarberosLocal(lista: Barbero[]) {
  window.localStorage.setItem(KEY_BARBEROS, JSON.stringify(lista));
}

function leerHorarios(): Record<string, HorarioSemanal> {
  return leerJSON(KEY_HORARIOS, () => ({}) as Record<string, HorarioSemanal>);
}

function guardarHorariosLocal(mapa: Record<string, HorarioSemanal>) {
  window.localStorage.setItem(KEY_HORARIOS, JSON.stringify(mapa));
}

function leerFichas(): Ficha[] {
  return leerJSON(KEY_FICHAS, vacio<Ficha>);
}

function guardarFichasLocal(lista: Ficha[]) {
  window.localStorage.setItem(KEY_FICHAS, JSON.stringify(lista));
}

function leerRecompensasConfig(): RecompensasConfig {
  return leerJSON(KEY_RECOMPENSAS, () => ({ citas_requeridas: 5, valor_descuento: 20 }));
}

function guardarRecompensasConfigLocal(cfg: RecompensasConfig) {
  window.localStorage.setItem(KEY_RECOMPENSAS, JSON.stringify(cfg));
}

function leerBarberiaConfig(): BarberiaConfig {
  // Mezcla con la forma vacía para que un guardado antiguo con menos campos
  // no deje huecos `undefined` en los formularios.
  const guardada = leerJSON<Partial<BarberiaConfig>>(KEY_BARBERIA, () => BARBERIA_VACIA);
  return {
    ...BARBERIA_VACIA,
    ...guardada,
    horario: { ...BARBERIA_VACIA.horario, ...(guardada.horario ?? {}) },
  };
}

/**
 * Nombre comercial para logotipos y títulos. Cae a la variable de entorno y,
 * si tampoco existe, a un genérico: nunca a una marca de ejemplo.
 */
export const NOMBRE_POR_DEFECTO = process.env.NEXT_PUBLIC_NOMBRE_NEGOCIO || "Barbería";

export function nombreDelNegocio(cfg: Pick<BarberiaConfig, "nombre">) {
  return cfg.nombre.trim() || NOMBRE_POR_DEFECTO;
}

/** Lectura suelta de los datos del negocio, para piezas que no usan el hook. */
export function leerDatosNegocio(): BarberiaConfig {
  if (typeof window === "undefined") return BARBERIA_VACIA;
  return leerBarberiaConfig();
}

function guardarBarberiaConfigLocal(cfg: BarberiaConfig) {
  window.localStorage.setItem(KEY_BARBERIA, JSON.stringify(cfg));
  // Avisa a las piezas sueltas (logotipo, portada) de que el negocio cambió.
  window.dispatchEvent(new Event("barberia:datos"));
}

function leerCanjes(): Record<string, number> {
  return leerJSON(KEY_CANJES, () => ({}) as Record<string, number>);
}

function guardarCanjesLocal(mapa: Record<string, number>) {
  window.localStorage.setItem(KEY_CANJES, JSON.stringify(mapa));
}

function leerServicios(): Servicio[] {
  return leerJSON(KEY_SERVICIOS, vacio<Servicio>);
}
function guardarServiciosLocal(lista: Servicio[]) {
  window.localStorage.setItem(KEY_SERVICIOS, JSON.stringify(lista));
}

function leerProductos(): Producto[] {
  return leerJSON(KEY_PRODUCTOS, vacio<Producto>);
}
function guardarProductosLocal(lista: Producto[]) {
  window.localStorage.setItem(KEY_PRODUCTOS, JSON.stringify(lista));
}

function leerGastos(): Gasto[] {
  return leerJSON(KEY_GASTOS, vacio<Gasto>);
}
function guardarGastosLocal(lista: Gasto[]) {
  window.localStorage.setItem(KEY_GASTOS, JSON.stringify(lista));
}

function leerClientes(): Cliente[] {
  return leerJSON(KEY_CLIENTES, vacio<Cliente>);
}
function guardarClientesLocal(lista: Cliente[]) {
  window.localStorage.setItem(KEY_CLIENTES, JSON.stringify(lista));
}

function leerTarjetas(): TarjetaLealtad[] {
  return leerJSON(KEY_TARJETAS, vacio<TarjetaLealtad>);
}
function guardarTarjetasLocal(lista: TarjetaLealtad[]) {
  window.localStorage.setItem(KEY_TARJETAS, JSON.stringify(lista));
}

/** Emite la tarjeta del cliente si aún no tiene una. Devuelve la lista final. */
function conTarjetaPara(clienteId: string, lista: TarjetaLealtad[]) {
  if (lista.some((t) => t.cliente_id === clienteId)) return lista;
  const nueva: TarjetaLealtad = {
    id: `tlc-${crypto.randomUUID().slice(0, 8)}`,
    numero: numeroDeTarjeta(new Set(lista.map((t) => t.numero))),
    cliente_id: clienteId,
    emitida_en: new Date().toISOString(),
    sellos_extra: 0,
    estado: "activa",
    wallet_guardada_en: null,
  };
  return [...lista, nueva];
}

// Hook principal: estado reactivo + mutadores persistentes.
export function useBarberia() {
  const [listo, setListo] = useState(false);
  const [citas, setCitas] = useState<Cita[]>([]);
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [barberos, setBarberos] = useState<Barbero[]>([]);
  const [horarios, setHorarios] = useState<Record<string, HorarioSemanal>>({});
  const [fichas, setFichas] = useState<Ficha[]>([]);
  const [recompensasConfig, setRecompensasConfig] = useState<RecompensasConfig>({
    citas_requeridas: 5,
    valor_descuento: 20,
  });
  const [barberiaConfig, setBarberiaConfig] = useState<BarberiaConfig>(BARBERIA_VACIA);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [tarjetas, setTarjetas] = useState<TarjetaLealtad[]>([]);
  const [canjes, setCanjes] = useState<Record<string, number>>({});
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [gastos, setGastos] = useState<Gasto[]>([]);

  useEffect(() => {
    setCitas(leerCitas());
    setSesion(leerSesion());
    setBarberos(leerBarberos());
    setHorarios(leerHorarios());
    setFichas(leerFichas());
    setRecompensasConfig(leerRecompensasConfig());
    setBarberiaConfig(leerBarberiaConfig());
    setCanjes(leerCanjes());
    setServicios(leerServicios());
    setProductos(leerProductos());
    setGastos(leerGastos());
    setClientes(leerClientes());
    setTarjetas(leerTarjetas());
    setListo(true);
  }, []);

  // Sesión real: si hay Supabase configurado, manda sobre la sesión local.
  // El import es dinámico para que el mapeo de roles no entre en el bundle de
  // quien todavía trabaja en modo local.
  useEffect(() => {
    if (!authDisponible) return;
    const supabase = getSupabaseBrowser();
    if (!supabase) return;

    let cancelado = false;

    const aplicar = async (usuario: Parameters<typeof import("@/lib/auth/roles").sesionDesdeUsuario>[0] | null) => {
      if (cancelado) return;
      if (!usuario) {
        setSesion(leerSesion());
        return;
      }
      const { sesionDesdeUsuario } = await import("@/lib/auth/roles");
      const s = sesionDesdeUsuario(usuario);
      if (cancelado) return;
      setSesion(s);
      window.localStorage.setItem(KEY_SESION, JSON.stringify(s));
    };

    supabase.auth.getUser().then(({ data }) => aplicar(data.user ?? null));

    const { data: sub } = supabase.auth.onAuthStateChange((evento, sesionSupabase) => {
      if (evento === "SIGNED_OUT") {
        window.localStorage.removeItem(KEY_SESION);
        setSesion(null);
        return;
      }
      aplicar(sesionSupabase?.user ?? null);
    });

    return () => {
      cancelado = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const guardar = useCallback((nuevas: Cita[]) => {
    setCitas(nuevas);
    window.localStorage.setItem(KEY_CITAS, JSON.stringify(nuevas));
  }, []);

  /**
   * Acceso local, sólo mientras no hay Supabase: permite al dueño configurar
   * el negocio y probar los paneles de barbero y cliente con los registros
   * que él mismo dio de alta.
   */
  const entrarLocal = useCallback((s: Sesion) => {
    setSesion(s);
    window.localStorage.setItem(KEY_SESION, JSON.stringify(s));
    return s;
  }, []);

  const logout = useCallback(() => {
    setSesion(null);
    window.localStorage.removeItem(KEY_SESION);
    // Cierra también la sesión real, si la hay: quedarse con la cookie viva
    // tras "cerrar sesión" es el fallo clásico de las sesiones híbridas.
    getSupabaseBrowser()?.auth.signOut();
  }, []);

  const crearCita = useCallback(
    (datos: {
      barbero_id: string;
      inicio: string;
      fin: string;
      modalidad: "presencial" | "domicilio";
      metodo_pago: MetodoPago;
      direccion_domicilio?: string;
    }) => {
      const barbero = leerBarberos().find((m) => m.id === datos.barbero_id);
      const cliente = leerSesion();
      if (!cliente || cliente.rol !== "cliente") return null;
      const nueva: Cita = {
        id: `c-${crypto.randomUUID().slice(0, 8)}`,
        cliente_id: cliente.id,
        cliente_nombre: cliente.nombre,
        barbero_id: datos.barbero_id,
        barbero_nombre: barbero?.nombre ?? "Barbero",
        especialidad: barbero?.especialidad ?? "",
        inicio: datos.inicio,
        fin: datos.fin,
        modalidad: datos.modalidad,
        estado: "confirmada",
        precio: barbero?.precio_servicio ?? 0,
        direccion_domicilio:
          datos.modalidad === "domicilio" ? datos.direccion_domicilio || "Domicilio del cliente" : null,
        metodo_pago: datos.metodo_pago,
        estado_pago: datos.metodo_pago === "efectivo" ? "pendiente" : "pagado",
      };
      guardar([...leerCitas(), nueva]);
      return nueva;
    },
    [guardar]
  );

  // El barbero o recepción confirma que el cliente pagó en efectivo.
  const cobrarEfectivo = useCallback(
    (id: string) => {
      guardar(
        leerCitas().map((c) => (c.id === id ? { ...c, estado_pago: "pagado" as const } : c))
      );
    },
    [guardar]
  );

  const marcarAsistida = useCallback(
    (id: string) => {
      guardar(
        leerCitas().map((c) => (c.id === id ? { ...c, estado: "asistida" as const } : c))
      );
    },
    [guardar]
  );

  const cancelarCita = useCallback(
    (id: string) => {
      guardar(
        leerCitas().map((c) => (c.id === id ? { ...c, estado: "cancelada" as const } : c))
      );
    },
    [guardar]
  );

  const agregarBarbero = useCallback((datos: Omit<Barbero, "id" | "activo">) => {
    const nuevo: Barbero = {
      id: `bar-${crypto.randomUUID().slice(0, 8)}`,
      activo: true,
      ...datos,
    };
    const lista = [...leerBarberos(), nuevo];
    guardarBarberosLocal(lista);
    setBarberos(lista);
    return nuevo;
  }, []);

  const actualizarBarbero = useCallback((id: string, cambios: Partial<Barbero>) => {
    const lista = leerBarberos().map((m) => (m.id === id ? { ...m, ...cambios } : m));
    guardarBarberosLocal(lista);
    setBarberos(lista);
  }, []);

  const toggleActivoBarbero = useCallback((id: string) => {
    const lista = leerBarberos().map((m) => (m.id === id ? { ...m, activo: !m.activo } : m));
    guardarBarberosLocal(lista);
    setBarberos(lista);
  }, []);

  const guardarHorarioDia = useCallback(
    (barberoId: string, dia: DiaSemana, cambios: Partial<BloqueHorario>) => {
      const mapa = leerHorarios();
      const actual = mapa[barberoId] ?? horarioPorDefecto();
      const nuevoMapa = {
        ...mapa,
        [barberoId]: { ...actual, [dia]: { ...actual[dia], ...cambios } },
      };
      guardarHorariosLocal(nuevoMapa);
      setHorarios(nuevoMapa);
    },
    []
  );

  const horarioDeBarbero = useCallback(
    (barberoId: string): HorarioSemanal => horarios[barberoId] ?? horarioPorDefecto(),
    [horarios]
  );

  const agregarFicha = useCallback(
    (datos: {
      cliente_id: string;
      cliente_nombre: string;
      barbero_id: string;
      servicio: string;
      notas: string;
    }) => {
      const nuevo: Ficha = {
        id: `ficha-${crypto.randomUUID().slice(0, 8)}`,
        creado_en: new Date().toISOString(),
        ...datos,
      };
      const lista = [nuevo, ...leerFichas()];
      guardarFichasLocal(lista);
      setFichas(lista);
      return nuevo;
    },
    []
  );

  const actualizarRecompensasConfig = useCallback((cambios: Partial<RecompensasConfig>) => {
    const nuevo = { ...leerRecompensasConfig(), ...cambios };
    guardarRecompensasConfigLocal(nuevo);
    setRecompensasConfig(nuevo);
  }, []);

  const actualizarBarberiaConfig = useCallback((cambios: Partial<BarberiaConfig>) => {
    const nuevo = { ...leerBarberiaConfig(), ...cambios };
    guardarBarberiaConfigLocal(nuevo);
    setBarberiaConfig(nuevo);
  }, []);

  // El cliente canjea una recompensa desbloqueada (tope: las que tenga ganadas).
  const canjearRecompensa = useCallback(
    (clienteId: string, ganadas: number) => {
      const mapa = leerCanjes();
      const actual = mapa[clienteId] ?? 0;
      if (actual >= ganadas) return;
      const nuevoMapa = { ...mapa, [clienteId]: actual + 1 };
      guardarCanjesLocal(nuevoMapa);
      setCanjes(nuevoMapa);
    },
    []
  );

  // --- Catálogo de servicios ---
  const agregarServicio = useCallback((datos: Omit<Servicio, "id" | "activo">) => {
    const nuevo: Servicio = { id: `srv-${crypto.randomUUID().slice(0, 8)}`, activo: true, ...datos };
    const lista = [...leerServicios(), nuevo];
    guardarServiciosLocal(lista);
    setServicios(lista);
    return nuevo;
  }, []);

  const actualizarServicio = useCallback((id: string, cambios: Partial<Servicio>) => {
    const lista = leerServicios().map((s) => (s.id === id ? { ...s, ...cambios } : s));
    guardarServiciosLocal(lista);
    setServicios(lista);
  }, []);

  // --- Inventario ---
  const agregarProducto = useCallback((datos: Omit<Producto, "id">) => {
    const nuevo: Producto = { id: `prd-${crypto.randomUUID().slice(0, 8)}`, ...datos };
    const lista = [...leerProductos(), nuevo];
    guardarProductosLocal(lista);
    setProductos(lista);
    return nuevo;
  }, []);

  /** Entradas y salidas de almacén; nunca deja las existencias en negativo. */
  const ajustarExistencias = useCallback((id: string, delta: number) => {
    const lista = leerProductos().map((p) =>
      p.id === id ? { ...p, existencias: Math.max(0, p.existencias + delta) } : p
    );
    guardarProductosLocal(lista);
    setProductos(lista);
  }, []);

  // --- Gastos ---
  const agregarGasto = useCallback((datos: Omit<Gasto, "id" | "fecha"> & { fecha?: string }) => {
    const nuevo: Gasto = {
      id: `gto-${crypto.randomUUID().slice(0, 8)}`,
      fecha: datos.fecha ?? new Date().toISOString(),
      concepto: datos.concepto,
      categoria: datos.categoria,
      monto: datos.monto,
    };
    const lista = [nuevo, ...leerGastos()];
    guardarGastosLocal(lista);
    setGastos(lista);
    return nuevo;
  }, []);

  const eliminarGasto = useCallback((id: string) => {
    const lista = leerGastos().filter((g) => g.id !== id);
    guardarGastosLocal(lista);
    setGastos(lista);
  }, []);

  // --- Clientes y tarjetas de lealtad ---

  /** Da de alta a un cliente y le emite su tarjeta de lealtad al instante. */
  const registrarCliente = useCallback(
    (datos: Omit<Cliente, "id" | "creado_en"> & { id?: string }) => {
      const lista = leerClientes();
      const existente = datos.id ? lista.find((c) => c.id === datos.id) : undefined;
      const cliente: Cliente = existente ?? {
        id: datos.id ?? `cli-${crypto.randomUUID().slice(0, 8)}`,
        nombre: datos.nombre.trim(),
        telefono: datos.telefono.trim(),
        email: datos.email.trim(),
        creado_en: new Date().toISOString(),
      };
      if (!existente) {
        const nuevaLista = [...lista, cliente];
        guardarClientesLocal(nuevaLista);
        setClientes(nuevaLista);
      }
      const nuevasTarjetas = conTarjetaPara(cliente.id, leerTarjetas());
      guardarTarjetasLocal(nuevasTarjetas);
      setTarjetas(nuevasTarjetas);
      return cliente;
    },
    []
  );

  const actualizarCliente = useCallback((id: string, cambios: Partial<Omit<Cliente, "id">>) => {
    const lista = leerClientes().map((c) => (c.id === id ? { ...c, ...cambios } : c));
    guardarClientesLocal(lista);
    setClientes(lista);
  }, []);

  /**
   * Garantiza que la persona con sesión tenga ficha de cliente y tarjeta. Se
   * llama al abrir "Mi tarjeta": con Supabase, el cliente llega por Google y
   * nunca pasó por el alta del mostrador.
   */
  const asegurarClienteDeSesion = useCallback(
    (s: Sesion) => {
      if (s.rol !== "cliente") return null;
      return registrarCliente({ id: s.id, nombre: s.nombre, telefono: "", email: "" });
    },
    [registrarCliente]
  );

  /** Sellos puestos a mano en mostrador (visitas sin cita o correcciones). */
  const ajustarSellos = useCallback((tarjetaId: string, delta: number) => {
    const lista = leerTarjetas().map((t) =>
      t.id === tarjetaId ? { ...t, sellos_extra: Math.max(0, t.sellos_extra + delta) } : t
    );
    guardarTarjetasLocal(lista);
    setTarjetas(lista);
  }, []);

  const cambiarEstadoTarjeta = useCallback((tarjetaId: string, estado: EstadoTarjeta) => {
    const lista = leerTarjetas().map((t) => (t.id === tarjetaId ? { ...t, estado } : t));
    guardarTarjetasLocal(lista);
    setTarjetas(lista);
  }, []);

  const marcarWalletGuardada = useCallback((tarjetaId: string) => {
    const lista = leerTarjetas().map((t) =>
      t.id === tarjetaId ? { ...t, wallet_guardada_en: new Date().toISOString() } : t
    );
    guardarTarjetasLocal(lista);
    setTarjetas(lista);
  }, []);

  /** Borra todo lo guardado en este navegador y deja el sistema en blanco. */
  const borrarDatosLocales = useCallback(() => {
    [
      KEY_CITAS,
      KEY_BARBEROS,
      KEY_HORARIOS,
      KEY_FICHAS,
      KEY_RECOMPENSAS,
      KEY_BARBERIA,
      KEY_CANJES,
      KEY_SERVICIOS,
      KEY_PRODUCTOS,
      KEY_GASTOS,
      KEY_CLIENTES,
      KEY_TARJETAS,
    ].forEach((k) => window.localStorage.removeItem(k));
    setCitas(leerCitas());
    setBarberos(leerBarberos());
    setHorarios(leerHorarios());
    setFichas(leerFichas());
    setRecompensasConfig(leerRecompensasConfig());
    setBarberiaConfig(leerBarberiaConfig());
    setCanjes(leerCanjes());
    setServicios(leerServicios());
    setProductos(leerProductos());
    setGastos(leerGastos());
    setClientes(leerClientes());
    setTarjetas(leerTarjetas());
  }, []);

  return {
    listo,
    citas,
    sesion,
    barberos,
    fichas,
    recompensasConfig,
    barberiaConfig,
    canjes,
    servicios,
    productos,
    gastos,
    clientes,
    tarjetas,
    entrarLocal,
    logout,
    crearCita,
    marcarAsistida,
    cancelarCita,
    cobrarEfectivo,
    agregarBarbero,
    actualizarBarbero,
    toggleActivoBarbero,
    guardarHorarioDia,
    horarioDeBarbero,
    agregarFicha,
    actualizarRecompensasConfig,
    actualizarBarberiaConfig,
    canjearRecompensa,
    agregarServicio,
    actualizarServicio,
    agregarProducto,
    ajustarExistencias,
    agregarGasto,
    eliminarGasto,
    registrarCliente,
    actualizarCliente,
    asegurarClienteDeSesion,
    ajustarSellos,
    cambiarEstadoTarjeta,
    marcarWalletGuardada,
    borrarDatosLocales,
  };
}

// ---------------------------------------------------------------------------
// Derivaciones de negocio
// ---------------------------------------------------------------------------

export type ClienteResumen = {
  id: string;
  nombre: string;
  visitas: number;
  gastoTotal: number;
  ticketMedio: number;
  ultimaVisita: string | null;
  proximaCita: string | null;
  barberoPreferido: string;
  diasDesdeUltima: number | null;
  cadenciaDias: number | null;
  /** Riesgo de fuga: lleva más del doble de su cadencia habitual sin volver */
  enRiesgo: boolean;
};

/**
 * Construye la ficha 360 de cada cliente a partir de las citas. No hay una
 * tabla de clientes: el historial de citas ya contiene toda la verdad, y
 * duplicarla sólo abriría la puerta a que ambas se desincronicen.
 */
export function resumirClientes(citas: Cita[]): ClienteResumen[] {
  const ahora = Date.now();
  const porCliente = new Map<string, Cita[]>();

  for (const c of citas) {
    if (c.estado === "cancelada") continue;
    const lista = porCliente.get(c.cliente_id) ?? [];
    lista.push(c);
    porCliente.set(c.cliente_id, lista);
  }

  const resumen: ClienteResumen[] = [];

  for (const [id, lista] of porCliente) {
    const ordenadas = [...lista].sort((a, b) => a.inicio.localeCompare(b.inicio));
    const pasadas = ordenadas.filter((c) => new Date(c.inicio).getTime() <= ahora);
    const futuras = ordenadas.filter((c) => new Date(c.inicio).getTime() > ahora);

    const gastoTotal = ordenadas
      .filter((c) => c.estado_pago === "pagado")
      .reduce((acc, c) => acc + c.precio, 0);

    // Barbero preferido: el que más veces la ha atendido.
    const conteo = new Map<string, number>();
    for (const c of ordenadas) conteo.set(c.barbero_nombre, (conteo.get(c.barbero_nombre) ?? 0) + 1);
    const barberoPreferido = [...conteo.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

    const ultima = pasadas.at(-1) ?? null;
    const diasDesdeUltima = ultima
      ? Math.floor((ahora - new Date(ultima.inicio).getTime()) / 86_400_000)
      : null;

    // Cadencia: media de días entre visitas consecutivas.
    let cadenciaDias: number | null = null;
    if (pasadas.length > 1) {
      let suma = 0;
      for (let i = 1; i < pasadas.length; i++) {
        suma += (new Date(pasadas[i].inicio).getTime() - new Date(pasadas[i - 1].inicio).getTime()) / 86_400_000;
      }
      cadenciaDias = Math.round(suma / (pasadas.length - 1));
    }

    resumen.push({
      id,
      nombre: ordenadas[0].cliente_nombre,
      visitas: pasadas.length,
      gastoTotal,
      ticketMedio: pasadas.length > 0 ? Math.round(gastoTotal / pasadas.length) : 0,
      ultimaVisita: ultima?.inicio ?? null,
      proximaCita: futuras[0]?.inicio ?? null,
      barberoPreferido,
      diasDesdeUltima,
      cadenciaDias,
      enRiesgo:
        futuras.length === 0 &&
        cadenciaDias !== null &&
        diasDesdeUltima !== null &&
        diasDesdeUltima > cadenciaDias * 2,
    });
  }

  return resumen.sort((a, b) => b.gastoTotal - a.gastoTotal);
}

// Lealtad: 1 sello por cita asistida más los sellos puestos a mano en la
// tarjeta; cada N sellos (config de la barbería, 5 por defecto) se gana una
// recompensa.
export function calcularLealtad(
  citas: Cita[],
  clienteId: string,
  citasRequeridas = 5,
  sellosExtra = 0
) {
  const requerido = citasRequeridas > 0 ? citasRequeridas : 5;
  const puntos =
    citas.filter((c) => c.cliente_id === clienteId && c.estado === "asistida").length +
    Math.max(0, sellosExtra);
  return {
    puntos,
    progreso: puntos % requerido,
    recompensasGanadas: Math.floor(puntos / requerido),
    faltan: requerido - (puntos % requerido),
    requerido,
  };
}
