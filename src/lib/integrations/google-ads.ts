import { fechaISO, tokenDeRefresco } from "./google-auth";
import { adsDemo } from "./demo";
import { ratio, type Campana, type EstadoCampana, type ResumenAds } from "./tipos";

// ---------------------------------------------------------------------------
// Google Ads API — `googleAds:searchStream` con GAQL.
//
// `searchStream` devuelve un array de fragmentos, cada uno con su propio bloque
// `results`; hay que aplanarlos antes de agregar. Los importes vienen en micros
// (1 000 000 = 1 unidad de la moneda de la cuenta), por eso todo pasa por
// `deMicros`.
// ---------------------------------------------------------------------------

const VERSION = process.env.GOOGLE_ADS_API_VERSION ?? "v24";
const DIAS = 28;

const deMicros = (valor: unknown) => Number(valor ?? 0) / 1_000_000;
const entero = (valor: unknown) => Number(valor ?? 0);

const ESTADOS: Record<string, EstadoCampana> = {
  ENABLED: "activa",
  PAUSED: "pausada",
  REMOVED: "finalizada",
};

const CANALES: Record<string, string> = {
  SEARCH: "Búsqueda",
  DISPLAY: "Display",
  SHOPPING: "Shopping",
  VIDEO: "Vídeo",
  PERFORMANCE_MAX: "Máximo rendimiento",
  LOCAL_SERVICES: "Servicios locales",
  DEMAND_GEN: "Demand Gen",
};

export function adsConfigurado() {
  return Boolean(
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN &&
      process.env.GOOGLE_ADS_CUSTOMER_ID &&
      process.env.GOOGLE_ADS_CLIENT_ID &&
      process.env.GOOGLE_ADS_CLIENT_SECRET &&
      process.env.GOOGLE_ADS_REFRESH_TOKEN
  );
}

type FilaAds = Record<string, Record<string, unknown>>;

async function consultar(query: string, token: string, customerId: string): Promise<FilaAds[]> {
  const cabeceras: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
    "Content-Type": "application/json",
  };
  // Obligatoria cuando se consulta una cuenta gestionada desde una MCC.
  if (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID) {
    cabeceras["login-customer-id"] = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID.replace(/-/g, "");
  }

  const res = await fetch(
    `https://googleads.googleapis.com/${VERSION}/customers/${customerId}/googleAds:searchStream`,
    { method: "POST", headers: cabeceras, body: JSON.stringify({ query }), cache: "no-store" }
  );

  if (!res.ok) throw new Error(`Google Ads respondió ${res.status}: ${await res.text()}`);

  const fragmentos = (await res.json()) as { results?: FilaAds[] }[];
  return fragmentos.flatMap((f) => f.results ?? []);
}

export async function obtenerAds(): Promise<ResumenAds> {
  if (!adsConfigurado()) {
    return adsDemo(
      "Sin credenciales de Google Ads. Define GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_ADS_CUSTOMER_ID y las de OAuth para ver campañas reales."
    );
  }

  const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID!.replace(/-/g, "");
  const durante = `segments.date DURING LAST_${DIAS}_DAYS`;

  try {
    const token = await tokenDeRefresco(
      process.env.GOOGLE_ADS_CLIENT_ID!,
      process.env.GOOGLE_ADS_CLIENT_SECRET!,
      process.env.GOOGLE_ADS_REFRESH_TOKEN!
    );

    const [filasCampana, filasDia, filasTermino] = await Promise.all([
      consultar(
        `SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type,
                campaign_budget.amount_micros, metrics.impressions, metrics.clicks,
                metrics.cost_micros, metrics.conversions, metrics.conversions_value
         FROM campaign
         WHERE ${durante} AND campaign.status != 'REMOVED'
         ORDER BY metrics.cost_micros DESC`,
        token,
        customerId
      ),
      consultar(
        `SELECT segments.date, metrics.cost_micros, metrics.clicks, metrics.conversions
         FROM customer
         WHERE ${durante}
         ORDER BY segments.date`,
        token,
        customerId
      ),
      consultar(
        `SELECT search_term_view.search_term, metrics.clicks, metrics.cost_micros, metrics.conversions
         FROM search_term_view
         WHERE ${durante}
         ORDER BY metrics.clicks DESC
         LIMIT 8`,
        token,
        customerId
      ).catch(() => [] as FilaAds[]), // La vista de términos no existe en todas las cuentas.
    ]);

    const campanas: Campana[] = filasCampana.map((f) => {
      const impresiones = entero(f.metrics?.impressions);
      const clics = entero(f.metrics?.clicks);
      const costo = deMicros(f.metrics?.costMicros);
      const conversiones = Number(f.metrics?.conversions ?? 0);
      return {
        id: String(f.campaign?.id ?? ""),
        nombre: String(f.campaign?.name ?? "Campaña"),
        estado: ESTADOS[String(f.campaign?.status ?? "")] ?? "finalizada",
        canal: CANALES[String(f.campaign?.advertisingChannelType ?? "")] ?? "Otro",
        impresiones,
        clics,
        costo,
        conversiones,
        ctr: ratio(clics, impresiones),
        cpc: ratio(costo, clics),
        cpa: ratio(costo, conversiones),
        presupuestoDiario: deMicros(f.campaignBudget?.amountMicros),
      };
    });

    const serie = filasDia.map((f) => ({
      fecha: String(f.segments?.date ?? ""),
      costo: deMicros(f.metrics?.costMicros),
      clics: entero(f.metrics?.clicks),
      conversiones: Number(f.metrics?.conversions ?? 0),
    }));

    const suma = (clave: keyof Campana) =>
      campanas.reduce((acc, c) => acc + (c[clave] as number), 0);

    const impresiones = suma("impresiones");
    const clics = suma("clics");
    const costo = suma("costo");
    const conversiones = suma("conversiones");
    const valorConversion = filasCampana.reduce(
      (acc, f) => acc + Number(f.metrics?.conversionsValue ?? 0),
      0
    );

    return {
      origen: "vivo",
      rango: { desde: fechaISO(-(DIAS - 1)), hasta: fechaISO(0) },
      moneda: process.env.GOOGLE_ADS_CURRENCY ?? "MXN",
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
      terminos: filasTermino.map((f) => ({
        termino: String(f.searchTermView?.searchTerm ?? ""),
        clics: entero(f.metrics?.clicks),
        costo: deMicros(f.metrics?.costMicros),
        conversiones: Number(f.metrics?.conversions ?? 0),
      })),
    };
  } catch (error) {
    return adsDemo(
      `No se pudo leer Google Ads: ${error instanceof Error ? error.message : "error desconocido"}`
    );
  }
}
