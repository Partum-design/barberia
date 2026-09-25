"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Banknote, Check, CreditCard, ShieldCheck } from "lucide-react";
import { PanelShell } from "@/components/shell/PanelShell";
import { MercadoPagoMark, StripeMark } from "@/components/payments/BrandMarks";
import { useBarberia } from "@/lib/store";

const mxn = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

// Nodo Cliente: método de pago guardado + historial de cobros de sus citas.
export default function PagosPage() {
  const store = useBarberia();
  const { listo, citas, sesion } = store;
  const [provider, setProvider] = useState<"stripe" | "mercado-pago">("stripe");
  const clienteId = sesion?.id ?? "";

  const mias = useMemo(
    () =>
      citas
        .filter((c) => c.cliente_id === clienteId && c.estado !== "cancelada")
        .sort((a, b) => b.inicio.localeCompare(a.inicio)),
    [citas, clienteId]
  );

  if (!listo) return null;

  if (!sesion || sesion.rol !== "cliente") {
    return <SinSesion />;
  }

  return (
    <PanelShell sesion={sesion} activo="Pagos" onLogout={store.logout}>
      <header className="anim-in mb-6">
        <p className="kicker">Métodos y cobros</p>
        <h1 className="font-display text-2xl font-bold tracking-tight">Pagos</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
          Tu método de pago guardado y el historial de cobros de tus citas.
        </p>
      </header>

      <div className="payments-layout">
        <section className="payments-wallet anim-in anim-d1">
          <div className="payments-section-heading">
            <div><p>Métodos guardados</p><span>Tus tarjetas quedan tokenizadas por la pasarela de pago.</span></div>
            <span className="payments-secure"><ShieldCheck /> Protegido</span>
          </div>

          <div
            className="rounded-2xl border border-dashed border-brand-500/30 p-8 text-center text-sm"
            style={{ background: "var(--card)", color: "var(--ink-muted)" }}
          >
            Aún no tienes métodos guardados. Tu tarjeta se guarda de forma segura la primera vez que
            pagas una cita en línea.
          </div>

          <div className="payment-provider-panel">
            <div><p>Procesar pagos con</p><span>Elige la pasarela con la que se cobran tus citas.</span></div>
            <div className="payment-provider-options" role="radiogroup" aria-label="Procesador de pagos">
              <button type="button" role="radio" aria-checked={provider === "stripe"} onClick={() => setProvider("stripe")} className={provider === "stripe" ? "is-active" : ""}>
                <StripeMark /><span>{provider === "stripe" && <Check />} Tarjetas</span>
              </button>
              <button type="button" role="radio" aria-checked={provider === "mercado-pago"} onClick={() => setProvider("mercado-pago")} className={provider === "mercado-pago" ? "is-active" : ""}>
                <MercadoPagoMark /><span>{provider === "mercado-pago" && <Check />} Saldo y SPEI</span>
              </button>
            </div>
            <p className="payment-provider-note"><ShieldCheck /> Nunca guardamos el número completo de tu tarjeta.</p>
          </div>
        </section>

        <section className="payments-history anim-in anim-d2">
          <div className="payments-section-heading"><div><p>Historial de cobros</p><span>Movimientos recientes vinculados a tus citas.</span></div></div>
          {mias.length === 0 && (
            <div
              className="rounded-2xl border border-dashed border-brand-500/30 p-8 text-center text-sm"
              style={{ background: "var(--card)", color: "var(--ink-muted)" }}
            >
              Aún no tienes cobros registrados.
            </div>
          )}
          <div className="payments-history-list">
          {mias.map((c) => (
            <article
              key={c.id}
              className="payment-history-row"
            >
              <div className={`payment-history-mark ${c.metodo_pago}`}>
                {c.metodo_pago === "tarjeta" ? <CreditCard /> : <Banknote />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{c.barbero_nombre}</p>
                <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
                  {format(new Date(c.inicio), "d 'de' MMMM, yyyy", { locale: es })} ·{" "}
                  {c.metodo_pago === "tarjeta" ? "Tarjeta en línea" : "Efectivo en barbería"}
                </p>
              </div>
              <div className="text-right">
                <p className="font-num font-semibold">{mxn.format(c.precio)}</p>
                <span
                  className={`text-[11px] font-medium ${
                    c.estado_pago === "pagado" ? "text-pine-800" : "text-brand-600"
                  }`}
                >
                  {c.estado_pago === "pagado" ? "Pagado" : "Pendiente"}
                </span>
              </div>
            </article>
          ))}
          </div>
        </section>
      </div>
    </PanelShell>
  );
}

function SinSesion() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="anim-in text-lg font-semibold">Inicia sesión para ver tus pagos</p>
      <Link
        href="/login"
        className="anim-in anim-d1 rounded-full bg-gradient-to-r from-brand-600 to-accent-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md"
      >
        Iniciar sesión
      </Link>
    </main>
  );
}
