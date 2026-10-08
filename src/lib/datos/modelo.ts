// ============================================================================
// Modelo de la barbería: tipos, valores por defecto y las operaciones que lo
// modifican. No depende del navegador ni del servidor, así que la misma
// función `aplicarOperacion` corre en los dos lados: en el navegador para que
// la pantalla responda al instante y en /api/datos, que es quien decide de
// verdad y guarda en Supabase.
// ============================================================================

import { horarioReservable } from "@/lib/datos/disponibilidad";

export type Rol = "cliente" | "barbero" | "admin";

export type MetodoPago = "tarjeta" | "efectivo";
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
  /** Servicio contratado: de él salen el precio y la duración */
  servicio_id?: string | null;
  servicio_nombre?: string;
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
        Pick<Cita, "inicio" | "barbero_id" | "servicio_id" | "estado" | "precio" | "estado_pago" | "notas" | "modalidad" | "direccion_domicilio">
      >;
      forzar?: boolean;
    }
  | { tipo: "cobrarEfectivo"; id: string }
  | { tipo: "marcarAsistida"; id: string }
  | { tipo: "cancelarCita"; id: string }
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
  | { tipo: "actualizarServicio"; id: string; cambios: Partial<Omit<Servicio, "id">> }
  | { tipo: "agregarProducto"; producto: Producto }
  | { tipo: "ajustarExistencias"; id: string; delta: number }
  | { tipo: "agregarGasto"; gasto: Gasto }
  | { tipo: "eliminarGasto"; id: string }
  | { tipo: "registrarCliente"; cliente: Cliente; tarjetaId: string; numeroTarjeta: string }
  | { tipo: "actualizarCliente"; id: string; cambios: Partial<Omit<Cliente, "id">> }
  | { tipo: "ajustarSellos"; tarjetaId: string; delta: number }
  | { tipo: "cambiarEstadoTarjeta"; tarjetaId: string; estado: EstadoTarjeta }
  | { tipo: "marcarWalletGuardada"; tarjetaId: string; fecha: string };

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

/**
 * Servicio elegido para una cita y lo que define: precio, duración y comisión.
 * Sin catálogo (barbería recién abierta) la cita va sin servicio, precio 0 y
 * la duración base del barbero.
 */
