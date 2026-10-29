// ============================================================================
// Modelo de la barbería: tipos, valores por defecto y las operaciones que lo
// modifican. No depende del navegador ni del servidor, así que la misma
// función `aplicarOperacion` corre en los dos lados: en el navegador para que
// la pantalla responda al instante y en /api/datos, que es quien decide de
// verdad y guarda en Supabase.
// ============================================================================

import { horarioReservable } from "@/lib/datos/disponibilidad";

export type Rol = "cliente" | "barbero" | "admin";

export type MetodoPago = "tarjeta" | "efectivo" | "transferencia";

export const METODOS_PAGO: { id: MetodoPago; label: string }[] = [
  { id: "efectivo", label: "Efectivo" },
  { id: "tarjeta", label: "Tarjeta" },
  { id: "transferencia", label: "Transferencia" },
];

/** Cualquier valor raro cae a efectivo: es lo que pasa en el mostrador. */
export function metodoValido(m: unknown): MetodoPago {
  return m === "tarjeta" || m === "transferencia" ? m : "efectivo";
}

/** Propina en pesos: entera, no negativa y con tope razonable. */
export function propinaValida(valor: unknown) {
  const n = Number(valor);
  return Number.isFinite(n) && n > 0 ? Math.min(100_000, Math.round(n)) : 0;
}
export type EstadoPago = "pagado" | "pendiente";

export type Sesion = {
  rol: Rol;
  id: string;
  nombre: string;
  subtitulo: string;
  /** Administrador principal (dueño): el único que gestiona a otros administradores. */
  principal?: boolean;
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
  estado: EstadoCita;
  precio: number;
  direccion_domicilio: string | null;
  metodo_pago: MetodoPago;
  estado_pago: EstadoPago;
  /** Momento en que se confirmó la llegada (escaneo del QR o botón) */
  llegada_en?: string | null;
  /** Nota interna del mostrador: motivo de reprogramación, etc. */
  notas?: string;
  /** Quién la registró: el propio cliente o el personal */
  creada_por?: "cliente" | "personal";
  /** Servicio contratado (el primero si son varios): de él salen el precio y la duración */
  servicio_id?: string | null;
  /** Nombre(s) del servicio; con varios, unidos con « + » */
  servicio_nombre?: string;
  /** Todos los servicios de la cita, en orden. Si falta, es sólo `servicio_id`. */
  servicio_ids?: string[];
  /** Propina que dejó el cliente al pagar (MXN). Es del barbero, no entra en comisión. */
  propina?: number;
  /** Momento del cobro */
  pagada_en?: string | null;
  /**
   * Comisión del barbero (%) congelada al agendar, para que cambiar el
   * catálogo después no reescriba lo ya pagado. Sólo la ve el administrador.
   */
  comision_pct?: number;
  /** El cliente fue eliminado: la cita queda para caja y reportes, no en Clientes */
  cliente_eliminado?: boolean;
};

export type EstadoCita = "confirmada" | "asistida" | "no_asistio" | "cancelada";

export const ETIQUETA_ESTADO_CITA: Record<EstadoCita, string> = {
  confirmada: "Agendada",
  asistida: "Asistió",
  no_asistio: "No asistió",
  cancelada: "Cancelada",
};

/** Cita que ocupa agenda y cuenta para ingresos: ni cancelada ni con falta. */
export const citaActiva = (c: Pick<Cita, "estado">) => c.estado === "confirmada" || c.estado === "asistida";

/** Contenido del QR de una cita: un enlace que el escáner o la cámara del teléfono abren. */
export function enlaceDeCita(id: string, origen = "") {
  return `${origen}/confirmar?cita=${encodeURIComponent(id)}`;
}

