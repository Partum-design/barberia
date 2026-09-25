"use client";

import { CircleAlert, Radio, TrendingDown, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";
import type { OrigenDatos } from "@/lib/integrations/tipos";

// Piezas compartidas por todos los módulos nuevos del panel (marketing, CRM,
// catálogo, inventario, caja e integraciones). Viven juntas para que los seis
// módulos se vean como un mismo producto y no como seis pantallas sueltas.

export const numero = new Intl.NumberFormat("es-MX");
export const moneda = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});
export const monedaExacta = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

export const porcentaje = (valor: number, decimales = 1) =>
  `${(valor * 100).toFixed(decimales).replace(".", ",")} %`;

export const duracion = (segundos: number) => {
  const m = Math.floor(segundos / 60);
  const s = Math.round(segundos % 60);
  return `${m}m ${String(s).padStart(2, "0")}s`;
};

export function ModuleTabs<T extends string>({
  valor,
  opciones,
  onChange,
}: {
  valor: T;
  opciones: { id: T; label: string }[];
  onChange: (id: T) => void;
}) {
  return (
    <div className="module-tabs" role="tablist">
      {opciones.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={o.id === valor}
          className={o.id === valor ? "is-active" : ""}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Aviso honesto sobre el origen de las cifras que se están mirando. */
export function DataSourceNote({ origen, aviso }: { origen: OrigenDatos; aviso?: string }) {
  const vivo = origen === "vivo";
  return (
    <p className={`data-source-note ${vivo ? "is-live" : ""}`}>
      {vivo ? <Radio /> : <CircleAlert />}
      <span>
        <b>{vivo ? "Datos en vivo" : "Sin conexión"}</b>
        {" · "}
        {aviso ??
          "Conectado a la cuenta configurada; las cifras se actualizan cada cinco minutos."}
      </span>
    </p>
  );
}

export function Metric({
  icono,
  label,
  valor,
  delta,
  nota,
}: {
  icono?: ReactNode;
  label: string;
  valor: string;
  /** Variación relativa frente al periodo anterior, 0.12 = +12 % */
  delta?: number;
  nota?: string;
}) {
  const direccion = delta === undefined ? null : delta > 0.001 ? "is-up" : delta < -0.001 ? "is-down" : "is-flat";
  return (
    <div className="metric-card">
      <span>
        {icono}
        {label}
      </span>
      <strong>{valor}</strong>
      {direccion && (
        <span className={`metric-delta ${direccion}`}>
          {direccion === "is-up" ? <TrendingUp /> : direccion === "is-down" ? <TrendingDown /> : null}
          {delta! > 0 ? "+" : ""}
          {(delta! * 100).toFixed(1).replace(".", ",")} % vs. periodo anterior
        </span>
      )}
      {nota && <small>{nota}</small>}
    </div>
  );
}

export function ShareBar({ valor, tono = "oro" }: { valor: number; tono?: "oro" | "ox" | "ok" }) {
  const clase = tono === "ox" ? "is-ox" : tono === "ok" ? "is-ok" : "";
  return (
    <div className={`share-bar ${clase}`} role="presentation">
      <span style={{ width: `${Math.max(2, Math.min(100, valor * 100))}%` }} />
    </div>
  );
}

export function EmptyState({ children, icono }: { children: ReactNode; icono?: ReactNode }) {
  return (
    <div className="empty-state">
      {icono}
      <p>{children}</p>
    </div>
  );
}

export function ModulePanel({
  titulo,
  descripcion,
  extra,
  children,
}: {
  titulo: string;
  descripcion?: string;
  extra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="module-panel">
      <div className="module-panel-head">
        <div>
          <p>{titulo}</p>
          {descripcion && <span>{descripcion}</span>}
        </div>
        {extra}
      </div>
      {children}
    </section>
  );
}

/** Tooltip común para todas las gráficas de recharts. */
export function ChartTooltip({
  active,
  payload,
  label,
  formato,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number | string; color?: string }[];
  label?: string | number;
  formato?: (valor: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p>{label}</p>
      {payload.map((p, i) => (
        <span key={i} style={{ color: p.color }}>
          {p.name}: {formato ? formato(Number(p.value)) : numero.format(Number(p.value))}
        </span>
      ))}
    </div>
  );
}

/** Pantalla de cortesía cuando alguien llega a un panel sin la sesión correcta. */
export function SinAcceso({ mensaje = "Inicia sesión para ver este módulo" }: { mensaje?: string }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="anim-in text-lg font-semibold">{mensaje}</p>
      <a href="/login" className="btn-gold anim-in anim-d1 px-6 py-2.5 text-sm">
        Entrar
      </a>
    </main>
  );
}
