"use client";

import { CircleAlert, Radio, TrendingDown, TrendingUp } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
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
      <ValorVivo valor={valor} />
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

/**
 * Pantalla para quien ya inició sesión pero abrió una sección de otro tipo de
 * cuenta (p. ej. un administrador en "Mi cuenta" de cliente): en lugar de
 * pedirle que inicie sesión otra vez, le dice dónde está y lo lleva a su panel.
 */
export function OtroRol({ rol, para }: { rol: "cliente" | "barbero" | "admin"; para: string }) {
  const destino = rol === "admin" ? "/dashboard/admin" : rol === "barbero" ? "/dashboard/barbero" : "/cuenta";
  const soy = rol === "admin" ? "administrador" : rol === "barbero" ? "barbero" : "cliente";
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="kicker anim-in">Sección para {para}</p>
      <p className="anim-in max-w-md text-lg font-semibold">
        Esta sección es para {para}. Entraste como {soy}.
      </p>
      <a href={destino} className="btn-gold anim-in anim-d1 mt-2 px-6 py-3 text-sm">
        Ir a mi panel
      </a>
    </main>
  );
}

/**
 * Cifra que destella cuando cambia (una llegada confirmada, un cobro): así se
 * nota al instante que el número se actualizó solo.
 */
export function ValorVivo({ valor, as: Tag = "strong", className = "" }: { valor: string; as?: "strong" | "p" | "span"; className?: string }) {
  const previo = useRef(valor);
  const [pulso, setPulso] = useState(0);
  useEffect(() => {
    if (previo.current !== valor) {
      previo.current = valor;
      setPulso((n) => n + 1);
    }
  }, [valor]);
  return (
    <Tag key={pulso} className={`${className} ${pulso > 0 ? "valor-vivo" : ""}`.trim()}>
      {valor}
    </Tag>
  );
}
