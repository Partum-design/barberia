"use client";

import Link from "next/link";
import { useMemo } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CheckCircle2, Gift, Sparkles, User } from "lucide-react";
import { PanelShell } from "@/components/shell/PanelShell";
import { calcularLealtad, useDemoStore } from "@/lib/demo-store";

// Nodo Cliente: detalle del programa de lealtad — progreso, historial de
// citas que suman puntos y canje de recompensas ganadas.
export default function RecompensasPage() {
  const store = useDemoStore();
  const { listo, citas, sesion, recompensasConfig, canjes } = store;
  const clienteId = "cli-1";

  const lealtad = calcularLealtad(citas, clienteId, recompensasConfig.citas_requeridas);
  const canjeadas = canjes[clienteId] ?? 0;
  const disponibles = Math.max(0, lealtad.recompensasGanadas - canjeadas);

  const historialAsistidas = useMemo(
    () =>
      citas
        .filter((c) => c.cliente_id === clienteId && c.estado === "asistida")
        .sort((a, b) => b.inicio.localeCompare(a.inicio)),
    [citas]
  );

  if (!listo) return null;

  if (!sesion || sesion.rol !== "cliente") {
    return <SinSesion />;
  }

  return (
    <PanelShell sesion={sesion} activo="Recompensas" onLogout={store.logout}>
      <header className="anim-in mb-6">
        <p className="kicker">Programa de lealtad</p>
        <h1 className="font-display text-2xl font-bold tracking-tight">Recompensas</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
          Cada {lealtad.requerido} citas asistidas desbloqueas un descuento en tu siguiente
          visita.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="anim-in anim-d1 lg:col-span-2">
          <div className="card-hover rounded-3xl bg-gradient-to-br from-brand-700 via-brand-600 to-accent-500 p-6 text-white shadow-md">
            <div className="mb-4 flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
                <Gift className="h-5 w-5" />
              </span>
              <h2 className="font-semibold">Tu progreso</h2>
            </div>
            <div className="flex items-center gap-1.5">
              {Array.from({ length: lealtad.requerido }).map((_, i) => (
                <span
                  key={i}
                  className={`h-3 flex-1 rounded-full transition-colors ${
                    i < lealtad.progreso ? "bg-white" : "bg-white/25"
                  }`}
                />
              ))}
            </div>
            <p className="mt-2 text-sm text-white/85">
              {lealtad.progreso} de {lealtad.requerido} citas asistidas · te faltan{" "}
              {lealtad.faltan} para tu próxima recompensa
            </p>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/10 px-4 py-3.5">
              <div>
                <p className="text-2xl font-bold tabular-nums">{disponibles}</p>
                <p className="text-xs text-white/80">
                  {disponibles === 1 ? "recompensa disponible" : "recompensas disponibles"} ·{" "}
                  {recompensasConfig.valor_descuento}% de descuento c/u
                </p>
              </div>
              <button
                disabled={disponibles === 0}
                onClick={() => store.canjearRecompensa(clienteId, lealtad.recompensasGanadas)}
                className="card-hover rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-brand-700 disabled:opacity-40"
              >
                Canjear recompensa
              </button>
            </div>
          </div>

          <div className="anim-in anim-d2 mt-6">
            <h2 className="mb-3 font-semibold">Historial de citas que suman puntos</h2>
            <div className="space-y-2">
              {historialAsistidas.length === 0 && (
                <p className="rounded-2xl border border-dashed border-brand-500/30 p-6 text-center text-sm" style={{ color: "var(--ink-muted)" }}>
                  Aún no tienes citas asistidas. ¡Tu primera cita ya suma para tu recompensa!
                </p>
              )}
              {historialAsistidas.map((c, i) => (
                <article
                  key={c.id}
                  className="flex items-center gap-3 rounded-2xl p-3.5 shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10"
                  style={{ background: "var(--card)" }}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-pine-900/10 text-pine-800">
                    <CheckCircle2 className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.barbero_nombre}</p>
                    <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
                      {format(new Date(c.inicio), "d 'de' MMMM, yyyy", { locale: es })}
                    </p>
                  </div>
                  <span className="flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 dark:bg-brand-900/40 dark:text-brand-100">
                    <Sparkles className="h-3 w-3" /> +1 punto · #{historialAsistidas.length - i}
                  </span>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="anim-in anim-d3">
          <div className="rounded-3xl p-5 text-sm shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10" style={{ background: "var(--card)" }}>
            <h3 className="mb-2 font-semibold">¿Cómo funciona?</h3>
            <ul className="space-y-2.5" style={{ color: "var(--ink-muted)" }}>
              <li>• Cada cita marcada como <strong>asistida</strong> suma 1 punto.</li>
              <li>
                • Al llegar a <strong>{lealtad.requerido} puntos</strong> desbloqueas un{" "}
                <strong>{recompensasConfig.valor_descuento}%</strong> de descuento.
              </li>
              <li>• Puedes canjear cada recompensa cuando quieras; se aplica en tu próxima reserva.</li>
              <li>• Las citas canceladas no suman puntos.</li>
            </ul>
          </div>
        </section>
      </div>
    </PanelShell>
  );
}

function SinSesion() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <User className="h-8 w-8 text-accent-500" />
      <p className="anim-in text-lg font-semibold">Inicia sesión para ver tus recompensas</p>
      <Link
        href="/login"
        className="anim-in anim-d1 rounded-full bg-gradient-to-r from-brand-600 to-accent-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md"
      >
        Entrar a la demo
      </Link>
    </main>
  );
}