function servicioParaCita(estado: Estado, servicioId: string | null | undefined, barbero: Barbero) {
  const activos = estado.servicios.filter((x) => x.activo);
  if (!servicioId) {
    if (activos.length > 0) throw new ErrorOperacion("Elige el servicio.", 400);
    return { servicio: null, precio: 0, duracion: Math.max(5, barbero.duracion_cita_min), comision: 0 };
  }
  const servicio = estado.servicios.find((x) => x.id === servicioId);
  if (!servicio) throw new ErrorOperacion("Ese servicio ya no existe.", 400);
  return {
    servicio,
    precio: servicio.precio,
    duracion: Math.max(5, servicio.duracion_min),
    comision: Math.min(100, Math.max(0, servicio.comision_pct)),
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
      idNuevo(estado.citas, op.id);
      const barbero = estado.barberos.find((b) => b.id === op.barbero_id);
      if (!barbero) throw new ErrorOperacion("El barbero no está disponible.", 400);
      const inicio = new Date(op.inicio).getTime();
      if (!Number.isFinite(inicio)) throw new ErrorOperacion("Horario inválido.", 400);
      // Precio y duración los pone el servicio, no el navegador.
      const sv = servicioParaCita(estado, op.servicio_id, barbero);
      if (sv.servicio && !sv.servicio.activo) throw new ErrorOperacion("Ese servicio no está disponible.", 400);
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
      const nueva: Cita = {
        id: op.id,
        cliente_id: s.id,
        cliente_nombre: s.nombre,
        barbero_id: barbero.id,
        barbero_nombre: barbero.nombre,
        especialidad: barbero.especialidad,
        inicio: new Date(inicio).toISOString(),
        fin: new Date(fin).toISOString(),
        modalidad: op.modalidad === "domicilio" && barbero.acepta_domicilio ? "domicilio" : "presencial",
        estado: "confirmada",
        precio: sv.precio,
        servicio_id: sv.servicio?.id ?? null,
        servicio_nombre: sv.servicio?.nombre ?? "",
        comision_pct: sv.comision,
        direccion_domicilio:
          op.modalidad === "domicilio" && barbero.acepta_domicilio
            ? String(op.direccion_domicilio || "Domicilio del cliente").slice(0, 300)
            : null,
        // De momento sólo se cobra en efectivo en la barbería: el pago en
        // línea no está conectado y no se puede dar una cita por pagada.
        metodo_pago: "efectivo",
        estado_pago: "pendiente",
        creada_por: "cliente",
      };
      return { citas: [...estado.citas, nueva] };
    }

    case "crearCitaPersonal": {
      exigir(esStaff(s), "Sólo el personal agenda a nombre de un cliente.");
      exigir(s.rol === "admin" || op.barbero_id === s.id, "Sólo puedes agendar en tu propia agenda.");
      idNuevo(estado.citas, op.id);
      const cliente = buscar(estado.clientes, op.cliente_id, "Cliente");
      const barbero = buscar(estado.barberos, op.barbero_id, "Barbero");
      const inicio = new Date(op.inicio).getTime();
      if (!Number.isFinite(inicio)) throw new ErrorOperacion("Horario inválido.", 400);
      const sv = servicioParaCita(estado, op.servicio_id, barbero);
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
        servicio_id: sv.servicio?.id ?? null,
        servicio_nombre: sv.servicio?.nombre ?? "",
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
      }
      let duracion = Math.max(5 * 60_000, new Date(cita.fin).getTime() - new Date(cita.inicio).getTime());
      if (c.servicio_id !== undefined && c.servicio_id !== (cita.servicio_id ?? null)) {
        const sv = servicioParaCita(estado, c.servicio_id, buscar(estado.barberos, siguiente.barbero_id, "Barbero"));
        siguiente.servicio_id = sv.servicio?.id ?? null;
        siguiente.servicio_nombre = sv.servicio?.nombre ?? "";
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
        siguiente.estado = c.estado;
        siguiente.llegada_en = c.estado === "asistida" ? (cita.llegada_en ?? new Date().toISOString()) : null;
      }
      if (c.precio !== undefined) {
        exigir(s.rol === "admin", "Sólo el administrador cambia el precio.");
        siguiente.precio = precioValido(c.precio, cita.precio);
      }
      if (c.estado_pago !== undefined) siguiente.estado_pago = c.estado_pago === "pagado" ? "pagado" : "pendiente";
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
    case "marcarAsistida":
    case "cancelarCita": {
      const cita = buscar(estado.citas, op.id, "Cita");
      const propiaDelBarbero = s.rol === "barbero" && cita.barbero_id === s.id;
      const propiaDelCliente = s.rol === "cliente" && cita.cliente_id === s.id;
      if (op.tipo === "cancelarCita") exigir(s.rol === "admin" || propiaDelBarbero || propiaDelCliente);
      else exigir(s.rol === "admin" || propiaDelBarbero);
      if (op.tipo === "marcarAsistida" && cita.estado === "cancelada") {
        throw new ErrorOperacion("La cita está cancelada. Reactívala antes de confirmar la llegada.", 409);
      }
      if (op.tipo === "cancelarCita" && s.rol === "cliente" && cita.estado !== "confirmada") {
        throw new ErrorOperacion("Esta cita ya no se puede cancelar.", 409);
      }
      const cambios: Partial<Cita> =
        op.tipo === "cobrarEfectivo"
          ? { estado_pago: "pagado" }
          : op.tipo === "marcarAsistida"
            ? { estado: "asistida", llegada_en: cita.llegada_en ?? new Date().toISOString() }
            : { estado: "cancelada" };
      return { citas: estado.citas.map((c) => (c.id === op.id ? { ...c, ...cambios } : c)) };
    }

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
      if (s.rol !== "admin") delete cambios.activo;
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

    case "actualizarServicio":
      exigir(s.rol === "admin");
      buscar(estado.servicios, op.id, "Servicio");
      return { servicios: estado.servicios.map((x) => (x.id === op.id ? { ...x, ...op.cambios, id: x.id } : x)) };

    case "agregarProducto":
      exigir(s.rol === "admin");
      idNuevo(estado.productos, op.producto.id);
      return { productos: [...estado.productos, op.producto] };

    case "ajustarExistencias":
      exigir(s.rol === "admin");
      buscar(estado.productos, op.id, "Producto");
      return {
        productos: estado.productos.map((p) =>
          p.id === op.id ? { ...p, existencias: Math.max(0, p.existencias + Number(op.delta || 0)) } : p
        ),
      };

    case "agregarGasto":
      exigir(s.rol === "admin");
      idNuevo(estado.gastos, op.gasto.id);
      return { gastos: [op.gasto, ...estado.gastos] };

    case "eliminarGasto":
      exigir(s.rol === "admin");
      return { gastos: estado.gastos.filter((g) => g.id !== op.id) };

    case "registrarCliente": {
      // El personal da de alta a cualquiera; un cliente sólo a sí mismo.
      exigir(esStaff(s) || (s.rol === "cliente" && op.cliente.id === s.id));
      const cambios: Partial<Estado> = {};
      if (!estado.clientes.some((c) => c.id === op.cliente.id)) {
        idNuevo(estado.clientes, op.cliente.id);
        cambios.clientes = [...estado.clientes, op.cliente];
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
      const actual = buscar(estado.clientes, op.id, "Cliente");
      const cambios: Partial<Estado> = {
        clientes: estado.clientes.map((c) => (c.id === op.id ? { ...c, ...op.cambios, id: c.id } : c)),
      };
      // El nombre corregido también se ve en su agenda.
      const nombre = op.cambios.nombre?.trim();
      if (nombre && nombre !== actual.nombre) {
        cambios.citas = estado.citas.map((c) => (c.cliente_id === op.id ? { ...c, cliente_nombre: nombre } : c));
      }
      return cambios;
    }

    case "ajustarSellos":
      exigir(esStaff(s));
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
  if (s && esStaff(s)) return { ...estado, servicios, citas: estado.citas.map(sinComision) };

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

  return {
    ...estado,
    servicios,
    citas: citas.map(sinComision),
    fichas: [],
    productos: [],
    gastos: [],
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
