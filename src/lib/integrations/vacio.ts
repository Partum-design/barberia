import { fechaISO } from "./google-auth";
import type { ResumenAds, ResumenAnalytics } from "./tipos";

// ---------------------------------------------------------------------------
// Respuesta vacía para cuando una integración aún no está conectada.
//
// El panel no inventa cifras: mientras GA4 o Google Ads no tengan
// credenciales, las gráficas se dibujan en cero sobre el mismo rango de fechas
// y la nota de origen explica qué falta configurar.
// ---------------------------------------------------------------------------

const DIAS = 28;

function rango() {
  return { desde: fechaISO(-(DIAS - 1)), hasta: fechaISO(0) };
}

function fechas() {
  return Array.from({ length: DIAS }, (_, i) => fechaISO(-(DIAS - 1 - i)));
}

export function analyticsVacio(aviso?: string): ResumenAnalytics {
  return {
    origen: "sin_conexion",
    aviso,
    rango: rango(),
    usuariosActivos: 0,
    usuariosNuevos: 0,
    sesiones: 0,
    vistas: 0,
    duracionMediaSeg: 0,
    tasaInteraccion: 0,
    conversiones: 0,
    serie: fechas().map((fecha) => ({ fecha, usuarios: 0, sesiones: 0 })),
    canales: [],
    paginas: [],
    dispositivos: [],
  };
}

export function adsVacio(aviso?: string): ResumenAds {
  return {
    origen: "sin_conexion",
    aviso,
    rango: rango(),
    moneda: "MXN",
    impresiones: 0,
    clics: 0,
    costo: 0,
    conversiones: 0,
    ctr: 0,
    cpc: 0,
    cpa: 0,
    valorConversion: 0,
    roas: 0,
    serie: fechas().map((fecha) => ({ fecha, costo: 0, clics: 0, conversiones: 0 })),
    campanas: [],
    terminos: [],
  };
}
