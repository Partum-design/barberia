"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Building2, Check, Gift, RotateCcw, Save, ShieldCheck } from "lucide-react";
import { PanelShell } from "@/components/shell/PanelShell";
import { useDemoStore } from "@/lib/demo-store";

// Nodo Administrador: datos de la barbería y reglas del programa de lealtad.
export default function ConfiguracionAdminPage() {
  const store = useDemoStore();
  const { listo, sesion, barberiaConfig, recompensasConfig } = store;

  const [barberia, setBarberia] = useState(barberiaConfig);
  const [recompensas, setRecompensas] = useState(recompensasConfig);
  const [guardado, setGuardado] = useState(false);

  useEffect(() => setBarberia(barberiaConfig), [barberiaConfig]);
  useEffect(() => setRecompensas(recompensasConfig), [recompensasConfig]);

  if (!listo) return null;

  if (!sesion || sesion.rol !== "admin") {
    return <SinSesion />;
  }

  function guardar() {
    store.actualizarBarberiaConfig(barberia);
    store.actualizarRecompensasConfig(recompensas);
    setGuardado(true);
    setTimeout(() => setGuardado(false), 2500);
  }

  return (
    <PanelShell sesion={sesion} activo="Configuración" onLogout={store.logout}>
      <header className="anim-in mb-6">
        <p className="kicker">Ajustes</p>
        <h1 className="font-display text-2xl font-bold tracking-tight">Configuración</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
          Datos de la barbería y reglas del programa de lealtad.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="anim-in anim-d1 space-y-4 rounded-3xl p-6 shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10" style={{ background: "var(--card)" }}>
          <h2 className="flex items-center gap-2 font-semibold">
            <Building2 className="h-4 w-4 text-accent-500" /> Barbería
          </h2>
          <div>
            <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--ink-muted)" }}>
              Nombre
            </label>
            <input
              value={barberia.nombre}
              onChange={(e) => setBarberia((c) => ({ ...c, nombre: e.target.value }))}
              className="w-full rounded-xl border border-slate-300/70 bg-transparent px-4 py-2.5 text-sm outline-none focus:border-accent-500 dark:border-white/15"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--ink-muted)" }}>
              Dirección
            </label>
            <input
              value={barberia.direccion}
              onChange={(e) => setBarberia((c) => ({ ...c, direccion: e.target.value }))}
              className="w-full rounded-xl border border-slate-300/70 bg-transparent px-4 py-2.5 text-sm outline-none focus:border-accent-500 dark:border-white/15"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--ink-muted)" }}>
              Teléfono
            </label>
            <input
              value={barberia.telefono}
              onChange={(e) => setBarberia((c) => ({ ...c, telefono: e.target.value }))}
              className="w-full rounded-xl border border-slate-300/70 bg-transparent px-4 py-2.5 text-sm outline-none focus:border-accent-500 dark:border-white/15"
            />
          </div>
        </section>

        <section className="anim-in anim-d2 space-y-4 rounded-3xl p-6 shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10" style={{ background: "var(--card)" }}>
          <h2 className="flex items-center gap-2 font-semibold">
            <Gift className="h-4 w-4 text-accent-500" /> Programa de lealtad
          </h2>
          <div>
            <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--ink-muted)" }}>
              Citas asistidas requeridas
            </label>
            <input
              type="number"
              min={1}
              max={20}
              value={recompensas.citas_requeridas}
              onChange={(e) =>
                setRecompensas((r) => ({ ...r, citas_requeridas: Math.max(1, Number(e.target.value)) }))
              }
              className="w-full rounded-xl border border-slate-300/70 bg-transparent px-4 py-2.5 text-sm outline-none focus:border-accent-500 dark:border-white/15"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--ink-muted)" }}>
              Descuento otorgado (%)
            </label>
            <input
              type="number"
              min={1}
              max={100}
              value={recompensas.valor_descuento}
              onChange={(e) =>
                setRecompensas((r) => ({ ...r, valor_descuento: Math.max(1, Number(e.target.value)) }))
              }
              className="w-full rounded-xl border border-slate-300/70 bg-transparent px-4 py-2.5 text-sm outline-none focus:border-accent-500 dark:border-white/15"
            />
          </div>
          <p className="rounded-xl bg-brand-50 px-4 py-2.5 text-sm text-brand-700 dark:bg-brand-900/30 dark:text-brand-100">
            Regla activa: cada <strong>{recompensas.citas_requeridas}</strong> citas asistidas →{" "}
            <strong>{recompensas.valor_descuento}%</strong> de descuento. Se aplica a todos los
            clientes de la barbería.
          </p>
        </section>
      </div>

      <div className="anim-in anim-d3 mt-6 flex items-center gap-3">
        <button
          onClick={guardar}
          className="card-hover flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-accent-500 px-5 py-2.5 text-sm font-semibold text-white"
        >
          {guardado ? (
            <>
              <Check className="h-4 w-4" /> Guardado
            </>
          ) : (
            <>
              <Save className="h-4 w-4" /> Guardar cambios
            </>
          )}
        </button>
        <button
          onClick={store.reiniciarDemo}
          className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5"
          style={{ color: "var(--ink-muted)" }}
        >
          <RotateCcw className="h-4 w-4" /> Restablecer datos de la demo
        </button>
      </div>
    </PanelShell>
  );
}

function SinSesion() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <ShieldCheck className="h-8 w-8 text-accent-500" />
      <p className="anim-in text-lg font-semibold">Inicia sesión como administrador para ver este panel</p>
      <Link
        href="/login"
        className="anim-in anim-d1 rounded-full bg-gradient-to-r from-brand-600 to-accent-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md"
      >
        Entrar a la demo
      </Link>
    </main>
  );
}
