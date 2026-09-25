// ---------------------------------------------------------------------------
// Contrato único de las integraciones de marketing.
//
// Tanto los adaptadores en vivo (GA4, Google Ads) como el juego de datos de
// demostración devuelven exactamente estas formas. La interfaz nunca sabe de
// dónde vienen los números: sólo lee `origen` para decir en pantalla si está
// mirando datos reales o una demostración.
// ---------------------------------------------------------------------------

export type OrigenDatos = "vivo" | "demostracion";

export type Rango = { desde: string; hasta: string };

export type PuntoAudiencia = { fecha: string; usuarios: number; sesiones: number };

export type ResumenAnalytics = {
  origen: OrigenDatos;
  rango: Rango;
  usuariosActivos: number;
  usuariosNuevos: number;
  sesiones: number;
  vistas: number;
  /** Duración media de sesión, en segundos */
  duracionMediaSeg: number;
  /** Proporción de sesiones con interacción, 0–1 */
  tasaInteraccion: number;
  conversiones: number;
  serie: PuntoAudiencia[];
  canales: { nombre: string; sesiones: number; conversiones: number }[];
  paginas: { ruta: string; vistas: number; duracionMediaSeg: number }[];
  dispositivos: { nombre: string; sesiones: number }[];
  /** Motivo por el que se está sirviendo la demostración, si aplica */
  aviso?: string;
};

export type EstadoCampana = "activa" | "pausada" | "finalizada";

export type Campana = {
  id: string;
  nombre: string;
  estado: EstadoCampana;
  canal: string;
  impresiones: number;
  clics: number;
  costo: number;
  conversiones: number;
  ctr: number;
  cpc: number;
  cpa: number;
  presupuestoDiario: number;
};

export type PuntoGasto = { fecha: string; costo: number; clics: number; conversiones: number };

export type ResumenAds = {
  origen: OrigenDatos;
  rango: Rango;
  moneda: string;
  impresiones: number;
  clics: number;
  costo: number;
  conversiones: number;
  ctr: number;
  cpc: number;
  cpa: number;
  valorConversion: number;
  roas: number;
  serie: PuntoGasto[];
  campanas: Campana[];
  terminos: { termino: string; clics: number; costo: number; conversiones: number }[];
  aviso?: string;
};

/** Divide protegiendo contra el cero, que es el caso normal cuando aún no hay datos. */
export function ratio(numerador: number, denominador: number) {
  return denominador > 0 ? numerador / denominador : 0;
}
