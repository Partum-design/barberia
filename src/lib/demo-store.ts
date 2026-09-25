"use client";

import { useCallback, useEffect, useState } from "react";
import { authDisponible, getSupabaseBrowser } from "@/lib/supabase/client";

// ============================================================================
// Almacén local de la demo: los datos viven en localStorage del navegador,
// por lo que agendar, cancelar, cobrar o dar de alta un barbero funciona de
// verdad y persiste entre recargas.
//
// La sesión es el único dato que ya no es siempre local: si el proyecto tiene
// credenciales de Supabase, `useDemoStore` toma la sesión real (Google OAuth,
// contraseña o enlace mágico) y la traduce al mismo tipo `SesionDemo` que ya
// consumían todas las páginas. Así la autenticación pasa a ser real sin que
// ninguna pantalla del producto tenga que cambiar.
// ============================================================================

export type RolDemo = "cliente" | "barbero" | "admin";

export type MetodoPago = "tarjeta" | "efectivo";
export type EstadoPago = "pagado" | "pendiente";

export type SesionDemo = {
  rol: RolDemo;
  id: string;
  nombre: string;
  subtitulo: string;
};

export type CitaDemo = {
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

export type BarberoDemo = {
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

export type FichaDemo = {
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
  direccion: string;
  telefono: string;
};

// --- Catálogo, inventario y caja -------------------------------------------

export type ServicioDemo = {
  id: string;
  nombre: string;
  categoria: "Corte" | "Barba" | "Color" | "Ritual" | "Paquete";
  precio: number;
  duracion_min: number;
  /** Porcentaje del servicio que se lleva el barbero */
  comision_pct: number;
  activo: boolean;
};

export type ProductoDemo = {
  id: string;
  nombre: string;
  categoria: "Cuidado" | "Peinado" | "Afeitado" | "Consumible";
  existencias: number;
  minimo: number;
  costo: number;
  precio_venta: number;
  unidad: string;
};

export type GastoDemo = {
  id: string;
  concepto: string;
  categoria: "Renta" | "Insumos" | "Nómina" | "Publicidad" | "Servicios" | "Otros";
  monto: number;
  fecha: string; // ISO
};

export const CUENTAS_DEMO: Record<RolDemo, SesionDemo> = {
  cliente: { rol: "cliente", id: "cli-1", nombre: "Mariana Gutiérrez", subtitulo: "Cliente" },
  barbero: { rol: "barbero", id: "bar-1", nombre: "Iván Rosales", subtitulo: "Fades y diseño de barba" },
  admin: { rol: "admin", id: "adm-1", nombre: "Bruno Salas", subtitulo: "Administrador · Barbería Partum" },
};

// Semilla inicial de barberos. Tras la primera carga viven en localStorage,
// así que dar de alta o desactivar un barbero desde el panel persiste de verdad.
export const BARBEROS_DEMO: BarberoDemo[] = [
  {
    id: "bar-1",
    nombre: "Iván Rosales",
    especialidad: "Fades y diseño de barba",
    precio_servicio: 250,
    duracion_cita_min: 30,
    acepta_domicilio: true,
    biografia: "12 años de experiencia. Especialista en fades y degradados de precisión.",
    activo: true,
  },
  {
    id: "bar-2",
    nombre: "Andrés Lira",
    especialidad: "Cortes infantiles",
    precio_servicio: 200,
    duracion_cita_min: 30,
    acepta_domicilio: true,
    biografia: "Especialista en cortes para niños y primeras visitas.",
    activo: true,
  },
  {
    id: "bar-3",
    nombre: "Sofía Cantú",
    especialidad: "Afeitado clásico y barbería tradicional",
    precio_servicio: 300,
    duracion_cita_min: 45,
    acepta_domicilio: false,
    biografia: "Enfoque en rituales de afeitado con navaja y toalla caliente.",
    activo: true,
  },
];

const KEY_CITAS = "bbp-demo-citas-v1";
const KEY_SESION = "bbp-demo-sesion-v1";
const KEY_BARBEROS = "bbp-demo-barberos-v1";
const KEY_HORARIOS = "bbp-demo-horarios-v1";
const KEY_FICHAS = "bbp-demo-fichas-v1";
const KEY_RECOMPENSAS = "bbp-demo-recompensas-v1";
const KEY_BARBERIA = "bbp-demo-barberia-v1";
const KEY_CANJES = "bbp-demo-canjes-v1";
const KEY_SERVICIOS = "bbp-demo-servicios-v1";
const KEY_PRODUCTOS = "bbp-demo-productos-v1";
const KEY_GASTOS = "bbp-demo-gastos-v1";

function iso(diasDesdeHoy: number, hora: number, min = 0) {
  const d = new Date();
  d.setDate(d.getDate() + diasDesdeHoy);
  d.setHours(hora, min, 0, 0);
  return d.toISOString();
}

// Cartera de clientes de la barbería para el histórico generado. Los nombres
// están fijos a propósito: el CRM tiene que poder mostrar la misma persona
// volviendo cada tres semanas, no ruido distinto en cada recarga.
const CARTERA_DEMO: { id: string; nombre: string }[] = [
  { id: "cli-10", nombre: "Diego Torres" },
  { id: "cli-11", nombre: "Sofía Ramírez" },
  { id: "cli-12", nombre: "Emiliano Vega" },
  { id: "cli-13", nombre: "Regina Ávalos" },
  { id: "cli-14", nombre: "Mateo Herrera" },
  { id: "cli-15", nombre: "Camila Ordóñez" },
  { id: "cli-16", nombre: "Santiago Bravo" },
  { id: "cli-17", nombre: "Valeria Nieto" },
  { id: "cli-18", nombre: "Rodrigo Cisneros" },
  { id: "cli-19", nombre: "Ximena Peralta" },
  { id: "cli-20", nombre: "Alejandro Fuentes" },
  { id: "cli-21", nombre: "Fernanda Solís" },
  { id: "cli-22", nombre: "Héctor Zamudio" },
  { id: "cli-23", nombre: "Paulina Cordero" },
  { id: "cli-24", nombre: "Gonzalo Íñiguez" },
  { id: "cli-25", nombre: "Renata Aguilar" },
  { id: "cli-26", nombre: "Maximiliano Ruvalcaba" },
  { id: "cli-27", nombre: "Daniela Escamilla" },
];

/**
 * Histórico sintético de la barbería: 34 días hacia atrás y 6 hacia adelante,
 * con tres barberos y jornada de mañana y tarde.
 *
 * Es determinista (generador congruencial con semilla fija), así que el mismo
 * navegador ve siempre las mismas cifras y los módulos de caja, clientes y
 * reportes cuadran entre sí. Sin este volumen, la utilidad del periodo saldría
 * negativa frente a una renta real y el panel parecería roto.
 */
function seedHistorico(): CitaDemo[] {
  let semilla = 20260721;
  const rnd = () => {
    semilla = (semilla * 16807) % 2147483647;
    return (semilla - 1) / 2147483646;
  };

  const citas: CitaDemo[] = [];
  const ahora = Date.now();

  for (let dia = -34; dia <= 6; dia++) {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() + dia);
    const diaSemana = fecha.getDay();
    if (diaSemana === 0) continue; // domingo cerrado

    // Viernes y sábado se llena la agenda; entre semana se respira.
    const factor = diaSemana === 5 ? 1.35 : diaSemana === 6 ? 1.5 : 1;

    for (const barbero of BARBEROS_DEMO) {
      const cuantas = Math.round((3 + rnd() * 2) * factor);
      for (let i = 0; i < cuantas; i++) {
        const hora = 9 + Math.floor(rnd() * 10); // 09:00–18:00
        const minuto = rnd() > 0.5 ? 30 : 0;
        const inicio = iso(dia, hora, minuto);
        const inicioMs = new Date(inicio).getTime();
        const cliente = CARTERA_DEMO[Math.floor(rnd() * CARTERA_DEMO.length)];
        const domicilio = barbero.acepta_domicilio && rnd() > 0.82;
        const precio = domicilio ? barbero.precio_servicio + 150 : barbero.precio_servicio;

        const pasada = inicioMs < ahora;
        const cancelada = rnd() > 0.94;
        const metodo: MetodoPago = rnd() > 0.34 ? "tarjeta" : "efectivo";

        citas.push({
          id: `c-h-${dia}-${barbero.id}-${i}`,
          cliente_id: cliente.id,
          cliente_nombre: cliente.nombre,
          barbero_id: barbero.id,
          barbero_nombre: barbero.nombre,
          especialidad: barbero.especialidad,
          inicio,
          fin: new Date(inicioMs + barbero.duracion_cita_min * 60_000).toISOString(),
          modalidad: domicilio ? "domicilio" : "presencial",
          estado: cancelada ? "cancelada" : pasada ? "asistida" : "confirmada",
          precio,
          direccion_domicilio: domicilio ? "Domicilio del cliente" : null,
          metodo_pago: metodo,
          // El efectivo se cobra en el sillón: sólo está pagado si ya ocurrió.
          estado_pago:
            cancelada || (metodo === "efectivo" && !pasada) ? "pendiente" : "pagado",
        });
      }
    }
  }

  return citas;
}

function seedCitas(): CitaDemo[] {
  return [
    ...seedHistorico(),
    // Historial de Mariana con Iván (3 asistidas → lealtad 3/5)
    { id: "c-h1", cliente_id: "cli-1", cliente_nombre: "Mariana Gutiérrez", barbero_id: "bar-1", barbero_nombre: "Iván Rosales", especialidad: "Fades y diseño de barba", inicio: iso(-45, 10), fin: iso(-45, 10, 30), modalidad: "presencial", estado: "asistida", precio: 250, direccion_domicilio: null, metodo_pago: "tarjeta", estado_pago: "pagado" },
    { id: "c-h2", cliente_id: "cli-1", cliente_nombre: "Mariana Gutiérrez", barbero_id: "bar-1", barbero_nombre: "Iván Rosales", especialidad: "Fades y diseño de barba", inicio: iso(-30, 11), fin: iso(-30, 11, 30), modalidad: "domicilio", estado: "asistida", precio: 400, direccion_domicilio: "Av. Insurgentes Sur 1421, CDMX", metodo_pago: "tarjeta", estado_pago: "pagado" },
    { id: "c-h3", cliente_id: "cli-1", cliente_nombre: "Mariana Gutiérrez", barbero_id: "bar-1", barbero_nombre: "Iván Rosales", especialidad: "Fades y diseño de barba", inicio: iso(-14, 9), fin: iso(-14, 9, 30), modalidad: "presencial", estado: "asistida", precio: 250, direccion_domicilio: null, metodo_pago: "efectivo", estado_pago: "pagado" },
    // Hoy, agenda de Iván
    { id: "c-t1", cliente_id: "cli-2", cliente_nombre: "Carlos Reyna", barbero_id: "bar-1", barbero_nombre: "Iván Rosales", especialidad: "Fades y diseño de barba", inicio: iso(0, 9), fin: iso(0, 9, 30), modalidad: "presencial", estado: "confirmada", precio: 250, direccion_domicilio: null, metodo_pago: "tarjeta", estado_pago: "pagado" },
    { id: "c-t2", cliente_id: "cli-1", cliente_nombre: "Mariana Gutiérrez", barbero_id: "bar-1", barbero_nombre: "Iván Rosales", especialidad: "Fades y diseño de barba", inicio: iso(0, 10, 30), fin: iso(0, 11), modalidad: "domicilio", estado: "confirmada", precio: 400, direccion_domicilio: "Av. Insurgentes Sur 1421, CDMX", metodo_pago: "tarjeta", estado_pago: "pagado" },
    { id: "c-t3", cliente_id: "cli-3", cliente_nombre: "Lucía Mendoza", barbero_id: "bar-1", barbero_nombre: "Iván Rosales", especialidad: "Fades y diseño de barba", inicio: iso(0, 12), fin: iso(0, 12, 30), modalidad: "presencial", estado: "confirmada", precio: 250, direccion_domicilio: null, metodo_pago: "efectivo", estado_pago: "pendiente" },
    // Próximos días
    { id: "c-f1", cliente_id: "cli-4", cliente_nombre: "Jorge Palacios", barbero_id: "bar-1", barbero_nombre: "Iván Rosales", especialidad: "Fades y diseño de barba", inicio: iso(1, 9), fin: iso(1, 9, 30), modalidad: "domicilio", estado: "confirmada", precio: 400, direccion_domicilio: "Calle Amsterdam 88, CDMX", metodo_pago: "tarjeta", estado_pago: "pagado" },
    { id: "c-f2", cliente_id: "cli-5", cliente_nombre: "Ana Sosa", barbero_id: "bar-2", barbero_nombre: "Andrés Lira", especialidad: "Cortes infantiles", inicio: iso(1, 11), fin: iso(1, 11, 30), modalidad: "presencial", estado: "confirmada", precio: 200, direccion_domicilio: null, metodo_pago: "efectivo", estado_pago: "pendiente" },
    { id: "c-f3", cliente_id: "cli-6", cliente_nombre: "Elena Michel", barbero_id: "bar-3", barbero_nombre: "Sofía Cantú", especialidad: "Afeitado clásico y barbería tradicional", inicio: iso(2, 10), fin: iso(2, 10, 45), modalidad: "presencial", estado: "confirmada", precio: 300, direccion_domicilio: null, metodo_pago: "tarjeta", estado_pago: "pagado" },
  ];
}

function seedFichas(): FichaDemo[] {
  return [
    {
      id: "ficha-1",
      cliente_id: "cli-1",
      cliente_nombre: "Mariana Gutiérrez",
      barbero_id: "bar-1",
      servicio: "Corte + diseño de barba",
      notas: "Tijera en los costados, máquina #2 en la nuca. Barba con línea recta, sin navaja en el cuello.",
      creado_en: iso(-30, 11, 30),
    },
    {
      id: "ficha-2",
      cliente_id: "cli-1",
      cliente_nombre: "Mariana Gutiérrez",
      barbero_id: "bar-1",
      servicio: "Retoque de fade",
      notas: "Fade bajo. Piel sensible: usar loción after-shave sin alcohol.",
      creado_en: iso(-14, 9, 30),
    },
  ];
}

function seedServicios(): ServicioDemo[] {
  return [
    { id: "srv-1", nombre: "Corte clásico", categoria: "Corte", precio: 250, duracion_min: 30, comision_pct: 45, activo: true },
    { id: "srv-2", nombre: "Fade de precisión", categoria: "Corte", precio: 320, duracion_min: 45, comision_pct: 50, activo: true },
    { id: "srv-3", nombre: "Diseño de barba", categoria: "Barba", precio: 180, duracion_min: 25, comision_pct: 45, activo: true },
    { id: "srv-4", nombre: "Afeitado con navaja y toalla caliente", categoria: "Ritual", precio: 300, duracion_min: 45, comision_pct: 55, activo: true },
    { id: "srv-5", nombre: "Corte infantil", categoria: "Corte", precio: 200, duracion_min: 30, comision_pct: 40, activo: true },
    { id: "srv-6", nombre: "Corte + barba (paquete)", categoria: "Paquete", precio: 400, duracion_min: 60, comision_pct: 50, activo: true },
    { id: "srv-7", nombre: "Camuflaje de canas", categoria: "Color", precio: 350, duracion_min: 40, comision_pct: 45, activo: false },
  ];
}

function seedProductos(): ProductoDemo[] {
  return [
    { id: "prd-1", nombre: "Pomada mate fijación fuerte", categoria: "Peinado", existencias: 18, minimo: 8, costo: 95, precio_venta: 240, unidad: "bote 100 g" },
    { id: "prd-2", nombre: "Aceite para barba", categoria: "Cuidado", existencias: 6, minimo: 10, costo: 110, precio_venta: 280, unidad: "frasco 30 ml" },
    { id: "prd-3", nombre: "Shampoo anticaspa profesional", categoria: "Cuidado", existencias: 12, minimo: 6, costo: 130, precio_venta: 310, unidad: "botella 500 ml" },
    { id: "prd-4", nombre: "Navajas desechables", categoria: "Consumible", existencias: 240, minimo: 100, costo: 3, precio_venta: 0, unidad: "pieza" },
    { id: "prd-5", nombre: "Loción after-shave sin alcohol", categoria: "Afeitado", existencias: 4, minimo: 8, costo: 120, precio_venta: 290, unidad: "frasco 120 ml" },
    { id: "prd-6", nombre: "Talco de barbería", categoria: "Consumible", existencias: 9, minimo: 4, costo: 45, precio_venta: 0, unidad: "bote 200 g" },
  ];
}

function seedGastos(): GastoDemo[] {
  return [
    { id: "gto-1", concepto: "Renta del local", categoria: "Renta", monto: 18000, fecha: iso(-20, 9) },
    { id: "gto-2", concepto: "Reposición de pomadas y aceites", categoria: "Insumos", monto: 4350, fecha: iso(-14, 12) },
    { id: "gto-3", concepto: "Campañas de Google Ads", categoria: "Publicidad", monto: 6200, fecha: iso(-10, 10) },
    { id: "gto-4", concepto: "Luz, agua e internet", categoria: "Servicios", monto: 2480, fecha: iso(-7, 11) },
    { id: "gto-5", concepto: "Lavandería de toallas", categoria: "Otros", monto: 890, fecha: iso(-3, 16) },
  ];
}

function horarioPorDefecto(): HorarioSemanal {
  const finde: DiaSemana[] = ["sab", "dom"];
  return DIAS_SEMANA.reduce((acc, d) => {
    acc[d.id] = { activo: !finde.includes(d.id), inicio: "09:00", fin: "14:00" };
    return acc;
  }, {} as HorarioSemanal);
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

function leerCitas(): CitaDemo[] {
  return leerJSON(KEY_CITAS, seedCitas);
}

function leerSesion(): SesionDemo | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(KEY_SESION);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SesionDemo;
  } catch {
    return null;
  }
}

