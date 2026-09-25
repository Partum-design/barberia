"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BadgeDollarSign,
  CalendarCheck,
  CreditCard,
  Eye,
  Loader2,
  MousePointerClick,
  Search,
  Target,
  Timer,
  TrendingUp,
  Users,
} from "lucide-react";
import { PanelShell } from "@/components/shell/PanelShell";
import {
  ChartTooltip,
  DataSourceNote,
  EmptyState,
  Metric,
  ModulePanel,
  ModuleTabs,
  ShareBar,
  SinAcceso,
  duracion,
  moneda,
  numero,
  porcentaje,
} from "@/components/panel/ModuleUI";
import { useDemoStore } from "@/lib/demo-store";
import type { ResumenAds, ResumenAnalytics } from "@/lib/integrations/tipos";

type Pestana = "audiencia" | "campanas" | "atribucion";

const ORO = "#e6c576";
const ORO_HONDO = "#b7924d";
const OXBLOOD = "#b0453a";
const VERDE = "#5cc08d";

/** Cifras compactas en los ejes: 12 400 → 12,4 k. Los números completos no
    caben en el canal del eje y se recortarían. */
const compacto = (valor: number) => {
  if (Math.abs(valor) >= 1000) return `${(valor / 1000).toFixed(1).replace(".", ",")} k`;
  return String(Math.round(valor));
};

const diaCorto = (iso: string) => {
  const limpia = iso.includes("-") ? iso : `${iso.slice(0, 4)}-${iso.slice(4, 6)}-${iso.slice(6, 8)}`;
  const d = new Date(`${limpia}T00:00:00Z`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", timeZone: "UTC" });
};

/**
 * Centro de marketing: audiencia (GA4), campañas (Google Ads) y la atribución
 * que une ambas con las citas reales de la barbería.
 *
 * Las dos fuentes se piden en paralelo a rutas de servidor; si alguna no tiene
 * credenciales, devuelve su juego de demostración marcado como tal y el panel
 * se ve exactamente igual. Nunca se queda en blanco.
 */
export default function MarketingPage() {
  const store = useDemoStore();
  const { listo, sesion, citas } = store;
  const [pestana, setPestana] = useState<Pestana>("audiencia");
  const [analytics, setAnalytics] = useState<ResumenAnalytics | null>(null);
  const [ads, setAds] = useState<ResumenAds | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vivo = true;
    Promise.all([
      fetch("/api/integrations/analytics").then((r) => r.json() as Promise<ResumenAnalytics>),
      fetch("/api/integrations/google-ads").then((r) => r.json() as Promise<ResumenAds>),
    ])
      .then(([a, g]) => {
        if (!vivo) return;
        setAnalytics(a);
        setAds(g);
      })
      .finally(() => vivo && setCargando(false));
    return () => {
      vivo = false;
    };
  }, []);

  // Ingresos reales de la barbería en el mismo periodo, para cruzarlos con el
  // gasto publicitario. Es lo que convierte el panel en algo accionable en vez
  // de un espejo de la consola de Google.
  const ingresos = useMemo(() => {
    const desde = Date.now() - 28 * 24 * 3600 * 1000;
    return citas
      .filter((c) => c.estado !== "cancelada" && new Date(c.inicio).getTime() >= desde)
      .reduce((acc, c) => acc + (c.estado_pago === "pagado" ? c.precio : 0), 0);
  }, [citas]);

  const citasPeriodo = useMemo(() => {
    const desde = Date.now() - 28 * 24 * 3600 * 1000;
    return citas.filter((c) => c.estado !== "cancelada" && new Date(c.inicio).getTime() >= desde);
  }, [citas]);

  if (!listo) return null;
  if (!sesion || sesion.rol !== "admin") return <SinAcceso mensaje="Este módulo es del administrador" />;

  return (
    <PanelShell sesion={sesion} activo="Marketing" onLogout={store.logout}>
      <header className="anim-in mb-6">
        <p className="kicker">Adquisición y campañas</p>
        <h1 className="font-display text-2xl font-bold tracking-tight">Marketing</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
          Google Analytics y Google Ads en un mismo lugar, cruzados con las citas y los cobros
          reales de la barbería.
        </p>
      </header>

      <ModuleTabs
        valor={pestana}
        onChange={setPestana}
        opciones={[
          { id: "audiencia", label: "Audiencia · GA4" },
          { id: "campanas", label: "Campañas · Google Ads" },
          { id: "atribucion", label: "Atribución" },
        ]}
      />

      {cargando && (
        <div className="module-panel flex items-center justify-center gap-2 py-10 text-sm" style={{ color: "var(--ink-muted)" }}>
          <Loader2 className="h-4 w-4 animate-spin" /> Consultando Google…
        </div>
      )}

      {!cargando && pestana === "audiencia" && analytics && <Audiencia datos={analytics} />}
      {!cargando && pestana === "campanas" && ads && <Campanas datos={ads} />}
      {!cargando && pestana === "atribucion" && analytics && ads && (
        <Atribucion
          analytics={analytics}
          ads={ads}
          citas={citasPeriodo.length}
          pagadas={citasPeriodo.filter((c) => c.estado_pago === "pagado").length}
          ingresos={ingresos}
        />
      )}
    </PanelShell>
  );
}

