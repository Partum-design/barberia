import type { Barbero, BarberiaConfig, BloqueHorario, Cita, DiaSemana, HorarioSemanal } from "@/lib/datos/modelo";

// ============================================================================
// Disponibilidad para reservar.
//
// Un horario se ofrece sólo si hay personal: el barbero está activo, ese día
// trabaja y la hora cae dentro de su bloque y —si el local tiene horario
// publicado— también dentro del horario del local. Se descartan las horas
// que ya tienen cita.
//
// Las horas ("09:00") son hora del negocio, no del navegador ni del servidor
// (Vercel corre en UTC), así que todo se calcula en ZONA_HORARIA.
// ============================================================================

export const ZONA_HORARIA = process.env.NEXT_PUBLIC_ZONA_HORARIA || "America/Mexico_City";

// getDay(): 0 = domingo.
const DIA_POR_INDICE: DiaSemana[] = ["dom", "lun", "mar", "mie", "jue", "vie", "sab"];

const formato = new Intl.DateTimeFormat("en-US", {
  timeZone: ZONA_HORARIA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  weekday: "short",
});

const SEMANA_EN: Record<string, DiaSemana> = {
  Sun: "dom",
  Mon: "lun",
  Tue: "mar",
  Wed: "mie",
  Thu: "jue",
  Fri: "vie",
  Sat: "sab",
};

/** Fecha, hora y día de la semana de un instante, en la zona del negocio. */
export function enZona(t: number) {
  const p = Object.fromEntries(formato.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  return {
    anio: Number(p.year),
    mes: Number(p.month),
    dia: Number(p.day),
    minutos: Number(p.hour) * 60 + Number(p.minute),
    diaSemana: SEMANA_EN[p.weekday] ?? DIA_POR_INDICE[new Date(t).getUTCDay()],
  };
}

/** Diferencia (ms) entre la hora de pared de la zona y UTC en ese instante. */
function desfase(t: number) {
  const z = enZona(t);
  const pared = Date.UTC(z.anio, z.mes - 1, z.dia, Math.floor(z.minutos / 60), z.minutos % 60);
  return pared - Math.floor(t / 60_000) * 60_000;
}

/** Instante UTC que corresponde a una fecha y hora de pared en la zona. */
function instante(anio: number, mes: number, dia: number, minutos: number) {
  const pared = Date.UTC(anio, mes - 1, dia, Math.floor(minutos / 60), minutos % 60);
  const t = pared - desfase(pared);
  // Segunda pasada por si el desfase cambia justo en esa fecha (horario de verano).
  return pared - desfase(t);
}

const aMinutos = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** ¿El local publicó algún día abierto? Si no, sólo manda el horario de cada barbero. */
export function localTieneHorario(barberia: Pick<BarberiaConfig, "horario">) {
  return Object.values(barberia.horario ?? {}).some((b) => b?.activo);
}

/** Ventana [inicio, fin) en minutos del día en que el barbero atiende. */
function ventana(
  bloqueBarbero: BloqueHorario | undefined,
  barberia: Pick<BarberiaConfig, "horario">,
  dia: DiaSemana
): [number, number] | null {
  if (!bloqueBarbero?.activo) return null;
  let a = aMinutos(bloqueBarbero.inicio);
  let b = aMinutos(bloqueBarbero.fin);
  if (localTieneHorario(barberia)) {
    const local = barberia.horario[dia];
    if (!local?.activo) return null;
    a = Math.max(a, aMinutos(local.inicio));
    b = Math.min(b, aMinutos(local.fin));
  }
  return a < b ? [a, b] : null;
}

export type Contexto = {
  barbero: Pick<Barbero, "id" | "activo" | "duracion_cita_min">;
  horario: HorarioSemanal;
  barberia: Pick<BarberiaConfig, "horario">;
  citas: Pick<Cita, "barbero_id" | "estado" | "inicio" | "fin">[];
};

function ocupado(ctx: Contexto, inicio: number, fin: number) {
  return ctx.citas.some(
    (c) =>
      c.barbero_id === ctx.barbero.id &&
      c.estado !== "cancelada" &&
      inicio < new Date(c.fin).getTime() &&
      fin > new Date(c.inicio).getTime()
  );
}

/** Horarios libres del barbero en los próximos `dias` días. */
export function slotsDisponibles(ctx: Contexto, ahora = Date.now(), dias = 7): Date[] {
  if (!ctx.barbero.activo) return [];
  const duracion = Math.max(5, ctx.barbero.duracion_cita_min) * 60_000;
  const out: Date[] = [];

  for (let d = 0; d < dias; d++) {
    const z = enZona(ahora + d * 86_400_000);
    const v = ventana(ctx.horario[z.diaSemana], ctx.barberia, z.diaSemana);
    if (!v) continue;
    const inicioDia = instante(z.anio, z.mes, z.dia, v[0]);
    const finDia = instante(z.anio, z.mes, z.dia, v[1]);
    for (let t = inicioDia; t + duracion <= finDia; t += duracion) {
      if (t <= ahora) continue;
      if (!ocupado(ctx, t, t + duracion)) out.push(new Date(t));
    }
  }
  return out;
}

/** Validación del servidor: la hora pedida cae en horario con personal y está libre. */
export function horarioReservable(ctx: Contexto, inicio: number, ahora = Date.now()) {
  if (!ctx.barbero.activo) return "El barbero no está disponible.";
  if (inicio < ahora - 5 * 60_000) return "Ese horario ya pasó.";
  const fin = inicio + Math.max(5, ctx.barbero.duracion_cita_min) * 60_000;
  const z = enZona(inicio);
  const v = ventana(ctx.horario[z.diaSemana], ctx.barberia, z.diaSemana);
  const minutosFin = z.minutos + (fin - inicio) / 60_000;
  if (!v || z.minutos < v[0] || minutosFin > v[1]) return "Ese horario está fuera de la disponibilidad del barbero.";
  if (ocupado(ctx, inicio, fin)) return "Ese horario acaba de ocuparse. Elige otro.";
  return null;
}

/**
 * Horario que se publica en la portada: por cada día, desde que entra el
 * primer barbero activo hasta que sale el último (acotado al horario del
 * local). Un día sin nadie trabajando aparece cerrado aunque el local abra.
 */
export function horarioConPersonal(
  barberia: Pick<BarberiaConfig, "horario">,
  barberos: Pick<Barbero, "id" | "activo">[],
  horarioDe: (barberoId: string) => HorarioSemanal
): HorarioSemanal {
  const resultado = {} as HorarioSemanal;
  for (const dia of ["lun", "mar", "mie", "jue", "vie", "sab", "dom"] as DiaSemana[]) {
    let a = Infinity;
    let b = -Infinity;
    for (const barbero of barberos) {
      if (!barbero.activo) continue;
      const v = ventana(horarioDe(barbero.id)[dia], barberia, dia);
      if (!v) continue;
      a = Math.min(a, v[0]);
      b = Math.max(b, v[1]);
    }
    const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    resultado[dia] =
      a < b ? { activo: true, inicio: hhmm(a), fin: hhmm(b) } : { activo: false, inicio: "10:00", fin: "20:00" };
  }
  return resultado;
}