/** Saca el id de cita de lo que lea el escáner (enlace completo, ruta o el id solo). */
export function idDeCitaEnTexto(texto: string): string | null {
  const limpio = texto.trim();
  const m = limpio.match(/[?&]cita=([^&#\s]+)/);
  if (m) return decodeURIComponent(m[1]);
  if (/^c-[0-9a-f]{8}$/i.test(limpio) || /^cita-[\w-]{4,40}$/i.test(limpio)) return limpio;
  return null;
}

export type Barbero = {
  /** Mismo id que su usuario de Supabase Auth */
  id: string;
  nombre: string;
  especialidad: string;
  /** Obsoleto: el precio ahora es del servicio. Se conserva para datos viejos. */
  precio_servicio?: number;
  /** Duración base de su agenda cuando la cita no lleva servicio */
  duracion_cita_min: number;
  acepta_domicilio: boolean;
  biografia: string;
  activo: boolean;
  /** Lo que el administrador le permite hacer. Lo que falte toma el valor por defecto. */
  permisos?: Partial<PermisosBarbero>;
  /**
   * Precio especial por servicio (id del servicio → MXN). Lo que no aparece
   * se cobra al precio de lista del catálogo. Sólo lo cambia el administrador.
   */
  precios?: Record<string, number>;
};

/** Lo que cobra este barbero por el servicio: su precio especial o el de lista. */
export function precioDe(servicio: Pick<Servicio, "id" | "precio">, barbero?: Pick<Barbero, "precios"> | null) {
  const especial = barbero?.precios?.[servicio.id];
  return typeof especial === "number" && Number.isFinite(especial) && especial >= 0 ? especial : servicio.precio;
}

/** Deja sólo precios válidos de servicios que existen y distintos del de lista. */
export function limpiarPrecios(precios: unknown, servicios: Pick<Servicio, "id" | "precio">[]): Record<string, number> {
  const limpio: Record<string, number> = {};
  if (!precios || typeof precios !== "object") return limpio;
  for (const sv of servicios) {
    const n = Number((precios as Record<string, unknown>)[sv.id]);
    if ((precios as Record<string, unknown>)[sv.id] === null || (precios as Record<string, unknown>)[sv.id] === "") continue;
    if (Number.isFinite(n) && n >= 0 && n <= 1_000_000 && Math.round(n) !== sv.precio) limpio[sv.id] = Math.round(n);
  }
  return limpio;
}

// --- Permisos del equipo ----------------------------------------------------

export type PermisosBarbero = {
  /** Agendar citas en su propia agenda */
  crear_citas: boolean;
  /** Agendar citas en la agenda de otros barberos */
  agendar_otros: boolean;
  /** Ver con nombre las citas de todo el equipo (si no, sólo el hueco ocupado) */
  ver_agenda_completa: boolean;
  /** Confirmar llegadas (escáner o botón «Llegó») */
  confirmar_llegadas: boolean;
  /** Registrar cobros en efectivo o tarjeta */
  cobrar: boolean;
  /** Dar de alta clientes nuevos */
  registrar_clientes: boolean;
  /** Corregir los datos de los clientes */
  editar_clientes: boolean;
  /** Ver el nombre de los clientes */
  ver_nombres_clientes: boolean;
  /** Ver teléfono y correo de todos los clientes (siempre ve los que él dio de alta) */
  ver_contacto_clientes: boolean;
  /** Poner sellos de visitas sin cita */
  ajustar_sellos: boolean;
};

export const PERMISOS_POR_DEFECTO: PermisosBarbero = {
  crear_citas: true,
  agendar_otros: false,
  ver_agenda_completa: false,
  confirmar_llegadas: true,
  cobrar: true,
  registrar_clientes: true,
  editar_clientes: false,
  ver_nombres_clientes: true,
  ver_contacto_clientes: false,
  ajustar_sellos: true,
};

export const ETIQUETAS_PERMISOS: { id: keyof PermisosBarbero; label: string; ayuda: string; grupo: string }[] = [
  { id: "crear_citas", grupo: "Agenda", label: "Crear citas", ayuda: "Agenda clientes en su propia agenda." },
  { id: "agendar_otros", grupo: "Agenda", label: "Agendar a otros barberos", ayuda: "Puede meter citas en la agenda de sus compañeros." },
  { id: "ver_agenda_completa", grupo: "Agenda", label: "Ver la agenda de todo el equipo", ayuda: "Ve quién viene con cada barbero. Si no, sólo ve los horarios ocupados." },
  { id: "confirmar_llegadas", grupo: "Mostrador", label: "Confirmar llegadas", ayuda: "Escanea el QR o marca «Llegó» en sus citas." },
  { id: "cobrar", grupo: "Mostrador", label: "Registrar cobros", ayuda: "Marca sus citas como pagadas en efectivo o tarjeta." },
  { id: "ajustar_sellos", grupo: "Mostrador", label: "Poner sellos de lealtad", ayuda: "Suma visitas sin cita a la tarjeta del cliente." },
  { id: "registrar_clientes", grupo: "Clientes", label: "Dar de alta clientes", ayuda: "Registra clientes nuevos desde su panel." },
  { id: "editar_clientes", grupo: "Clientes", label: "Editar datos de clientes", ayuda: "Corrige nombre y contacto de los clientes." },
  { id: "ver_nombres_clientes", grupo: "Privacidad", label: "Ver el nombre de los clientes", ayuda: "Si lo apagas, sólo verá sus iniciales." },
  { id: "ver_contacto_clientes", grupo: "Privacidad", label: "Ver teléfono y correo de todos", ayuda: "Si está apagado, sólo ve el número de los clientes que él dio de alta." },
];

export function permisosDe(barbero: Pick<Barbero, "permisos"> | null | undefined): PermisosBarbero {
  return { ...PERMISOS_POR_DEFECTO, ...(barbero?.permisos ?? {}) };
}

/** ¿La sesión puede hacer esto? El administrador puede todo; el cliente nada de esto. */
export function puede(estado: Pick<Estado, "barberos">, s: Sesion | null | undefined, permiso: keyof PermisosBarbero) {
  if (!s) return false;
  if (s.rol === "admin") return true;
  if (s.rol !== "barbero") return false;
  return permisosDe(estado.barberos.find((b) => b.id === s.id))[permiso];
}

/** ¿Esta sesión ve el teléfono y correo de este cliente? */
export function veContactoDe(estado: Pick<Estado, "barberos">, s: Sesion | null | undefined, cliente: Pick<Cliente, "id" | "registrado_por">) {
  if (!s) return false;
  if (s.rol === "admin") return true;
  if (s.rol === "cliente") return cliente.id === s.id;
  return cliente.registrado_por === s.id || puede(estado, s, "ver_contacto_clientes");
}

/** "Juan Pérez" → "J. P." */
export function iniciales(nombre: string) {
  const partes = nombre.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return partes.length ? partes.map((p) => `${p.charAt(0).toUpperCase()}.`).join(" ") : "Cliente";
}

/** Últimos 10 dígitos: así "+52 55 1234 5678" y "5512345678" son el mismo número. */
export function normalizarTelefono(valor: string) {
  const d = String(valor ?? "").replace(/\D/g, "");
  return d.length > 10 ? d.slice(-10) : d;
}

/**
 * ¿Parece un celular mexicano real? 10 dígitos, sin empezar en 0 ni 1 (las
 * claves de área van de 2 a 9) y sin patrones de relleno como 5555555555 o
 * 1234567890, que es lo primero que escribe un bot o alguien que prueba.
 */
export function celularValido(valor: string) {
  const d = normalizarTelefono(valor);
  if (!/^[2-9]\d{9}$/.test(d)) return false;
  if (/^(\d)\1{9}$/.test(d)) return false;
  // Sus 8 últimos dígitos todos iguales (55 0000 0000) o en escalera.
  if (/^(\d)\1{7}$/.test(d.slice(2))) return false;
  const escalera = "01234567890123456789";
  const bajada = "98765432109876543210";
  if (escalera.includes(d.slice(2)) || bajada.includes(d.slice(2))) return false;
  return true;
}

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
  /** Día en que empieza la semana de corte de caja */
  corte_inicio?: DiaSemana;
};

// --- Clientes y tarjetas de lealtad ----------------------------------------

export type Cliente = {
  id: string;
  nombre: string;
  telefono: string;
  email: string;
  creado_en: string; // ISO
  /** Quién lo dio de alta (id del personal). El barbero que lo registró siempre ve su número. */
  registrado_por?: string;
  /** Id de su cuenta de acceso (Supabase Auth) cuando ya activó su acceso */
  cuenta_id?: string;
  /** Vinculó su cuenta de Google */
  google?: boolean;
  /** Sólo en la vista del personal: ya tiene acceso propio (sin exponer el id de la cuenta) */
  cuenta?: boolean;
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

/** Secciones del menú. Barba, Color y Ritual quedan por datos anteriores al menú impreso. */
export const CATEGORIAS_SERVICIO = ["Corte", "Afeitado", "Rostro", "Paquete", "Especial", "Barba", "Color", "Ritual"] as const;

export type Servicio = {
  id: string;
  nombre: string;
  categoria: (typeof CATEGORIAS_SERVICIO)[number];
  /** Qué incluye, p. ej. "Corte y facial" en los paquetes */
  descripcion?: string;
  /** Paquete: servicios del catálogo que incluye (para armar el texto y comparar precio) */
  incluye?: string[];
  /** El precio es mínimo ("A partir de $250"): sube según largo o diseño */
  desde?: boolean;
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
  /** Se muestra en la tienda de la página web */
  publico?: boolean;
  /** Texto para la tienda: para qué sirve, aroma, fijación… */
  descripcion?: string;
  /** Foto del producto (URL pública) */
  imagen_url?: string;
  /** Marca, para la tienda */
  marca?: string;
};

/** Venta de mostrador de un producto del inventario. */
export type VentaProducto = {
  id: string;
  fecha: string; // ISO
  producto_id: string;
  producto_nombre: string;
  cantidad: number;
  precio_unitario: number;
  total: number;
  metodo_pago: MetodoPago;
  /** Quién lo vendió (barbero o administrador) */
  vendedor_id: string;
  vendedor_nombre: string;
  /** Cliente, si se sabe */
  cliente_nombre?: string;
};

/** Cierre de caja de un periodo: los números quedan congelados al hacerlo. */
export type CorteCaja = {
  id: string;
  /** Inicio y fin del periodo (ISO, fin exclusivo) */
  desde: string;
  hasta: string;
  creado_en: string;
  creado_por: string;
  servicios: number;
  productos: number;
  propinas: number;
  efectivo: number;
  tarjeta: number;
  transferencia: number;
  comisiones: number;
  gastos: number;
  /** Lo que queda: servicios + productos − comisiones − gastos (las propinas son del equipo) */
  utilidad: number;
  citas: number;
  ventas: number;
  /** Efectivo que se contó físicamente en caja, si se capturó */
  efectivo_contado?: number | null;
  notas?: string;
  /** Por barbero: servicios, comisión, propinas y productos vendidos */
  equipo: { id: string; nombre: string; servicios: number; comision: number; propinas: number; productos: number }[];
};

export type Gasto = {
  id: string;
  concepto: string;
  categoria: "Renta" | "Insumos" | "Nómina" | "Publicidad" | "Servicios" | "Otros";
  monto: number;
  fecha: string; // ISO
};

// --- Estado completo ---------------------------------------------------------

export type Estado = {
  citas: Cita[];
  barberos: Barbero[];
  horarios: Record<string, HorarioSemanal>;
  fichas: Ficha[];
  recompensas: RecompensasConfig;
  barberia: BarberiaConfig;
  canjes: Record<string, number>;
  servicios: Servicio[];
  productos: Producto[];
  gastos: Gasto[];
  clientes: Cliente[];
  tarjetas: TarjetaLealtad[];
  ventas: VentaProducto[];
  cortes: CorteCaja[];
};

export type Clave = keyof Estado;

export function horarioPorDefecto(): HorarioSemanal {
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

export function estadoVacio(): Estado {
  return {
    citas: [],
    barberos: [],
    horarios: {},
    fichas: [],
    recompensas: { citas_requeridas: 5, valor_descuento: 20 },
    barberia: BARBERIA_VACIA,
    canjes: {},
    servicios: [],
    productos: [],
    gastos: [],
    clientes: [],
    tarjetas: [],
    ventas: [],
    cortes: [],
  };
}

/** Mezcla lo guardado con la forma vacía para no dejar huecos `undefined`. */
export function normalizarEstado(parcial: Partial<Estado>): Estado {
  const base = estadoVacio();
  const barberia = { ...BARBERIA_VACIA, ...(parcial.barberia ?? {}) };
  barberia.horario = { ...BARBERIA_VACIA.horario, ...(parcial.barberia?.horario ?? {}) };
  return { ...base, ...parcial, barberia, recompensas: { ...base.recompensas, ...(parcial.recompensas ?? {}) } };
}

/**
 * Nombre comercial para logotipos y títulos. Cae a la variable de entorno y,
 * si tampoco existe, a un genérico: nunca a una marca de ejemplo.
 */
export const NOMBRE_POR_DEFECTO = process.env.NEXT_PUBLIC_NOMBRE_NEGOCIO || "Barbería CortMart";

export function nombreDelNegocio(cfg: Pick<BarberiaConfig, "nombre">) {
  return cfg.nombre.trim() || NOMBRE_POR_DEFECTO;
}

/**
 * Número legible de tarjeta: un prefijo fijo y ocho cifras aleatorias
 * agrupadas para dictarlo en voz alta.
 */
export function numeroDeTarjeta(existentes: Set<string>) {
  let numero = "";
  do {
    const cifras = Array.from(crypto.getRandomValues(new Uint32Array(2)))
      .map((n) => String(n % 10_000).padStart(4, "0"))
      .join("-");
    numero = `LC-${cifras}`;
  } while (existentes.has(numero));
  return numero;
}

function tarjetaNueva(estado: Estado, id: string, numero: string, clienteId: string): TarjetaLealtad {
  const usados = new Set(estado.tarjetas.map((t) => t.numero));
  return {
    id,
    numero: usados.has(numero) ? numeroDeTarjeta(usados) : numero,
    cliente_id: clienteId,
    emitida_en: new Date().toISOString(),
    sellos_extra: 0,
    estado: "activa",
    wallet_guardada_en: null,
  };
}

export function nuevoId(prefijo: string) {
  return `${prefijo}-${crypto.randomUUID().slice(0, 8)}`;
}

// ---------------------------------------------------------------------------
// Operaciones
// ---------------------------------------------------------------------------

export type Operacion =
  | {
      tipo: "crearCita";
      id: string;
      barbero_id: string;
      servicio_id?: string | null;
      servicio_ids?: string[];
      inicio: string;
      fin: string;
      modalidad: "presencial" | "domicilio";
      metodo_pago: MetodoPago;
      direccion_domicilio?: string;
    }
  | {
      tipo: "crearCitaPersonal";
      id: string;
      cliente_id: string;
      barbero_id: string;
      servicio_id?: string | null;
      servicio_ids?: string[];
      inicio: string;
      modalidad: "presencial" | "domicilio";
      direccion_domicilio?: string;
      precio?: number;
      notas?: string;
      /** El administrador puede agendar fuera de horario o encimar citas */
      forzar?: boolean;
    }
  | {
      tipo: "actualizarCita";
      id: string;
      cambios: Partial<
        Pick<
          Cita,
          | "inicio"
          | "barbero_id"
          | "servicio_id"
          | "servicio_ids"
          | "estado"
          | "precio"
          | "estado_pago"
          | "metodo_pago"
          | "propina"
          | "notas"
          | "modalidad"
          | "direccion_domicilio"
        >
      >;
      forzar?: boolean;
    }
  | { tipo: "cobrarEfectivo"; id: string }
  | { tipo: "cobrarCita"; id: string; metodo: MetodoPago; propina?: number }
  | { tipo: "marcarAsistida"; id: string }
  | { tipo: "cancelarCita"; id: string }
  | { tipo: "eliminarCita"; id: string }
  | { tipo: "eliminarTodasLasCitas" }
  | { tipo: "agregarBarbero"; barbero: Barbero }
  | { tipo: "actualizarBarbero"; id: string; cambios: Partial<Omit<Barbero, "id">> }
  | { tipo: "toggleActivoBarbero"; id: string }
  | { tipo: "eliminarBarbero"; id: string }
  | { tipo: "eliminarCliente"; id: string }
  | { tipo: "eliminarServicio"; id: string }
  | { tipo: "guardarHorarioDia"; barberoId: string; dia: DiaSemana; cambios: Partial<BloqueHorario> }
  | { tipo: "agregarFicha"; ficha: Ficha }
  | { tipo: "actualizarRecompensasConfig"; cambios: Partial<RecompensasConfig> }
  | { tipo: "actualizarBarberiaConfig"; cambios: Partial<BarberiaConfig> }
  | { tipo: "canjearRecompensa"; clienteId: string }
  | { tipo: "agregarServicio"; servicio: Servicio }
  | { tipo: "agregarServicios"; servicios: Servicio[] }
  | { tipo: "actualizarServicio"; id: string; cambios: Partial<Omit<Servicio, "id">> }
  | { tipo: "agregarProducto"; producto: Producto }
  | { tipo: "ajustarExistencias"; id: string; delta: number }
  | { tipo: "actualizarProducto"; id: string; cambios: Partial<Omit<Producto, "id">> }
  | { tipo: "eliminarProducto"; id: string }
  | { tipo: "agregarGasto"; gasto: Gasto }
  | { tipo: "eliminarGasto"; id: string }
  | { tipo: "venderProducto"; venta: VentaProducto }
  | { tipo: "eliminarVenta"; id: string }
  | { tipo: "hacerCorte"; corte: CorteCaja }
  | { tipo: "eliminarCorte"; id: string }
  | { tipo: "registrarCliente"; cliente: Cliente; tarjetaId: string; numeroTarjeta: string }
  | { tipo: "actualizarCliente"; id: string; cambios: Partial<Omit<Cliente, "id">> }
  | { tipo: "ajustarSellos"; tarjetaId: string; delta: number }
  | { tipo: "cambiarEstadoTarjeta"; tarjetaId: string; estado: EstadoTarjeta }
  | { tipo: "marcarWalletGuardada"; tarjetaId: string; fecha: string }
  /** Lo usa el servidor al activar el acceso de un cliente (teléfono o Google) */
  | { tipo: "vincularCuentaCliente"; clienteId: string; cuentaId: string; google?: boolean; email?: string }
  /**
   * Reserva sin cuenta (sólo nombre y celular). La usa /api/reservas con la
   * sesión del sistema: si el número es nuevo crea la ficha, su tarjeta de
   * lealtad y la cita en una sola escritura; si ya existe, agenda en su ficha.
   */
  | {
      tipo: "reservarInvitado";
      id: string;
      nombre: string;
      telefono: string;
      barbero_id: string;
      servicio_id?: string | null;
      servicio_ids?: string[];
      inicio: string;
      modalidad: "presencial" | "domicilio";
      direccion_domicilio?: string;
      clienteId: string;
      tarjetaId: string;
      numeroTarjeta: string;
    };

/** Error de negocio: el servidor lo devuelve tal cual al navegador. */
export class ErrorOperacion extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message);
  }
}

const esStaff = (s: Sesion) => s.rol === "admin" || s.rol === "barbero";

/** Ids de servicio de una petición: la lista nueva o el servicio único de antes. */
export function idsDeServicio(datos: { servicio_ids?: unknown; servicio_id?: string | null }): string[] {
  const lista = Array.isArray(datos.servicio_ids)
    ? datos.servicio_ids.filter((x): x is string => typeof x === "string" && x.length > 0)
    : datos.servicio_id
      ? [datos.servicio_id]
      : [];
  return lista.slice(0, 8);
}

/** Servicios de una cita ya guardada, en orden. */
export function serviciosDeCita(c: Pick<Cita, "servicio_ids" | "servicio_id">): string[] {
  return idsDeServicio(c);
}

/**
 * Servicios elegidos para una cita y lo que definen: el precio y la duración
 * se suman y la comisión queda como el promedio ponderado por precio, para
 * que el reparto salga igual que si fueran citas separadas. Sin catálogo
 * (barbería recién abierta) la cita va sin servicio, precio 0 y la duración
 * base del barbero.
 */
function servicioParaCita(estado: Estado, servicioIds: string[], barbero: Barbero) {
  const activos = estado.servicios.filter((x) => x.activo);
  if (servicioIds.length === 0) {
    if (activos.length > 0) throw new ErrorOperacion("Elige el servicio.", 400);
    return { servicios: [] as Servicio[], ids: [] as string[], nombre: "", precio: 0, duracion: Math.max(5, barbero.duracion_cita_min), comision: 0 };
  }
  const servicios = servicioIds.map((id) => {
    const sv = estado.servicios.find((x) => x.id === id);
    if (!sv) throw new ErrorOperacion("Ese servicio ya no existe.", 400);
    return sv;
  });
  const precio = servicios.reduce((a, sv) => a + precioDe(sv, barbero), 0);
  const duracion = Math.max(5, servicios.reduce((a, sv) => a + Math.max(0, sv.duracion_min), 0));
  const comisionPesos = servicios.reduce(
    (a, sv) => a + (precioDe(sv, barbero) * Math.min(100, Math.max(0, sv.comision_pct))) / 100,
    0
  );
  const comision =
    precio > 0
      ? Math.round((comisionPesos / precio) * 100 * 100) / 100
      : Math.min(100, Math.max(0, servicios[0].comision_pct));
  return {
    servicios,
    ids: servicios.map((x) => x.id),
    nombre: servicios.map((x) => x.nombre).join(" + "),
    precio,
    duracion,
    comision,
  };
}

function precioValido(valor: unknown, porDefecto: number) {
  const n = Number(valor);
  return Number.isFinite(n) && n >= 0 && n <= 1_000_000 ? Math.round(n) : porDefecto;
}

/**
 * Comprueba que el barbero esté libre en [inicio, fin). Con `forzar` (sólo el
 * administrador) se aceptan horas fuera de horario o encimadas: es el
 * mostrador quien decide, por ejemplo, meter a alguien de última hora.
 */
function validarHueco(estado: Estado, barbero: Barbero, inicio: number, fin: number, ignorar: string | null, forzar: boolean) {
  if (forzar) return;
  if (!barbero.activo) throw new ErrorOperacion(`${barbero.nombre} está desactivado.`, 409);
  const choque = estado.citas.find(
    (c) =>
      c.id !== ignorar &&
      c.barbero_id === barbero.id &&
      citaActiva(c) &&
      inicio < new Date(c.fin).getTime() &&
      fin > new Date(c.inicio).getTime()
  );
  if (choque) {
    throw new ErrorOperacion(`${barbero.nombre} ya tiene una cita a esa hora (${choque.cliente_nombre || "otro cliente"}).`, 409);
  }
}

/** Citas por venir que puede tener un mismo cliente al reservar en línea. */
export const MAX_CITAS_FUTURAS = 2;

function exigirCupoDeCitas(estado: Estado, clienteId: string) {
  const ahora = Date.now();
  const futuras = estado.citas.filter(
    (c) => c.cliente_id === clienteId && c.estado === "confirmada" && new Date(c.fin).getTime() > ahora
  ).length;
  if (futuras >= MAX_CITAS_FUTURAS) {
    throw new ErrorOperacion(
      `Ya tienes ${futuras} citas por venir. Para agendar otra, llama o escribe por WhatsApp a la barbería.`,
      409
    );
  }
}

/**
 * Cita que agenda el propio cliente (con o sin cuenta). Precio y duración los
 * pone el servicio, no el navegador; el hueco debe seguir libre al guardar.
 */
function citaDeCliente(
  estado: Estado,
  datos: { id: string; barbero_id: string; servicio_id?: string | null; servicio_ids?: string[]; inicio: string; modalidad: "presencial" | "domicilio"; direccion_domicilio?: string },
  cliente: { id: string; nombre: string }
): Cita {
  idNuevo(estado.citas, datos.id);
  const barbero = estado.barberos.find((b) => b.id === datos.barbero_id);
  if (!barbero) throw new ErrorOperacion("El barbero no está disponible.", 400);
  const inicio = new Date(datos.inicio).getTime();
  if (!Number.isFinite(inicio)) throw new ErrorOperacion("Horario inválido.", 400);
  const sv = servicioParaCita(estado, idsDeServicio(datos), barbero);
  if (sv.servicios.some((x) => !x.activo)) throw new ErrorOperacion("Ese servicio no está disponible.", 400);
  const fin = inicio + sv.duracion * 60_000;
  const problema = horarioReservable(
    {
      barbero: { ...barbero, duracion_cita_min: sv.duracion },
      horario: estado.horarios[barbero.id] ?? horarioPorDefecto(),
      barberia: estado.barberia,
      citas: estado.citas,
    },
    inicio
  );
  if (problema) throw new ErrorOperacion(problema, 409);
  const domicilio = datos.modalidad === "domicilio" && barbero.acepta_domicilio;
  return {
    id: datos.id,
    cliente_id: cliente.id,
    cliente_nombre: cliente.nombre,
    barbero_id: barbero.id,
    barbero_nombre: barbero.nombre,
    especialidad: barbero.especialidad,
    inicio: new Date(inicio).toISOString(),
    fin: new Date(fin).toISOString(),
    modalidad: domicilio ? "domicilio" : "presencial",
    estado: "confirmada",
    precio: sv.precio,
    servicio_id: sv.ids[0] ?? null,
    servicio_nombre: sv.nombre,
    servicio_ids: sv.ids,
    comision_pct: sv.comision,
    direccion_domicilio: domicilio ? String(datos.direccion_domicilio || "Domicilio del cliente").slice(0, 300) : null,
    // De momento sólo se cobra en efectivo en la barbería: el pago en
    // línea no está conectado y no se puede dar una cita por pagada.
    metodo_pago: "efectivo",
    estado_pago: "pendiente",
    creada_por: "cliente",
  };
}

function exigir(condicion: unknown, mensaje = "No tienes permiso para esta acción."): asserts condicion {
  if (!condicion) throw new ErrorOperacion(mensaje, 403);
}

function buscar<T extends { id: string }>(lista: T[], id: string, que: string): T {
  const item = lista.find((x) => x.id === id);
  if (!item) throw new ErrorOperacion(`${que} no encontrado.`, 404);
  return item;
}

function idNuevo(lista: { id: string }[], id: string) {
  if (typeof id !== "string" || id.length < 4 || id.length > 64 || lista.some((x) => x.id === id)) {
    throw new ErrorOperacion("Identificador inválido.", 400);
  }
}

/**
 * Aplica una operación y devuelve sólo las colecciones que cambian. Lanza
 * `ErrorOperacion` si la sesión no tiene permiso o los datos no cuadran.
 */
export function aplicarOperacion(estado: Estado, op: Operacion, s: Sesion): Partial<Estado> {
  switch (op.tipo) {
    case "crearCita": {
      exigir(s.rol === "cliente", "Sólo los clientes pueden reservar.");
      exigirCupoDeCitas(estado, s.id);
      const nueva = citaDeCliente(estado, op, { id: s.id, nombre: s.nombre });
      return { citas: [...estado.citas, nueva] };
    }

    case "reservarInvitado": {
      // Sólo el servidor (sesión del sistema) la ejecuta, tras sus límites.
      exigir(s.rol === "admin" && s.id === "sistema", "Operación reservada al servidor.");
      const telefono = normalizarTelefono(op.telefono);
      if (!celularValido(telefono)) throw new ErrorOperacion("Escribe un celular válido de 10 dígitos.", 400);
      const nombre = String(op.nombre ?? "").trim().replace(/\s+/g, " ").slice(0, 120);
      if (nombre.length < 2) throw new ErrorOperacion("Escribe tu nombre.", 400);

      const existente = estado.clientes.find((c) => normalizarTelefono(c.telefono) === telefono);
      if (existente) {
        exigirCupoDeCitas(estado, existente.id);
        const nueva = citaDeCliente(estado, op, { id: existente.id, nombre: existente.nombre });
        const cambios: Partial<Estado> = { citas: [...estado.citas, nueva] };
        // Ficha sin tarjeta (datos viejos): se le emite de paso.
        if (!estado.tarjetas.some((t) => t.cliente_id === existente.id)) {
          idNuevo(estado.tarjetas, op.tarjetaId);
          cambios.tarjetas = [...estado.tarjetas, tarjetaNueva(estado, op.tarjetaId, op.numeroTarjeta, existente.id)];
        }
        return cambios;
      }

      idNuevo(estado.clientes, op.clienteId);
      idNuevo(estado.tarjetas, op.tarjetaId);
      const creado = new Date().toISOString();
      const cliente: Cliente = { id: op.clienteId, nombre, telefono, email: "", creado_en: creado };
      const nueva = citaDeCliente(estado, op, { id: cliente.id, nombre });
      return {
        clientes: [...estado.clientes, cliente],
        tarjetas: [...estado.tarjetas, tarjetaNueva(estado, op.tarjetaId, op.numeroTarjeta, cliente.id)],
        citas: [...estado.citas, nueva],
      };
    }

    case "crearCitaPersonal": {
      exigir(esStaff(s), "Sólo el personal agenda a nombre de un cliente.");
      exigir(puede(estado, s, "crear_citas"), "No tienes permiso para crear citas. Pídeselo al administrador.");
      exigir(
        s.rol === "admin" || op.barbero_id === s.id || puede(estado, s, "agendar_otros"),
        "Sólo puedes agendar en tu propia agenda."
      );
      idNuevo(estado.citas, op.id);
      const cliente = buscar(estado.clientes, op.cliente_id, "Cliente");
      const barbero = buscar(estado.barberos, op.barbero_id, "Barbero");
      const inicio = new Date(op.inicio).getTime();
      if (!Number.isFinite(inicio)) throw new ErrorOperacion("Horario inválido.", 400);
      const sv = servicioParaCita(estado, idsDeServicio(op), barbero);
      const fin = inicio + sv.duracion * 60_000;
      validarHueco(estado, barbero, inicio, fin, null, Boolean(op.forzar) && s.rol === "admin");
      const domicilio = op.modalidad === "domicilio";
      const nueva: Cita = {
        id: op.id,
        cliente_id: cliente.id,
        cliente_nombre: cliente.nombre,
        barbero_id: barbero.id,
        barbero_nombre: barbero.nombre,
        especialidad: barbero.especialidad,
        inicio: new Date(inicio).toISOString(),
        fin: new Date(fin).toISOString(),
        modalidad: domicilio ? "domicilio" : "presencial",
        estado: "confirmada",
        precio: s.rol === "admin" ? precioValido(op.precio, sv.precio) : sv.precio,
        servicio_id: sv.ids[0] ?? null,
        servicio_nombre: sv.nombre,
        servicio_ids: sv.ids,
        comision_pct: sv.comision,
        direccion_domicilio: domicilio ? String(op.direccion_domicilio || "Domicilio del cliente").slice(0, 300) : null,
        metodo_pago: "efectivo",
        estado_pago: "pendiente",
        notas: String(op.notas ?? "").slice(0, 500),
        creada_por: "personal",
        llegada_en: null,
      };
      return { citas: [...estado.citas, nueva] };
    }

    case "actualizarCita": {
      const cita = buscar(estado.citas, op.id, "Cita");
      exigir(s.rol === "admin" || (s.rol === "barbero" && cita.barbero_id === s.id));
      const c = op.cambios ?? {};
      const siguiente: Cita = { ...cita };

      if (c.barbero_id !== undefined && c.barbero_id !== cita.barbero_id) {
        exigir(s.rol === "admin", "Sólo el administrador cambia quién atiende la cita.");
        const otro = buscar(estado.barberos, c.barbero_id, "Barbero");
        siguiente.barbero_id = otro.id;
        siguiente.barbero_nombre = otro.nombre;
        siguiente.especialidad = otro.especialidad;
        // Si el precio era el del barbero anterior, pasa al del nuevo.
        const svs = serviciosDeCita(cita)
          .map((id) => estado.servicios.find((x) => x.id === id))
          .filter((x): x is Servicio => Boolean(x));
        const anterior = estado.barberos.find((b) => b.id === cita.barbero_id);
        const total = (b?: Barbero) => svs.reduce((a, sv) => a + precioDe(sv, b), 0);
        if (svs.length > 0 && cita.precio === total(anterior)) siguiente.precio = total(otro);
      }
      let duracion = Math.max(5 * 60_000, new Date(cita.fin).getTime() - new Date(cita.inicio).getTime());
      const idsNuevos = c.servicio_ids !== undefined || c.servicio_id !== undefined ? idsDeServicio(c) : null;
      if (idsNuevos && idsNuevos.join("|") !== serviciosDeCita(cita).join("|")) {
        const sv = servicioParaCita(estado, idsNuevos, buscar(estado.barberos, siguiente.barbero_id, "Barbero"));
        siguiente.servicio_id = sv.ids[0] ?? null;
        siguiente.servicio_nombre = sv.nombre;
        siguiente.servicio_ids = sv.ids;
        siguiente.comision_pct = sv.comision;
        siguiente.precio = sv.precio;
        duracion = sv.duracion * 60_000;
        siguiente.fin = new Date(new Date(siguiente.inicio).getTime() + duracion).toISOString();
      }
      if (c.inicio !== undefined && c.inicio !== cita.inicio) {
        const inicio = new Date(c.inicio).getTime();
        if (!Number.isFinite(inicio)) throw new ErrorOperacion("Horario inválido.", 400);
        siguiente.inicio = new Date(inicio).toISOString();
        siguiente.fin = new Date(inicio + duracion).toISOString();
      }
      // Al mover la cita (de hora o de barbero) el hueco nuevo debe estar libre.
      const seMueve =
        siguiente.inicio !== cita.inicio || siguiente.barbero_id !== cita.barbero_id || siguiente.fin !== cita.fin;
      const estadoFinal = c.estado ?? cita.estado;
      if (seMueve && estadoFinal === "confirmada") {
        const barbero = buscar(estado.barberos, siguiente.barbero_id, "Barbero");
        validarHueco(
          estado,
          barbero,
          new Date(siguiente.inicio).getTime(),
          new Date(siguiente.fin).getTime(),
          cita.id,
          Boolean(op.forzar) && s.rol === "admin"
        );
      }
      if (c.estado !== undefined) {
        exigir(c.estado in ETIQUETA_ESTADO_CITA, "Estado inválido.");
        if (c.estado === "asistida" && cita.estado !== "asistida") {
          exigir(puede(estado, s, "confirmar_llegadas"), "No tienes permiso para confirmar llegadas.");
        }
        siguiente.estado = c.estado;
        siguiente.llegada_en = c.estado === "asistida" ? (cita.llegada_en ?? new Date().toISOString()) : null;
      }
      if (c.precio !== undefined) {
        exigir(s.rol === "admin", "Sólo el administrador cambia el precio.");
        siguiente.precio = precioValido(c.precio, cita.precio);
      }
      if (c.estado_pago !== undefined && c.estado_pago !== cita.estado_pago) {
        exigir(puede(estado, s, "cobrar"), "No tienes permiso para registrar cobros.");
        siguiente.estado_pago = c.estado_pago === "pagado" ? "pagado" : "pendiente";
      }
      if (c.metodo_pago !== undefined && c.metodo_pago !== cita.metodo_pago) {
        exigir(puede(estado, s, "cobrar"), "No tienes permiso para registrar cobros.");
        siguiente.metodo_pago = metodoValido(c.metodo_pago);
      }
      if (c.propina !== undefined && propinaValida(c.propina) !== (cita.propina ?? 0)) {
        exigir(puede(estado, s, "cobrar"), "No tienes permiso para registrar cobros.");
        siguiente.propina = propinaValida(c.propina);
      }
      if (siguiente.estado_pago === "pagado" && cita.estado_pago !== "pagado") siguiente.pagada_en = new Date().toISOString();
      if (siguiente.estado_pago === "pendiente") {
        siguiente.pagada_en = null;
        siguiente.propina = 0;
      }
      if (c.notas !== undefined) siguiente.notas = String(c.notas).slice(0, 500);
      if (c.modalidad !== undefined) {
        siguiente.modalidad = c.modalidad === "domicilio" ? "domicilio" : "presencial";
        siguiente.direccion_domicilio =
          siguiente.modalidad === "domicilio"
            ? String(c.direccion_domicilio ?? cita.direccion_domicilio ?? "Domicilio del cliente").slice(0, 300)
            : null;
      } else if (c.direccion_domicilio !== undefined && siguiente.modalidad === "domicilio") {
        siguiente.direccion_domicilio = String(c.direccion_domicilio).slice(0, 300);
      }
      return { citas: estado.citas.map((x) => (x.id === op.id ? siguiente : x)) };
    }

    case "cobrarEfectivo":
    case "cobrarCita":
    case "marcarAsistida":
    case "cancelarCita": {
      const cita = buscar(estado.citas, op.id, "Cita");
      const propiaDelBarbero = s.rol === "barbero" && cita.barbero_id === s.id;
      const propiaDelCliente = s.rol === "cliente" && cita.cliente_id === s.id;
      if (op.tipo === "cancelarCita") exigir(s.rol === "admin" || propiaDelBarbero || propiaDelCliente);
      else exigir(s.rol === "admin" || propiaDelBarbero);
      if (op.tipo === "cobrarEfectivo" || op.tipo === "cobrarCita") {
        exigir(puede(estado, s, "cobrar"), "No tienes permiso para registrar cobros.");
      }
      if (op.tipo === "marcarAsistida") {
        exigir(puede(estado, s, "confirmar_llegadas"), "No tienes permiso para confirmar llegadas.");
      }
      if (op.tipo === "marcarAsistida" && cita.estado === "cancelada") {
        throw new ErrorOperacion("La cita está cancelada. Reactívala antes de confirmar la llegada.", 409);
      }
      if (op.tipo === "cancelarCita" && s.rol === "cliente" && cita.estado !== "confirmada") {
        throw new ErrorOperacion("Esta cita ya no se puede cancelar.", 409);
      }
      const cambios: Partial<Cita> =
        op.tipo === "cobrarEfectivo"
          ? { estado_pago: "pagado", metodo_pago: "efectivo", pagada_en: new Date().toISOString() }
          : op.tipo === "cobrarCita"
            ? {
                estado_pago: "pagado",
                metodo_pago: metodoValido(op.metodo),
                propina: propinaValida(op.propina),
                pagada_en: new Date().toISOString(),
              }
            : op.tipo === "marcarAsistida"
              ? { estado: "asistida", llegada_en: cita.llegada_en ?? new Date().toISOString() }
              : { estado: "cancelada" };
      return { citas: estado.citas.map((c) => (c.id === op.id ? { ...c, ...cambios } : c)) };
    }

    case "eliminarCita":
      // Borrar no es cancelar: la cita desaparece de agenda, caja, reportes y sellos.
      exigir(s.rol === "admin", "Sólo el administrador elimina citas.");
      buscar(estado.citas, op.id, "Cita");
      return { citas: estado.citas.filter((c) => c.id !== op.id) };

    case "eliminarTodasLasCitas":
      exigir(s.rol === "admin", "Sólo el administrador elimina citas.");
      return { citas: [] };

    case "agregarBarbero":
      // Lo usa /api/admin/usuarios tras crear la cuenta: el id es el del usuario.
      exigir(s.rol === "admin");
      idNuevo(estado.barberos, op.barbero.id);
      return { barberos: [...estado.barberos, op.barbero] };

    case "actualizarBarbero": {
      exigir(s.rol === "admin" || (s.rol === "barbero" && op.id === s.id));
      buscar(estado.barberos, op.id, "Barbero");
      const cambios = { ...op.cambios };
      // El barbero edita su perfil, pero su alta y baja la decide el admin.
      if (s.rol !== "admin") {
        delete cambios.activo;
        delete cambios.permisos;
        delete cambios.precios;
      } else if (cambios.permisos) {
        // Sólo se guardan permisos conocidos y como booleanos.
        const limpio: Partial<PermisosBarbero> = {};
        for (const k of Object.keys(PERMISOS_POR_DEFECTO) as (keyof PermisosBarbero)[]) {
          if (typeof cambios.permisos[k] === "boolean") limpio[k] = cambios.permisos[k];
        }
        cambios.permisos = limpio;
      }
      if (cambios.precios !== undefined) cambios.precios = limpiarPrecios(cambios.precios, estado.servicios);
      const resultado: Partial<Estado> = {
        barberos: estado.barberos.map((b) => (b.id === op.id ? { ...b, ...cambios, id: b.id } : b)),
      };
      const nombre = cambios.nombre?.trim();
      if (nombre) {
        resultado.citas = estado.citas.map((c) => (c.barbero_id === op.id ? { ...c, barbero_nombre: nombre } : c));
      }
      return resultado;
    }

    case "toggleActivoBarbero": {
      exigir(s.rol === "admin");
      buscar(estado.barberos, op.id, "Barbero");
      return { barberos: estado.barberos.map((b) => (b.id === op.id ? { ...b, activo: !b.activo } : b)) };
    }

    case "eliminarBarbero": {
      exigir(s.rol === "admin", "Sólo el administrador elimina barberos.");
      const barbero = buscar(estado.barberos, op.id, "Barbero");
      const horarios = { ...estado.horarios };
      delete horarios[op.id];
      // Su historial se queda (con su nombre); lo que tenía agendado se cancela.
      return {
        barberos: estado.barberos.filter((b) => b.id !== op.id),
        horarios,
        citas: estado.citas.map((c) =>
          c.barbero_id === op.id && c.estado === "confirmada"
            ? { ...c, estado: "cancelada" as const, notas: `${c.notas ? `${c.notas} · ` : ""}Cancelada: ${barbero.nombre} ya no está en el equipo.` }
            : c
        ),
      };
    }

    case "eliminarCliente": {
      exigir(s.rol === "admin", "Sólo el administrador elimina clientes.");
      const enFicha = estado.clientes.some((c) => c.id === op.id);
      const conCitas = estado.citas.some((c) => c.cliente_id === op.id);
      if (!enFicha && !conCitas) throw new ErrorOperacion("Cliente no encontrado.", 404);
      const canjes = { ...estado.canjes };
      delete canjes[op.id];
      return {
        clientes: estado.clientes.filter((c) => c.id !== op.id),
        tarjetas: estado.tarjetas.filter((t) => t.cliente_id !== op.id),
        canjes,
        // Las citas atendidas siguen contando en caja y reportes; las pendientes se cancelan.
        citas: estado.citas.map((c) =>
          c.cliente_id !== op.id
            ? c
            : c.estado === "confirmada"
              ? { ...c, cliente_eliminado: true, estado: "cancelada" as const, notas: `${c.notas ? `${c.notas} · ` : ""}Cancelada: cliente eliminado.` }
              : { ...c, cliente_eliminado: true }
        ),
        fichas: estado.fichas.filter((f) => f.cliente_id !== op.id),
      };
    }

    case "eliminarServicio": {
      exigir(s.rol === "admin");
      buscar(estado.servicios, op.id, "Servicio");
      return { servicios: estado.servicios.filter((x) => x.id !== op.id) };
    }

    case "guardarHorarioDia": {
      exigir(s.rol === "admin" || (s.rol === "barbero" && op.barberoId === s.id));
      exigir(DIAS_SEMANA.some((d) => d.id === op.dia), "Día inválido.");
      const actual = estado.horarios[op.barberoId] ?? horarioPorDefecto();
      return {
        horarios: {
          ...estado.horarios,
          [op.barberoId]: { ...actual, [op.dia]: { ...actual[op.dia], ...op.cambios } },
        },
      };
    }

    case "agregarFicha": {
      exigir(s.rol === "admin" || (s.rol === "barbero" && op.ficha.barbero_id === s.id));
      idNuevo(estado.fichas, op.ficha.id);
      return { fichas: [op.ficha, ...estado.fichas] };
    }

    case "actualizarRecompensasConfig":
      exigir(s.rol === "admin");
      return { recompensas: { ...estado.recompensas, ...op.cambios } };

    case "actualizarBarberiaConfig":
      exigir(s.rol === "admin");
      return { barberia: { ...estado.barberia, ...op.cambios } };

    case "canjearRecompensa": {
      exigir(s.rol === "admin" || (s.rol === "cliente" && op.clienteId === s.id));
      const tarjeta = estado.tarjetas.find((t) => t.cliente_id === op.clienteId);
      const { recompensasGanadas } = calcularLealtad(
        estado.citas,
        op.clienteId,
        estado.recompensas.citas_requeridas,
        tarjeta?.sellos_extra ?? 0
      );
      const actual = estado.canjes[op.clienteId] ?? 0;
      if (actual >= recompensasGanadas) throw new ErrorOperacion("No hay recompensas por canjear.", 400);
      return { canjes: { ...estado.canjes, [op.clienteId]: actual + 1 } };
    }

    case "agregarServicio":
      exigir(s.rol === "admin");
      idNuevo(estado.servicios, op.servicio.id);
      return { servicios: [...estado.servicios, op.servicio] };

    case "agregarServicios": {
      // Carga del menú impreso: sólo entra lo que aún no está (por nombre).
      exigir(s.rol === "admin");
      const nombres = new Set(estado.servicios.map((x) => x.nombre.trim().toLowerCase()));
      const nuevos = (op.servicios ?? []).filter((x) => !nombres.has(x.nombre.trim().toLowerCase()));
      for (const x of nuevos) idNuevo(estado.servicios, x.id);
      return nuevos.length > 0 ? { servicios: [...estado.servicios, ...nuevos] } : {};
    }

    case "actualizarServicio":
      exigir(s.rol === "admin");
      buscar(estado.servicios, op.id, "Servicio");
      return { servicios: estado.servicios.map((x) => (x.id === op.id ? { ...x, ...op.cambios, id: x.id } : x)) };

    case "agregarProducto": {
      exigir(s.rol === "admin");
      idNuevo(estado.productos, op.producto.id);
      const p = op.producto;
      const producto: Producto = {
        ...p,
        nombre: String(p.nombre ?? "").trim().slice(0, 120),
        publico: Boolean(p.publico),
        descripcion: String(p.descripcion ?? "").slice(0, 400),
        marca: String(p.marca ?? "").trim().slice(0, 60),
        imagen_url: urlDeImagen(p.imagen_url),
      };
      exigir(producto.nombre.length > 0, "El producto necesita nombre.");
      return { productos: [...estado.productos, producto] };
    }

    case "ajustarExistencias":
      exigir(s.rol === "admin");
      buscar(estado.productos, op.id, "Producto");
      return {
        productos: estado.productos.map((p) =>
          p.id === op.id ? { ...p, existencias: Math.max(0, p.existencias + Number(op.delta || 0)) } : p
        ),
      };

    case "actualizarProducto": {
      exigir(s.rol === "admin");
      buscar(estado.productos, op.id, "Producto");
      const c = { ...(op.cambios ?? {}) };
      if (c.nombre !== undefined) {
        c.nombre = String(c.nombre).trim();
        exigir(c.nombre.length > 0, "El producto necesita nombre.");
      }
      for (const k of ["existencias", "minimo", "costo", "precio_venta"] as const) {
        if (c[k] !== undefined) c[k] = Math.max(0, Number(c[k]) || 0);
      }
      if (c.publico !== undefined) c.publico = Boolean(c.publico);
      if (c.descripcion !== undefined) c.descripcion = String(c.descripcion).slice(0, 400);
      if (c.marca !== undefined) c.marca = String(c.marca).trim().slice(0, 60);
      if (c.imagen_url !== undefined) c.imagen_url = urlDeImagen(c.imagen_url);
      return { productos: estado.productos.map((p) => (p.id === op.id ? { ...p, ...c, id: p.id } : p)) };
    }

    case "eliminarProducto":
      exigir(s.rol === "admin");
      buscar(estado.productos, op.id, "Producto");
      return { productos: estado.productos.filter((p) => p.id !== op.id) };

    case "agregarGasto":
      exigir(s.rol === "admin");
      idNuevo(estado.gastos, op.gasto.id);
      return { gastos: [op.gasto, ...estado.gastos] };

    case "eliminarGasto":
      exigir(s.rol === "admin");
      return { gastos: estado.gastos.filter((g) => g.id !== op.id) };

    case "venderProducto": {
      exigir(esStaff(s));
      exigir(puede(estado, s, "cobrar"), "No tienes permiso para registrar cobros.");
      const v = op.venta;
      exigir(v && typeof v === "object", "Venta inválida.");
      idNuevo(estado.ventas, v.id);
      const producto = buscar(estado.productos, v.producto_id, "Producto");
      const cantidad = Math.round(Number(v.cantidad));
      if (!Number.isFinite(cantidad) || cantidad < 1 || cantidad > 999) throw new ErrorOperacion("Cantidad inválida.", 400);
      if (producto.existencias < cantidad) {
        throw new ErrorOperacion(`Sólo quedan ${producto.existencias} de «${producto.nombre}».`, 409);
      }
      // El barbero sólo registra ventas a su nombre; el administrador elige quién vendió.
      let vendedorId = s.id;
      let vendedorNombre = s.nombre;
      if (s.rol === "admin" && v.vendedor_id && v.vendedor_id !== s.id) {
        const b = buscar(estado.barberos, v.vendedor_id, "Barbero");
        vendedorId = b.id;
        vendedorNombre = b.nombre;
      }
      const unitario = s.rol === "admin" ? precioValido(v.precio_unitario, producto.precio_venta) : producto.precio_venta;
      const venta: VentaProducto = {
        id: v.id,
        fecha: new Date().toISOString(),
        producto_id: producto.id,
        producto_nombre: producto.nombre,
        cantidad,
        precio_unitario: unitario,
        total: unitario * cantidad,
        metodo_pago: metodoValido(v.metodo_pago),
        vendedor_id: vendedorId,
        vendedor_nombre: vendedorNombre,
        ...(v.cliente_nombre?.trim() ? { cliente_nombre: v.cliente_nombre.trim().slice(0, 120) } : {}),
      };
      return {
        ventas: [venta, ...estado.ventas],
        productos: estado.productos.map((p) => (p.id === producto.id ? { ...p, existencias: p.existencias - cantidad } : p)),
      };
    }

    case "eliminarVenta": {
      // Deshacer una venta devuelve las piezas al almacén.
      exigir(s.rol === "admin", "Sólo el administrador elimina ventas.");
      const venta = buscar(estado.ventas, op.id, "Venta");
      return {
        ventas: estado.ventas.filter((v) => v.id !== op.id),
        productos: estado.productos.map((p) =>
          p.id === venta.producto_id ? { ...p, existencias: p.existencias + venta.cantidad } : p
        ),
      };
    }

    case "hacerCorte": {
      exigir(s.rol === "admin", "Sólo el administrador hace cortes de caja.");
      const c = op.corte;
      exigir(c && typeof c === "object", "Corte inválido.");
      idNuevo(estado.cortes, c.id);
      const desde = new Date(c.desde).getTime();
      const hasta = new Date(c.hasta).getTime();
      if (!Number.isFinite(desde) || !Number.isFinite(hasta) || hasta <= desde) {
        throw new ErrorOperacion("Las fechas del corte no son válidas.", 400);
      }
      // Los números se recalculan aquí: no se confía en los que mande el navegador.
      const calculado = calcularCorte(estado, desde, hasta);
      const contado = c.efectivo_contado === null || c.efectivo_contado === undefined ? null : precioValido(c.efectivo_contado, 0);
      const corte: CorteCaja = {
        ...calculado,
        id: c.id,
        desde: new Date(desde).toISOString(),
        hasta: new Date(hasta).toISOString(),
        creado_en: new Date().toISOString(),
        creado_por: s.nombre,
        efectivo_contado: contado,
        notas: String(c.notas ?? "").slice(0, 500),
      };
      return { cortes: [corte, ...estado.cortes] };
    }

    case "eliminarCorte":
      exigir(s.rol === "admin");
      buscar(estado.cortes, op.id, "Corte");
      return { cortes: estado.cortes.filter((c) => c.id !== op.id) };

    case "registrarCliente": {
      // El personal da de alta a cualquiera; un cliente sólo a sí mismo.
      exigir(esStaff(s) || (s.rol === "cliente" && op.cliente.id === s.id));
      const nuevo = !estado.clientes.some((c) => c.id === op.cliente.id);
      if (nuevo && esStaff(s)) {
        exigir(puede(estado, s, "registrar_clientes"), "No tienes permiso para dar de alta clientes.");
      }
      const cambios: Partial<Estado> = {};
      if (nuevo) {
        idNuevo(estado.clientes, op.cliente.id);
        const telefono = normalizarTelefono(op.cliente.telefono);
        if (telefono.length === 10 && estado.clientes.some((c) => normalizarTelefono(c.telefono) === telefono)) {
          throw new ErrorOperacion("Ya hay un cliente con ese teléfono.", 409);
        }
        const cliente: Cliente = {
          id: op.cliente.id,
          nombre: String(op.cliente.nombre ?? "").trim().slice(0, 120),
          telefono: String(op.cliente.telefono ?? "").trim().slice(0, 30),
          email: String(op.cliente.email ?? "").trim().slice(0, 200),
          creado_en: op.cliente.creado_en || new Date().toISOString(),
          ...(op.cliente.google && s.rol === "cliente" ? { google: true } : {}),
          // Lo pone el servidor, no el navegador: así nadie se adjudica clientes ajenos.
          ...(esStaff(s) ? { registrado_por: s.id } : {}),
          ...(s.rol === "cliente"
            ? { cuenta_id: s.id }
            : s.rol === "admin" && op.cliente.cuenta_id
              ? { cuenta_id: String(op.cliente.cuenta_id) }
              : {}),
        };
        cambios.clientes = [...estado.clientes, cliente];
      }
      if (!estado.tarjetas.some((t) => t.cliente_id === op.cliente.id)) {
        idNuevo(estado.tarjetas, op.tarjetaId);
        const numero = estado.tarjetas.some((t) => t.numero === op.numeroTarjeta)
          ? numeroDeTarjeta(new Set(estado.tarjetas.map((t) => t.numero)))
          : op.numeroTarjeta;
        cambios.tarjetas = [
          ...estado.tarjetas,
          {
            id: op.tarjetaId,
            numero,
            cliente_id: op.cliente.id,
            emitida_en: op.cliente.creado_en,
            sellos_extra: 0,
            estado: "activa",
            wallet_guardada_en: null,
          },
        ];
      }
      return cambios;
    }

    case "actualizarCliente": {
      exigir(esStaff(s));
      exigir(puede(estado, s, "editar_clientes"), "No tienes permiso para editar clientes.");
      const actual = buscar(estado.clientes, op.id, "Cliente");
      const permitidos: Partial<Cliente> = {};
      if (typeof op.cambios.nombre === "string") permitidos.nombre = op.cambios.nombre.trim().slice(0, 120);
      // Quien no ve el contacto tampoco lo puede pisar.
      if (veContactoDe(estado, s, actual)) {
        if (typeof op.cambios.telefono === "string") permitidos.telefono = op.cambios.telefono.trim().slice(0, 30);
        if (typeof op.cambios.email === "string") permitidos.email = op.cambios.email.trim().slice(0, 200);
      }
      const telefono = normalizarTelefono(permitidos.telefono ?? "");
      if (
        telefono.length === 10 &&
        estado.clientes.some((c) => c.id !== op.id && normalizarTelefono(c.telefono) === telefono)
      ) {
        throw new ErrorOperacion("Ya hay otro cliente con ese teléfono.", 409);
      }
      const cambios: Partial<Estado> = {
        clientes: estado.clientes.map((c) => (c.id === op.id ? { ...c, ...permitidos, id: c.id } : c)),
      };
      // El nombre corregido también se ve en su agenda.
      const nombre = permitidos.nombre?.trim();
      if (nombre && nombre !== actual.nombre) {
        cambios.citas = estado.citas.map((c) => (c.cliente_id === op.id ? { ...c, cliente_nombre: nombre } : c));
      }
      return cambios;
    }

    case "ajustarSellos":
      exigir(esStaff(s));
      exigir(puede(estado, s, "ajustar_sellos"), "No tienes permiso para poner sellos.");
      buscar(estado.tarjetas, op.tarjetaId, "Tarjeta");
      return {
        tarjetas: estado.tarjetas.map((t) =>
          t.id === op.tarjetaId ? { ...t, sellos_extra: Math.max(0, t.sellos_extra + Number(op.delta || 0)) } : t
        ),
      };

    case "cambiarEstadoTarjeta":
      exigir(s.rol === "admin");
      buscar(estado.tarjetas, op.tarjetaId, "Tarjeta");
      return {
        tarjetas: estado.tarjetas.map((t) =>
          t.id === op.tarjetaId ? { ...t, estado: op.estado === "suspendida" ? "suspendida" : "activa" } : t
        ),
      };

    case "marcarWalletGuardada": {
      const tarjeta = buscar(estado.tarjetas, op.tarjetaId, "Tarjeta");
      exigir(esStaff(s) || tarjeta.cliente_id === s.id);
      return {
        tarjetas: estado.tarjetas.map((t) => (t.id === op.tarjetaId ? { ...t, wallet_guardada_en: op.fecha } : t)),
      };
    }

    case "vincularCuentaCliente": {
      exigir(s.rol === "admin");
      buscar(estado.clientes, op.clienteId, "Cliente");
      return {
        clientes: estado.clientes.map((c) =>
          c.id === op.clienteId
            ? {
                ...c,
                cuenta_id: op.cuentaId,
                ...(op.google ? { google: true } : {}),
                ...(op.email && !c.email ? { email: op.email } : {}),
              }
            : c
        ),
      };
    }

    default:
      throw new ErrorOperacion("Operación desconocida.", 400);
  }
}

/**
 * Lo que cada quien puede ver. El personal ve todo; un cliente ve el catálogo
 * público, sus propios registros y, de las citas ajenas, sólo el hueco que
 * ocupan (para que el calendario de reservas no ofrezca horas tomadas).
 */
export function vistaPara(estado: Estado, s: Sesion | null): Estado {
  if (s?.rol === "admin") return estado;
  // Las comisiones sólo las ve el administrador.
  const servicios = estado.servicios.map((x) => ({ ...x, comision_pct: 0 }));
  const sinComision = (c: Cita): Cita => {
    const { comision_pct: _c, ...resto } = c;
    void _c;
    return resto;
  };
  if (s && esStaff(s)) {
    const p = permisosDe(estado.barberos.find((b) => b.id === s.id));
    const nombreVisible = (nombre: string) => (p.ver_nombres_clientes ? nombre : iniciales(nombre));
    const citas = estado.citas.map((c) => {
      const base = sinComision(c);
      if (c.barbero_id === s.id || p.ver_agenda_completa) return { ...base, cliente_nombre: nombreVisible(c.cliente_nombre) };
      // De la agenda ajena sólo se ve el hueco ocupado.
      return { ...base, cliente_id: "", cliente_nombre: "Ocupado", precio: 0, direccion_domicilio: null, notas: "" };
    });
    const clientes = estado.clientes.map((c) => {
      const { cuenta_id: _cuenta, ...resto } = c;
      void _cuenta;
      const visible = { ...resto, nombre: nombreVisible(c.nombre), cuenta: Boolean(c.cuenta_id) };
      return veContactoDe(estado, s, c) ? visible : { ...visible, telefono: "", email: "" };
    });
    const fichas = p.ver_nombres_clientes
      ? estado.fichas
      : estado.fichas.map((f) => ({ ...f, cliente_nombre: iniciales(f.cliente_nombre) }));
    const ventas = estado.ventas.filter((v) => v.vendedor_id === s.id);
    return { ...estado, servicios, citas, clientes, fichas, ventas, cortes: [], gastos: [] };
  }

  const citas = estado.citas
    .filter((c) => citaActiva(c) || c.cliente_id === s?.id)
    .map((c) =>
      s && c.cliente_id === s.id
        ? c
        : {
            ...c,
            cliente_id: "",
            cliente_nombre: "",
            precio: 0,
            direccion_domicilio: null,
            estado_pago: "pendiente" as const,
          }
    );

  const propio = <T,>(lista: T[], clave: (x: T) => string) => (s ? lista.filter((x) => clave(x) === s.id) : []);

  // De la tienda sólo se ve lo publicado, sin costo ni existencias exactas.
  const productos = estado.productos
    .filter((p) => p.publico && p.precio_venta > 0)
    .map((p) => ({ ...p, costo: 0, minimo: 0, existencias: p.existencias > 0 ? 1 : 0 }));

  return {
    ...estado,
    servicios,
    citas: citas.map(sinComision),
    fichas: [],
    productos,
    gastos: [],
    ventas: [],
    cortes: [],
    clientes: propio(estado.clientes, (c) => c.id),
    tarjetas: propio(estado.tarjetas, (t) => t.cliente_id),
    canjes: s && estado.canjes[s.id] ? { [s.id]: estado.canjes[s.id] } : {},
  };
}

// ---------------------------------------------------------------------------
// Derivaciones de negocio
// ---------------------------------------------------------------------------

export type ClienteResumen = {
  id: string;
  nombre: string;
  /** Visitas reales: citas con la llegada confirmada (Asistió) */
  visitas: number;
  /** Veces que no se presentó */
  faltas: number;
  /** Lo que ha consumido: suma de sus citas atendidas */
  gastoTotal: number;
  /** De lo consumido, lo que ya pagó */
  pagado: number;
  ticketMedio: number;
  ultimaVisita: string | null;
  proximaCita: string | null;
  barberoPreferido: string;
  diasDesdeUltima: number | null;
  cadenciaDias: number | null;
  /** Riesgo de fuga: lleva más del doble de su cadencia habitual sin volver */
  enRiesgo: boolean;
};

const suma = (lista: Cita[], f: (c: Cita) => number = (c) => c.precio) => lista.reduce((a, c) => a + f(c), 0);

/**
 * Construye la ficha 360 de cada cliente a partir de las citas. Una visita es
 * una cita con la llegada confirmada (escaneo del QR o «Llegó»): en cuanto se
 * confirma, sube su número de visitas, su gasto y su barbero de confianza.
 */
export function resumirClientes(citas: Cita[]): ClienteResumen[] {
  const ahora = Date.now();
  const porCliente = new Map<string, Cita[]>();

  for (const c of citas) {
    if (!c.cliente_id || c.estado === "cancelada" || c.cliente_eliminado) continue;
    const lista = porCliente.get(c.cliente_id) ?? [];
    lista.push(c);
    porCliente.set(c.cliente_id, lista);
  }

  const resumen: ClienteResumen[] = [];

  for (const [id, lista] of porCliente) {
    const ordenadas = [...lista].sort((a, b) => a.inicio.localeCompare(b.inicio));
    const atendidas = ordenadas.filter((c) => c.estado === "asistida");
    const futuras = ordenadas.filter((c) => c.estado === "confirmada" && new Date(c.fin).getTime() > ahora);

    const gastoTotal = suma(atendidas);
    const pagado = suma(atendidas.filter((c) => c.estado_pago === "pagado"));

    // Barbero preferido: el que más veces lo ha atendido.
    const conteo = new Map<string, number>();
    for (const c of atendidas) conteo.set(c.barbero_nombre, (conteo.get(c.barbero_nombre) ?? 0) + 1);
    const barberoPreferido = [...conteo.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

    const ultima = atendidas.at(-1) ?? null;
    const diasDesdeUltima = ultima ? Math.floor((ahora - new Date(ultima.inicio).getTime()) / 86_400_000) : null;

    // Cadencia: media de días entre visitas consecutivas.
    let cadenciaDias: number | null = null;
    if (atendidas.length > 1) {
      let total = 0;
      for (let i = 1; i < atendidas.length; i++) {
        total += (new Date(atendidas[i].inicio).getTime() - new Date(atendidas[i - 1].inicio).getTime()) / 86_400_000;
      }
      cadenciaDias = Math.round(total / (atendidas.length - 1));
    }

    resumen.push({
      id,
      nombre: ordenadas.at(-1)!.cliente_nombre,
      visitas: atendidas.length,
      faltas: ordenadas.filter((c) => c.estado === "no_asistio").length,
      gastoTotal,
      pagado,
      ticketMedio: atendidas.length > 0 ? Math.round(gastoTotal / atendidas.length) : 0,
      ultimaVisita: ultima?.inicio ?? null,
      proximaCita: futuras[0]?.inicio ?? null,
      barberoPreferido,
      diasDesdeUltima,
      cadenciaDias,
      enRiesgo:
        futuras.length === 0 && cadenciaDias !== null && diasDesdeUltima !== null && diasDesdeUltima > cadenciaDias * 2,
    });
  }

  return resumen.sort((a, b) => b.gastoTotal - a.gastoTotal);
}

/** Números de una lista de citas: lo que todos los paneles muestran igual. */
export function resumirCitas(citas: Cita[]) {
  const ahora = Date.now();
  const atendidas = citas.filter((c) => c.estado === "asistida");
  const faltas = citas.filter((c) => c.estado === "no_asistio");
  const porVenir = citas.filter((c) => c.estado === "confirmada");
  const cobradas = citas.filter((c) => citaActiva(c) && c.estado_pago === "pagado");
  const porCobrar = atendidas.filter((c) => c.estado_pago === "pendiente");
  // Asistencia: de las citas cuya hora ya pasó, cuántas llegaron.
  const vencidas = citas.filter(
    (c) => c.estado === "asistida" || c.estado === "no_asistio" || (c.estado === "confirmada" && new Date(c.fin).getTime() < ahora)
  );
  const ingresos = suma(atendidas);
  const comisiones = Math.round(suma(atendidas, (c) => (c.precio * (c.comision_pct ?? 0)) / 100));
  return {
    /** Parte del barbero sobre lo atendido (sólo tiene datos para el administrador) */
    comisiones,
    total: citas.filter((c) => c.estado !== "cancelada").length,
    atendidas: atendidas.length,
    faltas: faltas.length,
    porVenir: porVenir.length,
    canceladas: citas.filter((c) => c.estado === "cancelada").length,
    /** Valor de los servicios realizados */
    ingresos,
    cobrado: suma(cobradas),
    porCobrar: suma(porCobrar),
    porCobrarCitas: porCobrar.length,
    /** Lo que suman las citas agendadas que aún no llegan */
    agendado: suma(porVenir),
    ticketMedio: atendidas.length > 0 ? ingresos / atendidas.length : 0,
    asistencia: vencidas.length > 0 ? atendidas.length / vencidas.length : 0,
    clientes: new Set(atendidas.map((c) => c.cliente_id).filter(Boolean)).size,
  };
}

export type BarberoResumen = ReturnType<typeof resumirCitas> & { id: string; nombre: string; activo: boolean };

/** Desempeño de cada barbero: atendidas, clientes, ingresos y faltas. */
export function resumirBarberos(citas: Cita[], barberos: Pick<Barbero, "id" | "nombre" | "activo">[]): BarberoResumen[] {
  return barberos.map((b) => ({
    id: b.id,
    nombre: b.nombre,
    activo: b.activo,
    ...resumirCitas(citas.filter((c) => c.barbero_id === b.id)),
  }));
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

/** Sólo URLs https (o rutas del propio sitio) para las fotos de producto. */
export function urlDeImagen(valor: unknown) {
  const v = String(valor ?? "").trim().slice(0, 600);
  if (!v) return "";
  if (v.startsWith("/") && !v.startsWith("//")) return v;
  try {
    const u = new URL(v);
    return u.protocol === "https:" ? u.toString() : "";
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Caja
// ---------------------------------------------------------------------------

const ORDEN_DIAS: DiaSemana[] = ["dom", "lun", "mar", "mie", "jue", "vie", "sab"];

/** Semana de corte que contiene `fecha`, empezando en el día configurado (lunes por defecto). */
export function semanaDeCorte(fecha: Date, inicio: DiaSemana = "lun") {
  const objetivo = ORDEN_DIAS.indexOf(inicio);
  const d = new Date(fecha);
  d.setHours(0, 0, 0, 0);
  const atras = (d.getDay() - objetivo + 7) % 7;
  d.setDate(d.getDate() - atras);
  const fin = new Date(d);
  fin.setDate(fin.getDate() + 7);
  return { desde: d, hasta: fin };
}

/** Momento en que cuenta un cobro: cuando se pagó o, en citas viejas, su hora. */
const momentoDeCobro = (c: Cita) => new Date(c.pagada_en || c.inicio).getTime();

/**
 * Números de caja de un periodo [desde, hasta): servicios cobrados, productos
 * vendidos, propinas, desglose por método, comisiones y gastos.
 */
export function calcularCorte(
  estado: Pick<Estado, "citas" | "ventas" | "gastos">,
  desde: number,
  hasta: number
): Omit<CorteCaja, "id" | "desde" | "hasta" | "creado_en" | "creado_por" | "efectivo_contado" | "notas"> {
  const enRango = (t: number) => t >= desde && t < hasta;
  const cobradas = estado.citas.filter((c) => citaActiva(c) && c.estado_pago === "pagado" && enRango(momentoDeCobro(c)));
  const ventas = estado.ventas.filter((v) => enRango(new Date(v.fecha).getTime()));
  const gastos = estado.gastos.filter((g) => enRango(new Date(g.fecha).getTime()));

  const metodo = { efectivo: 0, tarjeta: 0, transferencia: 0 } as Record<MetodoPago, number>;
  const equipo = new Map<string, CorteCaja["equipo"][number]>();
  const de = (id: string, nombre: string) => {
    const e = equipo.get(id) ?? { id, nombre, servicios: 0, comision: 0, propinas: 0, productos: 0 };
    equipo.set(id, e);
    return e;
  };
  let servicios = 0;
  let propinas = 0;
  let comisiones = 0;
  for (const c of cobradas) {
    const propina = c.propina ?? 0;
    const comision = (c.precio * (c.comision_pct ?? 0)) / 100;
    servicios += c.precio;
    propinas += propina;
    comisiones += comision;
    metodo[metodoValido(c.metodo_pago)] += c.precio + propina;
    const e = de(c.barbero_id, c.barbero_nombre);
    e.servicios += c.precio;
    e.comision += comision;
    e.propinas += propina;
  }
  let productos = 0;
  for (const v of ventas) {
    productos += v.total;
    metodo[metodoValido(v.metodo_pago)] += v.total;
    de(v.vendedor_id, v.vendedor_nombre).productos += v.total;
  }
  const totalGastos = gastos.reduce((a, g) => a + g.monto, 0);
  comisiones = Math.round(comisiones);
  return {
    servicios,
    productos,
    propinas,
    efectivo: metodo.efectivo,
    tarjeta: metodo.tarjeta,
    transferencia: metodo.transferencia,
    comisiones,
    gastos: totalGastos,
    utilidad: servicios + productos - comisiones - totalGastos,
    citas: cobradas.length,
    ventas: ventas.reduce((a, v) => a + v.cantidad, 0),
    equipo: [...equipo.values()]
      .map((e) => ({ ...e, comision: Math.round(e.comision) }))
      .sort((a, b) => b.servicios + b.productos - (a.servicios + a.productos)),
  };
}
