import { fechaISO } from "./google-auth";
import { ratio, type ResumenAds, type ResumenAnalytics } from "./tipos";

// ---------------------------------------------------------------------------
// Juego de datos de demostración.
//
// Es determinista: la semilla sale de la fecha, así que las cifras no bailan
// entre recargas ni entre el servidor y el cliente. Las magnitudes están
// calibradas para una barbería urbana de tres sillones, no son ruido: el
// panel tiene que poder leerse y discutirse aunque todavía no haya cuentas
// conectadas.
// ---------------------------------------------------------------------------

function aleatorio(semilla: number) {
  let s = semilla % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function semillaDelDia() {
  const hoy = new Date();
  return hoy.getUTCFullYear() * 10000 + (hoy.getUTCMonth() + 1) * 100 + hoy.getUTCDate();
}

const DIAS = 28;

export function analyticsDemo(aviso?: string): ResumenAnalytics {
  const rnd = aleatorio(semillaDelDia());
  const serie: ResumenAnalytics["serie"] = [];

  let usuarios = 0;
  let sesiones = 0;

  for (let i = DIAS - 1; i >= 0; i--) {
    const fecha = fechaISO(-i);
    const diaSemana = new Date(`${fecha}T00:00:00Z`).getUTCDay();
    // Viernes y sábado son los días fuertes de una barbería.
    const factorDia = diaSemana === 5 ? 1.45 : diaSemana === 6 ? 1.6 : diaSemana === 0 ? 0.55 : 1;
    const base = 118 * factorDia;
    const u = Math.round(base * (0.86 + rnd() * 0.3));
    const s = Math.round(u * (1.24 + rnd() * 0.14));
    usuarios += u;
    sesiones += s;
    serie.push({ fecha, usuarios: u, sesiones: s });
  }

  const vistas = Math.round(sesiones * 2.7);
  const conversiones = Math.round(sesiones * 0.061);

  return {
    origen: "demostracion",
    aviso,
    rango: { desde: fechaISO(-(DIAS - 1)), hasta: fechaISO(0) },
    usuariosActivos: usuarios,
    usuariosNuevos: Math.round(usuarios * 0.63),
    sesiones,
    vistas,
    duracionMediaSeg: 106,
    tasaInteraccion: 0.671,
    conversiones,
    serie,
    canales: [
      { nombre: "Búsqueda de pago", sesiones: Math.round(sesiones * 0.34), conversiones: Math.round(conversiones * 0.41) },
      { nombre: "Búsqueda orgánica", sesiones: Math.round(sesiones * 0.26), conversiones: Math.round(conversiones * 0.24) },
      { nombre: "Directo", sesiones: Math.round(sesiones * 0.17), conversiones: Math.round(conversiones * 0.16) },
      { nombre: "Redes sociales", sesiones: Math.round(sesiones * 0.14), conversiones: Math.round(conversiones * 0.11) },
      { nombre: "Referencia", sesiones: Math.round(sesiones * 0.09), conversiones: Math.round(conversiones * 0.08) },
    ],
    paginas: [
      { ruta: "/", vistas: Math.round(vistas * 0.38), duracionMediaSeg: 74 },
      { ruta: "/reservar", vistas: Math.round(vistas * 0.27), duracionMediaSeg: 168 },
      { ruta: "/#precios", vistas: Math.round(vistas * 0.14), duracionMediaSeg: 92 },
      { ruta: "/#barberos", vistas: Math.round(vistas * 0.11), duracionMediaSeg: 88 },
      { ruta: "/login", vistas: Math.round(vistas * 0.1), duracionMediaSeg: 41 },
    ],
    dispositivos: [
      { nombre: "Móvil", sesiones: Math.round(sesiones * 0.74) },
      { nombre: "Escritorio", sesiones: Math.round(sesiones * 0.21) },
      { nombre: "Tableta", sesiones: Math.round(sesiones * 0.05) },
    ],
  };
}

const CAMPANAS_BASE = [
  { id: "22014785", nombre: "Barbería CDMX · Búsqueda de marca", estado: "activa" as const, canal: "Búsqueda", peso: 0.3, presupuesto: 180 },
  { id: "22014786", nombre: "Corte y barba · Genérica local", estado: "activa" as const, canal: "Búsqueda", peso: 0.34, presupuesto: 260 },
  { id: "22014787", nombre: "Máximo rendimiento · Reservas", estado: "activa" as const, canal: "Máximo rendimiento", peso: 0.24, presupuesto: 220 },
  { id: "22014788", nombre: "Remarketing · Carrito de reserva", estado: "pausada" as const, canal: "Display", peso: 0.12, presupuesto: 90 },
];

export function adsDemo(aviso?: string): ResumenAds {
  const rnd = aleatorio(semillaDelDia() + 7);
  const serie: ResumenAds["serie"] = [];

  let costo = 0;
  let clics = 0;
  let conversiones = 0;

  for (let i = DIAS - 1; i >= 0; i--) {
    const fecha = fechaISO(-i);
    const diaSemana = new Date(`${fecha}T00:00:00Z`).getUTCDay();
    const factorDia = diaSemana === 5 ? 1.35 : diaSemana === 6 ? 1.5 : diaSemana === 0 ? 0.6 : 1;
    const c = Math.round(620 * factorDia * (0.88 + rnd() * 0.26));
    const k = Math.round(c / (13 + rnd() * 4));
    const cv = Math.round(k * (0.085 + rnd() * 0.05));
    costo += c;
    clics += k;
    conversiones += cv;
    serie.push({ fecha, costo: c, clics: k, conversiones: cv });
  }

  const impresiones = Math.round(clics * 17.4);
  const valorConversion = Math.round(conversiones * 312);

  const campanas = CAMPANAS_BASE.map((c) => {
    const cImp = Math.round(impresiones * c.peso);
    const cClics = Math.round(clics * c.peso * (c.canal === "Display" ? 1.5 : 0.95));
    const cCosto = Math.round(costo * c.peso);
    const cConv = Math.round(conversiones * c.peso * (c.canal === "Display" ? 0.5 : 1.06));
    return {
      id: c.id,
      nombre: c.nombre,
      estado: c.estado,
      canal: c.canal,
      impresiones: cImp,
      clics: cClics,
      costo: cCosto,
      conversiones: cConv,
      ctr: ratio(cClics, cImp),
      cpc: ratio(cCosto, cClics),
      cpa: ratio(cCosto, cConv),
      presupuestoDiario: c.presupuesto,
    };
  });

  return {
    origen: "demostracion",
    aviso,
    rango: { desde: fechaISO(-(DIAS - 1)), hasta: fechaISO(0) },
    moneda: "MXN",
    impresiones,
    clics,
    costo,
    conversiones,
    ctr: ratio(clics, impresiones),
    cpc: ratio(costo, clics),
    cpa: ratio(costo, conversiones),
    valorConversion,
    roas: ratio(valorConversion, costo),
    serie,
    campanas,
    terminos: [
      { termino: "barbería cerca de mí", clics: Math.round(clics * 0.19), costo: Math.round(costo * 0.17), conversiones: Math.round(conversiones * 0.22) },
      { termino: "corte de cabello hombre cdmx", clics: Math.round(clics * 0.15), costo: Math.round(costo * 0.16), conversiones: Math.round(conversiones * 0.17) },
      { termino: "fade barbería", clics: Math.round(clics * 0.12), costo: Math.round(costo * 0.13), conversiones: Math.round(conversiones * 0.14) },
      { termino: "arreglo de barba", clics: Math.round(clics * 0.1), costo: Math.round(costo * 0.11), conversiones: Math.round(conversiones * 0.12) },
      { termino: "barbero a domicilio", clics: Math.round(clics * 0.08), costo: Math.round(costo * 0.1), conversiones: Math.round(conversiones * 0.11) },
    ],
  };
}