function leerBarberos(): BarberoDemo[] {
  return leerJSON(KEY_BARBEROS, () => BARBEROS_DEMO);
}

function guardarBarberosLocal(lista: BarberoDemo[]) {
  window.localStorage.setItem(KEY_BARBEROS, JSON.stringify(lista));
}

function leerHorarios(): Record<string, HorarioSemanal> {
  return leerJSON(KEY_HORARIOS, () => ({}) as Record<string, HorarioSemanal>);
}

function guardarHorariosLocal(mapa: Record<string, HorarioSemanal>) {
  window.localStorage.setItem(KEY_HORARIOS, JSON.stringify(mapa));
}

function leerFichas(): FichaDemo[] {
  return leerJSON(KEY_FICHAS, seedFichas);
}

function guardarFichasLocal(lista: FichaDemo[]) {
  window.localStorage.setItem(KEY_FICHAS, JSON.stringify(lista));
}

function leerRecompensasConfig(): RecompensasConfig {
  return leerJSON(KEY_RECOMPENSAS, () => ({ citas_requeridas: 5, valor_descuento: 20 }));
}

function guardarRecompensasConfigLocal(cfg: RecompensasConfig) {
  window.localStorage.setItem(KEY_RECOMPENSAS, JSON.stringify(cfg));
}