// --- Audiencia -------------------------------------------------------------

function Audiencia({ datos }: { datos: ResumenAnalytics }) {
  const serie = datos.serie.map((p) => ({ ...p, etiqueta: diaCorto(p.fecha) }));
  const maxCanal = Math.max(1, ...datos.canales.map((c) => c.sesiones));
  const totalDispositivos = Math.max(1, datos.dispositivos.reduce((a, d) => a + d.sesiones, 0));

  return (
    <div className="anim-in">
      <DataSourceNote origen={datos.origen} aviso={datos.aviso} />

      <div className="metric-grid">
        <Metric icono={<Users />} label="Usuarios activos" valor={numero.format(datos.usuariosActivos)} nota={`${numero.format(datos.usuariosNuevos)} nuevos`} />
        <Metric icono={<Eye />} label="Sesiones" valor={numero.format(datos.sesiones)} nota={`${numero.format(datos.vistas)} vistas de página`} />
        <Metric icono={<Timer />} label="Duración media" valor={duracion(datos.duracionMediaSeg)} nota={`${porcentaje(datos.tasaInteraccion)} con interacción`} />
        <Metric icono={<Target />} label="Conversiones" valor={numero.format(datos.conversiones)} nota={`${porcentaje(datos.conversiones / Math.max(1, datos.sesiones), 2)} de las sesiones`} />
      </div>

      <div className="module-split mt-3">
        <div>
          <ModulePanel titulo="Usuarios y sesiones" descripcion="Últimos 28 días">
            <div className="chart-frame">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={serie} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradUsuarios" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={ORO} stopOpacity={0.55} />
                      <stop offset="100%" stopColor={ORO} stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="gradSesiones" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={OXBLOOD} stopOpacity={0.4} />
                      <stop offset="100%" stopColor={OXBLOOD} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="etiqueta" tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={28} />
                  <YAxis tickLine={false} axisLine={false} width={46} tickFormatter={compacto} />
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: ORO, strokeOpacity: 0.25 }} />
                  <Area type="monotone" dataKey="sesiones" name="Sesiones" stroke={OXBLOOD} fill="url(#gradSesiones)" strokeWidth={1.6} />
                  <Area type="monotone" dataKey="usuarios" name="Usuarios" stroke={ORO} fill="url(#gradUsuarios)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </ModulePanel>

          <ModulePanel titulo="Páginas más vistas" descripcion="Dónde pasa el tiempo la gente antes de reservar">
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Ruta</th>
                    <th className="num">Vistas</th>
                    <th className="num">Tiempo medio</th>
                  </tr>
                </thead>
                <tbody>
                  {datos.paginas.map((p) => (
                    <tr key={p.ruta}>
                      <td className="strong">{p.ruta}</td>
                      <td className="num">{numero.format(p.vistas)}</td>
                      <td className="num muted">{duracion(p.duracionMediaSeg)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ModulePanel>
        </div>

        <div>
          <ModulePanel titulo="Canales de adquisición" descripcion="De dónde llega la gente">
            <div className="grid gap-3">
              {datos.canales.map((c) => (
                <div key={c.nombre}>
                  <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
                    <span style={{ color: "var(--ink)" }}>{c.nombre}</span>
                    <span className="font-num" style={{ color: "var(--ink-muted)" }}>
                      {numero.format(c.sesiones)}
                    </span>
                  </div>
                  <ShareBar valor={c.sesiones / maxCanal} />
                </div>
              ))}
            </div>
          </ModulePanel>

          <ModulePanel titulo="Dispositivos" descripcion="El móvil manda en barbería">
            <div className="grid gap-3">
              {datos.dispositivos.map((d) => (
                <div key={d.nombre}>
                  <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
                    <span style={{ color: "var(--ink)" }}>{d.nombre}</span>
                    <span className="font-num" style={{ color: "var(--ink-muted)" }}>
                      {porcentaje(d.sesiones / totalDispositivos, 0)}
                    </span>
                  </div>
                  <ShareBar valor={d.sesiones / totalDispositivos} tono="ox" />
                </div>
              ))}
            </div>
          </ModulePanel>
        </div>
      </div>
    </div>
  );
}

// --- Campañas --------------------------------------------------------------

function Campanas({ datos }: { datos: ResumenAds }) {
  const serie = datos.serie.map((p) => ({ ...p, etiqueta: diaCorto(p.fecha) }));

  return (
    <div className="anim-in">
      <DataSourceNote origen={datos.origen} aviso={datos.aviso} />

      <div className="metric-grid">
        <Metric icono={<BadgeDollarSign />} label="Inversión" valor={moneda.format(datos.costo)} nota={`CPC medio ${moneda.format(datos.cpc)}`} />
        <Metric icono={<MousePointerClick />} label="Clics" valor={numero.format(datos.clics)} nota={`CTR ${porcentaje(datos.ctr, 2)} sobre ${numero.format(datos.impresiones)} impresiones`} />
        <Metric icono={<Target />} label="Conversiones" valor={numero.format(Math.round(datos.conversiones))} nota={`CPA ${moneda.format(datos.cpa)}`} />
        <Metric icono={<TrendingUp />} label="ROAS" valor={`${datos.roas.toFixed(2).replace(".", ",")}×`} nota={`${moneda.format(datos.valorConversion)} en valor de conversión`} />
      </div>

      <ModulePanel titulo="Inversión y conversiones" descripcion="Últimos 28 días">
        <div className="chart-frame">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={serie} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="etiqueta" tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={28} />
              <YAxis yAxisId="izq" tickLine={false} axisLine={false} width={50} tickFormatter={compacto} />
              <YAxis yAxisId="der" orientation="right" tickLine={false} axisLine={false} width={34} tickFormatter={compacto} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(230,197,118,0.06)" }} />
              <Legend wrapperStyle={{ fontSize: "0.65rem", color: "var(--ink-muted)" }} />
              <Bar yAxisId="izq" dataKey="costo" name="Inversión" fill={ORO_HONDO} radius={[4, 4, 0, 0]} maxBarSize={16} />
              <Line yAxisId="der" type="monotone" dataKey="conversiones" name="Conversiones" stroke={VERDE} strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </ModulePanel>

      <ModulePanel titulo="Campañas" descripcion={`Moneda de la cuenta: ${datos.moneda}`}>
        {datos.campanas.length === 0 ? (
          <EmptyState icono={<Search />}>No hay campañas con actividad en el periodo.</EmptyState>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Campaña</th>
                  <th>Estado</th>
                  <th className="num">Impresiones</th>
                  <th className="num">Clics</th>
                  <th className="num">CTR</th>
                  <th className="num">Inversión</th>
                  <th className="num">Conv.</th>
                  <th className="num">CPA</th>
                </tr>
              </thead>
              <tbody>
                {datos.campanas.map((c) => (
                  <tr key={c.id}>
                    <td className="strong">
                      {c.nombre}
                      <span className="block text-[0.62rem]" style={{ color: "var(--ink-faint)" }}>
                        {c.canal} · {moneda.format(c.presupuestoDiario)}/día
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${c.estado === "activa" ? "badge-ok" : c.estado === "pausada" ? "badge-warm" : "badge-neutral"}`}>
                        {c.estado}
                      </span>
                    </td>
                    <td className="num">{numero.format(c.impresiones)}</td>
                    <td className="num">{numero.format(c.clics)}</td>
                    <td className="num muted">{porcentaje(c.ctr, 2)}</td>
                    <td className="num">{moneda.format(c.costo)}</td>
                    <td className="num">{numero.format(Math.round(c.conversiones))}</td>
                    <td className="num muted">{moneda.format(c.cpa)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ModulePanel>

      {datos.terminos.length > 0 && (
        <ModulePanel titulo="Términos de búsqueda" descripcion="Lo que la gente escribió antes de hacer clic">
          <div className="chart-frame" style={{ height: "13rem" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={datos.terminos} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 0 }}>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={compacto} />
                <YAxis type="category" dataKey="termino" width={148} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(230,197,118,0.06)" }} />
                <Bar dataKey="clics" name="Clics" radius={[0, 4, 4, 0]} maxBarSize={14}>
                  {datos.terminos.map((_, i) => (
                    <Cell key={i} fill={i === 0 ? ORO : ORO_HONDO} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ModulePanel>
      )}
    </div>
  );
}

// --- Atribución ------------------------------------------------------------

function Atribucion({
  analytics,
  ads,
  citas,
  pagadas,
  ingresos,
}: {
  analytics: ResumenAnalytics;
  ads: ResumenAds;
  citas: number;
  pagadas: number;
  ingresos: number;
}) {
  const pasos = [
    { icono: <Eye />, label: "Sesiones en el sitio", valor: analytics.sesiones },
    { icono: <MousePointerClick />, label: "Clics de campaña", valor: ads.clics },
    { icono: <CalendarCheck />, label: "Citas agendadas", valor: citas },
    { icono: <CreditCard />, label: "Citas cobradas", valor: pagadas },
  ];
  const tope = Math.max(1, ...pasos.map((p) => p.valor));

  const costoPorCita = citas > 0 ? ads.costo / citas : 0;
  const retorno = ads.costo > 0 ? ingresos / ads.costo : 0;
  const margen = ingresos - ads.costo;

  return (
    <div className="anim-in">
      <p className="data-source-note">
        <TrendingUp />
        <span>
          <b>Cruce de fuentes.</b> El tráfico y el gasto vienen de Google; las citas y los cobros
          salen de la operación real de la barbería. Es la única vista donde se ve si la
          publicidad está pagando el sillón.
        </span>
      </p>

      <div className="metric-grid">
        <Metric icono={<BadgeDollarSign />} label="Inversión publicitaria" valor={moneda.format(ads.costo)} nota="Últimos 28 días" />
        <Metric icono={<CreditCard />} label="Ingresos cobrados" valor={moneda.format(ingresos)} nota={`${pagadas} citas pagadas`} />
        <Metric icono={<Target />} label="Costo por cita" valor={costoPorCita > 0 ? moneda.format(costoPorCita) : "—"} nota={`${citas} citas en el periodo`} />
        <Metric
          icono={<TrendingUp />}
          label="Retorno sobre inversión"
          valor={`${retorno.toFixed(2).replace(".", ",")}×`}
          nota={`${margen >= 0 ? "Margen" : "Pérdida"} de ${moneda.format(Math.abs(margen))}`}
        />
      </div>

      <ModulePanel titulo="Del clic al sillón" descripcion="Embudo completo, sin cortar en la reserva">
        <div className="funnel">
          {pasos.map((p, i) => {
            const anterior = i === 0 ? null : pasos[i - 1].valor;
            const conversion = anterior && anterior > 0 ? p.valor / anterior : null;
            return (
              <div key={p.label} className="funnel-step">
                <span className="funnel-step-mark">{p.icono}</span>
                <div className="funnel-step-body">
                  <p>{p.label}</p>
                  <ShareBar valor={p.valor / tope} tono={i === pasos.length - 1 ? "ok" : "oro"} />
                </div>
                <div className="funnel-step-value">
                  <strong>{numero.format(p.valor)}</strong>
                  <small>{conversion !== null ? `${porcentaje(conversion, 1)} del paso anterior` : "punto de partida"}</small>
                </div>
              </div>
            );
          })}
        </div>
      </ModulePanel>

      <ModulePanel titulo="Aporte por canal" descripcion="Sesiones y conversiones registradas en Analytics">
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Canal</th>
                <th className="num">Sesiones</th>
                <th className="num">Conversiones</th>
                <th className="num">Tasa</th>
                <th>Peso</th>
              </tr>
            </thead>
            <tbody>
              {analytics.canales.map((c) => {
                const maximo = Math.max(1, ...analytics.canales.map((x) => x.sesiones));
                return (
                  <tr key={c.nombre}>
                    <td className="strong">{c.nombre}</td>
                    <td className="num">{numero.format(c.sesiones)}</td>
                    <td className="num">{numero.format(c.conversiones)}</td>
                    <td className="num muted">{porcentaje(c.conversiones / Math.max(1, c.sesiones), 2)}</td>
                    <td>
                      <ShareBar valor={c.sesiones / maximo} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </ModulePanel>
    </div>
  );
}
