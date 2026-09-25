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
  /** Mismo id que su usuario de Supabase Auth */
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
export const NOMBRE_POR_DEFECTO = process.env.NEXT_PUBLIC_NOMBRE_NEGOCIO || "Barbería";

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
      inicio: string;
      fin: string;
      modalidad: "presencial" | "domicilio";
      metodo_pago: MetodoPago;
      direccion_domicilio?: string;
    }
  | { tipo: "cobrarEfectivo"; id: string }
  | { tipo: "marcarAsistida"; id: string }
  | { tipo: "cancelarCita"; id: string }
  | { tipo: "agregarBarbero"; barbero: Barbero }
  | { tipo: "actualizarBarbero"; id: string; cambios: Partial<Omit<Barbero, "id">> }
  | { tipo: "toggleActivoBarbero"; id: string }
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
      // La duración la pone el barbero, no el navegador.
      const fin = inicio + Math.max(5, barbero.duracion_cita_min) * 60_000;
      const problema = horarioReservable(
        {
          barbero,
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
        precio: barbero.precio_servicio,
        direccion_domicilio:
          op.modalidad === "domicilio" && barbero.acepta_domicilio
            ? String(op.direccion_domicilio || "Domicilio del cliente").slice(0, 300)
            : null,
        // De momento sólo se cobra en efectivo en la barbería: el pago en
        // línea no está conectado y no se puede dar una cita por pagada.
        metodo_pago: "efectivo",
        estado_pago: "pendiente",
      };
      return { citas: [...estado.citas, nueva] };
    }

    case "cobrarEfectivo":
    case "marcarAsistida":
    case "cancelarCita": {
      const cita = buscar(estado.citas, op.id, "Cita");
      const propiaDelBarbero = s.rol === "barbero" && cita.barbero_id === s.id;
      const propiaDelCliente = s.rol === "cliente" && cita.cliente_id === s.id;
      if (op.tipo === "cancelarCita") exigir(s.rol === "admin" || propiaDelBarbero || propiaDelCliente);
      else exigir(s.rol === "admin" || propiaDelBarbero);
      const cambios: Partial<Cita> =
        op.tipo === "cobrarEfectivo"
          ? { estado_pago: "pagado" }
          : op.tipo === "marcarAsistida"
            ? { estado: "asistida" }
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
      return { barberos: estado.barberos.map((b) => (b.id === op.id ? { ...b, ...cambios, id: b.id } : b)) };
    }

    case "toggleActivoBarbero": {
      exigir(s.rol === "admin");
      buscar(estado.barberos, op.id, "Barbero");
      return { barberos: estado.barberos.map((b) => (b.id === op.id ? { ...b, activo: !b.activo } : b)) };
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

    case "actualizarCliente":
      exigir(esStaff(s));
      buscar(estado.clientes, op.id, "Cliente");
      return { clientes: estado.clientes.map((c) => (c.id === op.id ? { ...c, ...op.cambios, id: c.id } : c)) };

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
  if (s && esStaff(s)) return estado;

  const citas = estado.citas
    .filter((c) => c.estado !== "cancelada" || c.cliente_id === s?.id)
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
    citas,
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