function leerBarberiaConfig(): BarberiaConfig {
  return leerJSON(KEY_BARBERIA, () => ({
    nombre: "Barbería Partum",
    direccion: "Av. Reforma 123, Col. Juárez, CDMX",
    telefono: "+52 55 1234 5678",
  }));
}

function guardarBarberiaConfigLocal(cfg: BarberiaConfig) {
  window.localStorage.setItem(KEY_BARBERIA, JSON.stringify(cfg));
}

function leerCanjes(): Record<string, number> {
  return leerJSON(KEY_CANJES, () => ({}) as Record<string, number>);
}

function guardarCanjesLocal(mapa: Record<string, number>) {
  window.localStorage.setItem(KEY_CANJES, JSON.stringify(mapa));
}

function leerServicios(): ServicioDemo[] {
  return leerJSON(KEY_SERVICIOS, seedServicios);
}
function guardarServiciosLocal(lista: ServicioDemo[]) {
  window.localStorage.setItem(KEY_SERVICIOS, JSON.stringify(lista));
}

function leerProductos(): ProductoDemo[] {
  return leerJSON(KEY_PRODUCTOS, seedProductos);
}
function guardarProductosLocal(lista: ProductoDemo[]) {
  window.localStorage.setItem(KEY_PRODUCTOS, JSON.stringify(lista));
}

