"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { Reveal } from "@/components/marketing/Reveal";

const mxn = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

type Plan = {
  id: string;
  nombre: string;
  descripcion: string;
  precioMensual: number;
  destacado?: boolean;
  features: string[];
};

const PLANES: Plan[] = [
  {
    id: "esencial",
    nombre: "Esencial",
    descripcion: "Para el barbero independiente que quiere dejar de agendar por teléfono.",
    precioMensual: 990,
    features: [
      "1 barbero activo",
      "Agenda en línea con bloqueo anti-scalping",
      "Pago con tarjeta (Stripe) y efectivo en barbería",
      "Verificación de clientes por WhatsApp/SMS",
      "Recordatorios automáticos de cita",
    ],
  },
  {
    id: "profesional",
    nombre: "Profesional",
    descripcion: "Para barberías con varios especialistas que quieren fidelizar clientes.",
    precioMensual: 1990,
    destacado: true,
    features: [
      "Hasta 5 barberos activos",
      "Todo lo del plan Esencial",
      "Servicio a domicilio con dirección y ruta automática",
      "Programa de lealtad configurable",
      "Panel de administrador con reportes",
      "Sincronización con Google/Outlook Calendar",
    ],
  },
  {
    id: "barberia",
    nombre: "Barbería",
    descripcion: "Para barberías multi-sucursal con necesidades a la medida.",
    precioMensual: 3990,
    features: [
      "Barberos y sucursales ilimitados",
      "Todo lo del plan Profesional",
      "Roles y permisos por sucursal",
      "Soporte prioritario y onboarding dedicado",
      "Acceso a API para integraciones propias",
    ],
  },
];

// Sección de precios: mensual/anual con 20% de descuento en anual.
// CTA lleva a la demo interactiva (/login) — no hay checkout real, es una demo.
export function PricingSection() {
  const [anual, setAnual] = useState(false);

  return (
    <section id="precios" className="landing-pricing py-20">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal className="mx-auto mb-10 max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">Precios</p>
          <h2 className="font-display mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            Planes simples, sin sorpresas
          </h2>
          <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--ink-muted)" }}>
            Cancela cuando quieras. Todos los planes incluyen pago con tarjeta y en efectivo desde
            el día uno.
          </p>

          <div className="pricing-toggle mt-7 inline-flex items-center gap-1 rounded-full bg-white p-1">
            <button
              onClick={() => setAnual(false)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                !anual ? "bg-ink-900 text-white shadow-sm" : "text-slate-500"
              }`}
            >
              Mensual
            </button>
            <button
              onClick={() => setAnual(true)}
              className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                anual ? "bg-ink-900 text-white shadow-sm" : "text-slate-500"
              }`}
            >
              Anual <span className={`text-xs ${anual ? "text-mint-raw" : "text-accent-500"}`}>· ahorra 20%</span>
            </button>
          </div>
        </Reveal>

        <div className="grid gap-6 lg:grid-cols-3 lg:items-stretch">
          {PLANES.map((plan, i) => {
            const precio = anual ? Math.round(plan.precioMensual * 0.8) : plan.precioMensual;
            return (
              <Reveal key={plan.id} delay={i * 100} className="h-full">
                <div
                  className={`pricing-card relative flex h-full flex-col overflow-hidden rounded-3xl p-7 ring-1 ${
                    plan.destacado
                      ? "text-white ring-transparent shadow-2xl shadow-brand-900/30 lg:-translate-y-3"
                      : "bg-white ring-slate-900/5"
                  }`}
                  style={
                    plan.destacado
                      ? {
                          background:
                            "linear-gradient(160deg, #1a160f 0%, #2a2114 55%, #4a3a1c 100%)",
                          border: "1px solid rgba(230, 197, 118, 0.35)",
                        }
                      : undefined
                  }
                >
                  {plan.destacado && (
                    <div
                      className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full opacity-40 blur-3xl"
                      style={{ background: "radial-gradient(circle, #CBA135, transparent 65%)" }}
                      aria-hidden
                    />
                  )}
                  {plan.destacado && (
                    <span className="relative mb-4 flex w-fit items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-mint-raw ring-1 ring-white/20">
                      <Sparkles className="h-3.5 w-3.5" /> Más elegido
                    </span>
                  )}
                  <h3 className="font-display relative text-lg font-bold">{plan.nombre}</h3>
                  <p
                    className={`relative mt-1.5 text-sm leading-relaxed ${plan.destacado ? "text-white/80" : ""}`}
                    style={plan.destacado ? undefined : { color: "var(--ink-muted)" }}
                  >
                    {plan.descripcion}
                  </p>
                  <p className="font-num relative mt-6 flex items-baseline gap-1.5">
                    <span className="text-4xl font-semibold tracking-tight">{mxn.format(precio)}</span>
                    <span className={`font-body text-sm ${plan.destacado ? "text-white/70" : ""}`} style={plan.destacado ? undefined : { color: "var(--ink-muted)" }}>
                      /mes {anual && "· facturado anual"}
                    </span>
                  </p>
                  <ul className="relative mt-6 flex-1 space-y-3 text-sm">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5">
                        <Check className={`mt-0.5 h-4 w-4 shrink-0 ${plan.destacado ? "text-mint-raw" : "text-accent-500"}`} />
                        <span className={plan.destacado ? "text-white/90" : ""}>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/login"
                    className={`card-hover relative mt-7 rounded-full px-5 py-3 text-center text-sm font-semibold shadow-sm transition-colors ${
                      plan.destacado
                        ? "btn-gold"
                        : "border border-white/15 text-white hover:bg-white/10"
                    }`}
                  >
                    Probar la demo
                  </Link>
                </div>
              </Reveal>
            );
          })}
        </div>

        <p className="mx-auto mt-8 max-w-xl text-center text-xs" style={{ color: "var(--ink-muted)" }}>
          Precios de referencia en pesos mexicanos (MXN), antes de IVA. Esta demo no procesa pagos
          reales de suscripción.
        </p>
      </div>
    </section>
  );
}
