"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Reveal } from "@/components/marketing/Reveal";

const PREGUNTAS = [
  {
    q: "¿Puedo cobrar los cortes en efectivo además de con tarjeta?",
    a: "Sí. El cliente elige el método al agendar: tarjeta vía Stripe o efectivo en barbería. Las citas en efectivo quedan marcadas como \"pendientes\" hasta que recepción o el barbero confirman el cobro desde su panel.",
  },
  {
    q: "¿Necesito tarjeta de crédito para probar la demo?",
    a: "No. La demo interactiva corre con datos locales en tu navegador — no se conecta a Stripe ni a una base de datos real, así que puedes explorar los tres roles (cliente, barbero, administrador) sin ningún costo ni registro.",
  },
  {
    q: "¿Qué pasa si un cliente no completa el pago?",
    a: "El horario se bloquea por 10 minutos mientras se confirma el pago o el método elegido. Si no se completa, el sistema lo libera automáticamente para que otro cliente pueda tomarlo — así se evitan los huecos fantasma en la agenda.",
  },
  {
    q: "¿Puedo cambiar de plan más adelante?",
    a: "Sí, puedes subir o bajar de plan cuando quieras; el cambio aplica en el siguiente ciclo de facturación y no perdemos tu historial de clientes, citas ni tu programa de lealtad.",
  },
  {
    q: "¿La plataforma sirve para barberías con varias sucursales?",
    a: "Sí, el plan Barbería soporta múltiples sucursales y barberos ilimitados, con roles y permisos separados por sucursal para tu equipo administrativo.",
  },
];

// FAQ tipo acordeón; una sola pregunta abierta a la vez para mantenerlo limpio.
export function FaqSection() {
  const [abierta, setAbierta] = useState<number | null>(0);

  return (
    <section className="landing-faq mx-auto max-w-3xl px-6 py-20">
      <Reveal className="mx-auto mb-10 max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">Dudas</p>
        <h2 className="font-display mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
          Preguntas frecuentes
        </h2>
      </Reveal>
      <div className="space-y-3">
        {PREGUNTAS.map((item, i) => {
          const abierto = abierta === i;
          return (
            <Reveal key={item.q} delay={i * 60}>
              <div
                className="faq-item overflow-hidden rounded-2xl bg-white transition-shadow"
              >
                <button
                  onClick={() => setAbierta(abierto ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-semibold"
                  style={{ color: "var(--ink)" }}
                >
                  {item.q}
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 transition-transform duration-300 ${abierto ? "rotate-180 text-accent-500" : "text-slate-400"}`}
                  />
                </button>
                <div
                  className="grid transition-all duration-300 ease-out"
                  style={{ gridTemplateRows: abierto ? "1fr" : "0fr" }}
                >
                  <div className="overflow-hidden">
                    <p className="px-5 pb-4 text-sm leading-relaxed" style={{ color: "var(--ink-muted)" }}>
                      {item.a}
                    </p>
                  </div>
                </div>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