function leerGastos(): GastoDemo[] {
  return leerJSON(KEY_GASTOS, seedGastos);
}
function guardarGastosLocal(lista: GastoDemo[]) {
  window.localStorage.setItem(KEY_GASTOS, JSON.stringify(lista));
}

// Hook principal: estado reactivo + mutadores persistentes.
export function useDemoStore() {
  const [listo, setListo] = useState(false);
  const [citas, setCitas] = useState<CitaDemo[]>([]);
  const [sesion, setSesion] = useState<SesionDemo | null>(null);
  const [barberos, setBarberos] = useState<BarberoDemo[]>([]);
  const [horarios, setHorarios] = useState<Record<string, HorarioSemanal>>({});
  const [fichas, setFichas] = useState<FichaDemo[]>([]);
  const [recompensasConfig, setRecompensasConfig] = useState<RecompensasConfig>({
    citas_requeridas: 5,
    valor_descuento: 20,
  });
  const [barberiaConfig, setBarberiaConfig] = useState<BarberiaConfig>({
    nombre: "Barbería Partum",
    direccion: "",
    telefono: "",
  });
  const [canjes, setCanjes] = useState<Record<string, number>>({});
  const [servicios, setServicios] = useState<ServicioDemo[]>([]);
  const [productos, setProductos] = useState<ProductoDemo[]>([]);
  const [gastos, setGastos] = useState<GastoDemo[]>([]);

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
    setListo(true);
  }, []);

  // Sesión real: si hay Supabase configurado, manda sobre la sesión local.
  // El import es dinámico para que el mapeo de roles no entre en el bundle de
  // quien sólo usa el modo demostración.
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

  const guardar = useCallback((nuevas: CitaDemo[]) => {
    setCitas(nuevas);
    window.localStorage.setItem(KEY_CITAS, JSON.stringify(nuevas));
  }, []);

  const login = useCallback((rol: RolDemo) => {
    const s = CUENTAS_DEMO[rol];
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
    }) => {
      const barbero = leerBarberos().find((m) => m.id === datos.barbero_id);
      const cliente = leerSesion() ?? CUENTAS_DEMO.cliente;
      const nueva: CitaDemo = {
        id: `c-${crypto.randomUUID().slice(0, 8)}`,
        cliente_id: cliente.rol === "cliente" ? cliente.id : CUENTAS_DEMO.cliente.id,
        cliente_nombre:
          cliente.rol === "cliente" ? cliente.nombre : CUENTAS_DEMO.cliente.nombre,
        barbero_id: datos.barbero_id,
        barbero_nombre: barbero?.nombre ?? "Barbero",
        especialidad: barbero?.especialidad ?? "",
        inicio: datos.inicio,
        fin: datos.fin,
        modalidad: datos.modalidad,
        estado: "confirmada",
        precio: barbero?.precio_servicio ?? 0,
        direccion_domicilio:
          datos.modalidad === "domicilio" ? "Domicilio del cliente" : null,
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

  const agregarBarbero = useCallback((datos: Omit<BarberoDemo, "id" | "activo">) => {
    const nuevo: BarberoDemo = {
      id: `bar-${crypto.randomUUID().slice(0, 8)}`,
      activo: true,
      ...datos,
    };
    const lista = [...leerBarberos(), nuevo];
    guardarBarberosLocal(lista);
    setBarberos(lista);
    return nuevo;
  }, []);

  const actualizarBarbero = useCallback((id: string, cambios: Partial<BarberoDemo>) => {
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
      const nuevo: FichaDemo = {
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
  const agregarServicio = useCallback((datos: Omit<ServicioDemo, "id" | "activo">) => {
    const nuevo: ServicioDemo = { id: `srv-${crypto.randomUUID().slice(0, 8)}`, activo: true, ...datos };
    const lista = [...leerServicios(), nuevo];
    guardarServiciosLocal(lista);
    setServicios(lista);
    return nuevo;
  }, []);

  const actualizarServicio = useCallback((id: string, cambios: Partial<ServicioDemo>) => {
    const lista = leerServicios().map((s) => (s.id === id ? { ...s, ...cambios } : s));
    guardarServiciosLocal(lista);
    setServicios(lista);
  }, []);

  // --- Inventario ---
  const agregarProducto = useCallback((datos: Omit<ProductoDemo, "id">) => {
    const nuevo: ProductoDemo = { id: `prd-${crypto.randomUUID().slice(0, 8)}`, ...datos };
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
  const agregarGasto = useCallback((datos: Omit<GastoDemo, "id" | "fecha"> & { fecha?: string }) => {
    const nuevo: GastoDemo = {
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

  const reiniciarDemo = useCallback(() => {
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
    login,
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
    reiniciarDemo,
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
export function resumirClientes(citas: CitaDemo[]): ClienteResumen[] {
  const ahora = Date.now();
  const porCliente = new Map<string, CitaDemo[]>();

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

// Lealtad: 1 punto por cita asistida; cada N puntos (config de la barbería,
// 5 por defecto) se gana una recompensa.
export function calcularLealtad(citas: CitaDemo[], clienteId: string, citasRequeridas = 5) {
  const requerido = citasRequeridas > 0 ? citasRequeridas : 5;
  const puntos = citas.filter(
    (c) => c.cliente_id === clienteId && c.estado === "asistida"
  ).length;
  return {
    puntos,
    progreso: puntos % requerido,
    recompensasGanadas: Math.floor(puntos / requerido),
    faltan: requerido - (puntos % requerido),
    requerido,
  };
}
