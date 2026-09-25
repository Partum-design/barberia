import { fechaISO, tokenDeCuentaDeServicio } from "./google-auth";
import { analyticsDemo } from "./demo";
import { ratio, type ResumenAnalytics } from "./tipos";

// ---------------------------------------------------------------------------
// Google Analytics 4 — Data API v1 (`batchRunReports`).
//
// Los cuatro informes que necesita el panel van en una sola llamada por lotes:
// una petición HTTP en vez de cuatro, con el mismo rango de fechas garantizado
// para todos (si se pidieran por separado, un cambio de día a medianoche
// dejaría los bloques descuadrados entre sí).
// ---------------------------------------------------------------------------

const SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const DIAS = 28;

type FilaGA = { dimensionValues?: { value: string }[]; metricValues?: { value: string }[] };
type InformeGA = { rows?: FilaGA[]; totals?: FilaGA[] };

const num = (v?: string) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function analyticsConfigurado() {
  return Boolean(
    process.env.GA4_PROPERTY_ID &&
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  );
}

export async function obtenerAnalytics(): Promise<ResumenAnalytics> {
  if (!analyticsConfigurado()) {
    return analyticsDemo(
      "Sin credenciales de Google Analytics. Define GA4_PROPERTY_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL y GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY para ver datos reales."
    );
  }

  try {
    const token = await tokenDeCuentaDeServicio(
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!,
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY!,
      SCOPE
    );

    const propiedad = `properties/${process.env.GA4_PROPERTY_ID}`;
    const dateRanges = [{ startDate: `${DIAS - 1}daysAgo`, endDate: "today" }];

    const res = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/${propiedad}:batchRunReports`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
        next: { revalidate: 0 },
        body: JSON.stringify({
          requests: [
            // 0 · serie diaria + totales
            {
              dateRanges,
              dimensions: [{ name: "date" }],
              metrics: [
                { name: "activeUsers" },
                { name: "sessions" },
                { name: "newUsers" },
                { name: "screenPageViews" },
                { name: "averageSessionDuration" },
                { name: "engagementRate" },
                { name: "conversions" },
              ],
              orderBys: [{ dimension: { dimensionName: "date" } }],
              limit: 60,
            },
            // 1 · canales de adquisición
            {
              dateRanges,
              dimensions: [{ name: "sessionDefaultChannelGroup" }],
              metrics: [{ name: "sessions" }, { name: "conversions" }],
              orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
              limit: 8,
            },
            // 2 · páginas más vistas
            {
              dateRanges,
              dimensions: [{ name: "pagePath" }],
              metrics: [{ name: "screenPageViews" }, { name: "averageSessionDuration" }],
              orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
              limit: 8,
            },
            // 3 · dispositivos
            {
              dateRanges,
              dimensions: [{ name: "deviceCategory" }],
              metrics: [{ name: "sessions" }],
              orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
              limit: 5,
            },
          ],
        }),
      }
    );

    if (!res.ok) throw new Error(`GA4 respondió ${res.status}: ${await res.text()}`);

    const { reports } = (await res.json()) as { reports: InformeGA[] };
    const [diario, canales, paginas, dispositivos] = reports;

    const filas = diario.rows ?? [];
    const total = diario.totals?.[0]?.metricValues ?? [];

    const serie = filas.map((f) => {
      const bruta = f.dimensionValues?.[0]?.value ?? "";
      return {
        // GA4 devuelve la fecha como YYYYMMDD sin separadores.
        fecha: `${bruta.slice(0, 4)}-${bruta.slice(4, 6)}-${bruta.slice(6, 8)}`,
        usuarios: num(f.metricValues?.[0]?.value),
        sesiones: num(f.metricValues?.[1]?.value),
      };
    });

    const sesionesTotales = num(total[1]?.value);

    return {
      origen: "vivo",
      rango: { desde: fechaISO(-(DIAS - 1)), hasta: fechaISO(0) },
      usuariosActivos: num(total[0]?.value),
      sesiones: sesionesTotales,
      usuariosNuevos: num(total[2]?.value),
      vistas: num(total[3]?.value),
      duracionMediaSeg: Math.round(num(total[4]?.value)),
      tasaInteraccion: num(total[5]?.value),
      conversiones: num(total[6]?.value),
      serie,
      canales: (canales.rows ?? []).map((f) => ({
        nombre: f.dimensionValues?.[0]?.value ?? "Sin asignar",
        sesiones: num(f.metricValues?.[0]?.value),
        conversiones: num(f.metricValues?.[1]?.value),
      })),
      paginas: (paginas.rows ?? []).map((f) => ({
        ruta: f.dimensionValues?.[0]?.value ?? "/",
        vistas: num(f.metricValues?.[0]?.value),
        duracionMediaSeg: Math.round(num(f.metricValues?.[1]?.value)),
      })),
      dispositivos: (dispositivos.rows ?? []).map((f) => ({
        nombre: f.dimensionValues?.[0]?.value ?? "otro",
        sesiones: num(f.metricValues?.[0]?.value),
      })),
    };
  } catch (error) {
    // Una credencial caducada no debe tumbar el panel entero: se cae al juego
    // de demostración y se dice en pantalla exactamente qué pasó.
    return analyticsDemo(
      `No se pudo leer Google Analytics: ${error instanceof Error ? error.message : "error desconocido"}`
    );
  }
}

/** Reexportado para que el panel pueda calcular proporciones sin importar tipos. */
export { ratio };
