"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Home, Plus, ShieldCheck, X } from "lucide-react";
import { PanelShell } from "@/components/shell/PanelShell";
import { useDemoStore } from "@/lib/demo-store";

const mxn = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

const formInicial = {
  nombre: "",
  especialidad: "",
  precio_servicio: 800,
  duracion_cita_min: 30,
  acepta_domicilio: true,
  biografia: "",
};

// Nodo Administrador: alta y gestión del equipo de barberos de la barbería.
export default function EquipoBarberoPage() {
  const store = useDemoStore();
  const { listo, sesion, barberos, citas } = store;
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState(formInicial);

  const conStats = useMemo(
    () =>
      barberos.map((m) => {
        const suyas = citas.filter((c) => c.barbero_id === m.id && c.estado !== "cancelada");
        return { ...m, citas: suyas.length, ingresos: suyas.reduce((s, c) => s + c.precio, 0) };
      }),
    [barberos, citas]
  );

  if (!listo) return null;

  if (!sesion || sesion.rol !== "admin") {
    return <SinSesion />;
  }

  function darDeAlta() {
    if (!form.nombre.trim() || !form.especialidad.trim()) return;
    store.agregarBarbero({ ...form, nombre: form.nombre.trim(), especialidad: form.especialidad.trim() });
    setForm(formInicial);
    setMostrarForm(false);
  }

  return (
    <PanelShell sesion={sesion} activo="Equipo de barberos" onLogout={store.logout}>
      <header className="anim-in mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker">Equipo</p>
          <h1 className="font-display text-2xl font-bold tracking-tight">Equipo de barberos</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
            Da de alta barberos y activa o desactiva su disponibilidad para agendar.
          </p>
        </div>
        <button
          onClick={() => setMostrarForm((v) => !v)}
          className="card-hover flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-600 to-accent-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md"
        >
          {mostrarForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {mostrarForm ? "Cancelar" : "Dar de alta"}
        </button>
      </header>

      {mostrarForm && (
        <section className="anim-pop mb-6 rounded-3xl p-6 shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10" style={{ background: "var(--card)" }}>
          <h2 className="mb-4 font-semibold">Nuevo barbero</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <input
              value={form.nombre}
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
              placeholder="Nombre (ej. Iván Rosales)"
              className="rounded-xl border border-slate-300/70 bg-transparent px-4 py-2.5 text-sm outline-none focus:border-accent-500 dark:border-white/15"
            />
            <input
              value={form.especialidad}
              onChange={(e) => setForm((f) => ({ ...f, especialidad: e.target.value }))}
              placeholder="Especialidad (ej. Fades y diseño de barba)"
              className="rounded-xl border border-slate-300/70 bg-transparent px-4 py-2.5 text-sm outline-none focus:border-accent-500 dark:border-white/15"
            />
            <input
              type="number"
              min={0}
              value={form.precio_servicio}
              onChange={(e) => setForm((f) => ({ ...f, precio_servicio: Number(e.target.value) }))}
              placeholder="Precio del servicio"
              className="rounded-xl border border-slate-300/70 bg-transparent px-4 py-2.5 text-sm outline-none focus:border-accent-500 dark:border-white/15"
            />
            <select
              value={form.duracion_cita_min}
              onChange={(e) => setForm((f) => ({ ...f, duracion_cita_min: Number(e.target.value) }))}
              className="rounded-xl border border-slate-300/70 bg-transparent px-4 py-2.5 text-sm outline-none focus:border-accent-500 dark:border-white/15"
            >
              {[15, 20, 30, 45, 60].map((d) => (
                <option key={d} value={d}>
                  {d} minutos
                </option>
              ))}
            </select>
            <textarea
              value={form.biografia}
              onChange={(e) => setForm((f) => ({ ...f, biografia: e.target.value }))}
              placeholder="Biografía breve (opcional)"
              rows={2}
              className="rounded-xl border border-slate-300/70 bg-transparent px-4 py-2.5 text-sm outline-none focus:border-accent-500 dark:border-white/15 sm:col-span-2"
            />
            <button
              onClick={() => setForm((f) => ({ ...f, acepta_domicilio: !f.acepta_domicilio }))}
              className={`flex items-center justify-between rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors sm:col-span-2 ${
                form.acepta_domicilio
                  ? "border-accent-500 bg-accent-100/50 text-accent-600 dark:bg-accent-500/10"
                  : "border-slate-200 dark:border-white/10"
              }`}
            >
              <span className="flex items-center gap-2">
                <Home className="h-4 w-4" /> Ofrece servicio a domicilio
              </span>
              <span
                className={`relative h-6 w-11 shrink-0 rounded-full ring-1 ring-inset transition-colors ${
                  form.acepta_domicilio
                    ? "bg-gradient-to-r from-brand-600 to-accent-500 ring-transparent"
                    : "bg-slate-300 ring-slate-300 dark:bg-white/15 dark:ring-white/15"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow ring-1 ring-black/5 transition-transform ${
                    form.acepta_domicilio ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </span>
            </button>
          </div>
          <button
            onClick={darDeAlta}
            disabled={!form.nombre.trim() || !form.especialidad.trim()}
            className="card-hover mt-4 rounded-xl bg-gradient-to-r from-brand-600 to-accent-500 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            Guardar barbero
          </button>
        </section>
      )}

      <section className="anim-in anim-d1 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {conStats.map((m) => (
          <article
            key={m.id}
            className={`card-hover rounded-3xl p-5 shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10 ${!m.activo ? "opacity-60" : ""}`}
            style={{ background: "var(--card)" }}
          >
            <div className="mb-3 flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-accent-500 text-sm font-semibold text-white">
                {m.nombre.replace(/^Dra?\.\s*/, "").charAt(0)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{m.nombre}</p>
                <p className="truncate text-xs" style={{ color: "var(--ink-muted)" }}>{m.especialidad}</p>
              </div>
            </div>
            <dl className="mb-4 grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-xs" style={{ color: "var(--ink-muted)" }}>Citas</dt>
                <dd className="font-semibold">{m.citas}</dd>
              </div>
              <div>
                <dt className="text-xs" style={{ color: "var(--ink-muted)" }}>Ingresos</dt>
                <dd className="font-semibold">{mxn.format(m.ingresos)}</dd>
              </div>
            </dl>
            <button
              onClick={() => store.toggleActivoBarbero(m.id)}
              className={`w-full rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                m.activo
                  ? "btn-danger-ghost"
                  : "bg-gradient-to-r from-brand-600 to-accent-500 text-white"
              }`}
            >
              {m.activo ? "Desactivar" : "Reactivar"}
            </button>
          </article>
        ))}
      </section>
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
