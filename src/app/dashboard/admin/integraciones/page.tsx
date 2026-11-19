"use client";

import { useEffect, useState, type ReactNode } from "react";
import { BellRing, CalendarDays, Check, Circle, CreditCard, IdCard, Loader2, Mail, Plug } from "lucide-react";
import { PanelShell } from "@/components/shell/PanelShell";
import { Metric, ModulePanel, SinAcceso } from "@/components/panel/ModuleUI";
import { GoogleMark, MercadoPagoMark, StripeMark } from "@/components/payments/BrandMarks";
import { useBarberia } from "@/lib/store";
import { WALLET_VISIBLE } from "@/lib/modo";

type EstadoIntegracion = {
  variables: { nombre: string; definida: boolean }[];
  conectada: boolean;
};

type Catalogo = {
  id: string;
  nombre: string;
  descripcion: string;
  logo: ReactNode;
  grupo: "Cobros" | "Operación";
};

const CATALOGO_COMPLETO: Catalogo[] = [
  {
    id: "stripe",
    nombre: "Stripe",
    descripcion: "Cobro con tarjeta, tokenización de métodos guardados y webhooks de confirmación de pago.",
    logo: <StripeMark compact />,
    grupo: "Cobros",
  },
  {
    id: "mercado-pago",
    nombre: "Mercado Pago",
    descripcion: "Cobro con saldo, SPEI y tarjetas locales para el mercado mexicano.",
    logo: <MercadoPagoMark compact />,
    grupo: "Cobros",
  },
  {
    id: "google-auth",
    nombre: "Acceso con Google",
    descripcion: "Inicio de sesión OAuth con PKCE sobre Supabase Auth, con sesión en cookies HttpOnly.",
    logo: <GoogleMark />,
    grupo: "Operación",
  },
  {
    id: "google-calendar",
    nombre: "Google Calendar",
    descripcion: "Sincronización bidireccional de la agenda de cada barbero con su calendario personal.",
    logo: <CalendarDays className="h-5 w-5" style={{ color: "var(--ink)" }} />,
    grupo: "Operación",
  },
  {
    id: "push",
    nombre: "Notificaciones push",
    descripcion: "Avisos en el teléfono o la computadora de barberos, administradores y clientes, aunque tengan la app cerrada (Web Push con claves VAPID).",
    logo: <BellRing className="h-5 w-5" style={{ color: "var(--ink)" }} />,
    grupo: "Operación",
  },
  {
    id: "correo-gmail",
    nombre: "Correo con Gmail",
    descripcion: "Correo de cada cita nueva, cambio, cancelación y recordatorio al cliente y al barbero, enviado como CortMart. Usa el cliente OAuth de Google Calendar.",
    logo: <Mail className="h-5 w-5" style={{ color: "var(--ink)" }} />,
    grupo: "Operación",
  },
  {
    id: "google-wallet",
    nombre: "Google Wallet",
    descripcion: "Tarjeta de lealtad de cada cliente en su teléfono, con QR y sellos que se actualizan solos. Puede reutilizar la cuenta de servicio de GA4.",
    logo: <IdCard className="h-5 w-5" style={{ color: "var(--ink)" }} />,
    grupo: "Operación",
  },
];

// Sólo lo que la barbería usa: lo de operación (activo) y los cobros.
// Google Wallet se oculta hasta activarlo (ver WALLET_VISIBLE).
const CATALOGO = CATALOGO_COMPLETO.filter((c) => WALLET_VISIBLE || c.id !== "google-wallet");

/**
 * Estado de las conexiones del sistema. En lugar de una lista decorativa de
 * logotipos, cada tarjeta dice exactamente qué variables de entorno faltan por
 * definir: es la diferencia entre "no conectado" y saber qué hacer al respecto.
 */
export default function IntegracionesPage() {
  const store = useBarberia();
  const { listo, sesion } = store;
  const [estado, setEstado] = useState<Record<string, EstadoIntegracion> | null>(null);

  useEffect(() => {
    let vivo = true;
    fetch("/api/integrations/estado")
      .then((r) => r.json())
      .then((d) => vivo && setEstado(d))
      .catch(() => vivo && setEstado({}));
    return () => {
      vivo = false;
    };
  }, []);

  if (!listo) return null;
  if (!sesion || sesion.rol !== "admin") return <SinAcceso mensaje="Este módulo es del administrador" />;

  const conectadas = estado ? Object.values(estado).filter((e) => e.conectada).length : 0;
  const grupos: Catalogo["grupo"][] = ["Operación", "Cobros"];

  return (
    <PanelShell sesion={sesion} activo="Integraciones" onLogout={store.logout}>
      <header className="anim-in mb-6">
        <p className="kicker">Conexiones</p>
        <h1 className="font-display text-2xl font-bold tracking-tight">Integraciones</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
          Qué servicios están conectados y qué falta por configurar en cada uno.
        </p>
      </header>

      <div className="metric-grid anim-in anim-d1">
        <Metric icono={<Plug />} label="Conectadas" valor={`${conectadas} / ${CATALOGO.length}`} nota="Con todas sus variables definidas" />
        <Metric icono={<CreditCard />} label="Cobros" valor="2" nota="Stripe y Mercado Pago" />
        <Metric icono={<CalendarDays />} label="Operación" valor="4" nota="Acceso con Google, Google Calendar, push y correo" />
      </div>

      {!estado && (
        <div className="module-panel mt-3 flex items-center justify-center gap-2 py-8 text-sm" style={{ color: "var(--ink-muted)" }}>
          <Loader2 className="h-4 w-4 animate-spin" /> Revisando configuración…
        </div>
      )}

      {estado &&
        grupos.map((grupo) => (
          <ModulePanel key={grupo} titulo={grupo} descripcion={`Servicios de ${grupo.toLowerCase()}`}>
            <div className="integration-grid">
              {CATALOGO.filter((c) => c.grupo === grupo).map((c) => {
                const info = estado[c.id];
                const conectada = info?.conectada ?? false;
                return (
                  <article key={c.id} className={`integration-card ${conectada ? "is-connected" : ""}`}>
                    <div className="integration-card-head">
                      <span className="integration-logo">{c.logo}</span>
                      <div className="min-w-0">
                        <p>{c.nombre}</p>
                        <small>{c.descripcion}</small>
                      </div>
                      <span className={`badge ${conectada ? "badge-ok" : "badge-neutral"} shrink-0`}>
                        {conectada ? "Conectada" : "Pendiente"}
                      </span>
                    </div>
                    <div className="integration-envs">
                      {(info?.variables ?? []).map((v) => (
                        <code key={v.nombre} className={v.definida ? "is-set" : "is-missing"}>
                          {v.definida ? <Check /> : <Circle />}
                          {v.nombre}
                        </code>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          </ModulePanel>
        ))}
    </PanelShell>
  );
}
