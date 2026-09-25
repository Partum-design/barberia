"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Home, KeyRound, Loader2, Plus, ShieldCheck, UserPlus, X } from "lucide-react";
import { PanelShell } from "@/components/shell/PanelShell";
import { useBarberia } from "@/lib/store";

const mxn = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

const formInicial = {
  nombre: "",
  email: "",
  password: "",
  especialidad: "",
  precio_servicio: 800,
  duracion_cita_min: 30,
  acepta_domicilio: true,
  biografia: "",
};

type Cuenta = { id: string; email: string; nombre: string; rol: "admin" | "barbero" | "cliente"; ultimo_acceso: string | null };

async function llamar(metodo: "GET" | "POST" | "PATCH", body?: unknown) {
  const res = await fetch("/api/admin/usuarios", {
    method: metodo,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const cuerpo = (await res.json().catch(() => ({}))) as { error?: string; usuarios?: Cuenta[] };
  if (!res.ok) throw new Error(cuerpo.error ?? "No se pudo completar la acción.");
  return cuerpo;
}

// Nodo Administrador: alta y gestión del equipo de barberos de la barbería.
// Cada alta crea también la cuenta con la que el barbero inicia sesión.
export default function EquipoBarberoPage() {
  const store = useBarberia();
  const { listo, sesion, barberos, citas } = store;
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState(formInicial);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const esAdmin = sesion?.rol === "admin";

  const cargarCuentas = useCallback(async () => {
    try {
      setCuentas((await llamar("GET")).usuarios ?? []);
    } catch {
      /* la lista es informativa; los errores se ven al actuar */
    }
  }, []);

  useEffect(() => {
    if (esAdmin) void cargarCuentas();
  }, [esAdmin, cargarCuentas]);

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

  const correoDe = (id: string) => cuentas.find((c) => c.id === id)?.email;

  async function darDeAlta() {
    if (!form.nombre.trim() || !form.especialidad.trim()) return;
    setGuardando(true);
    setError(null);
    setAviso(null);
    try {
      const { email, password, ...perfil } = form;
      await llamar("POST", {
        tipo: "barbero",
        nombre: form.nombre.trim(),
        email,
        password,
        barbero: { ...perfil, especialidad: form.especialidad.trim() },
      });
      await Promise.all([store.recargar(), cargarCuentas()]);
      setAviso(`Listo: ${form.nombre.trim()} ya puede entrar con ${email.trim()} y la contraseña que le asignaste.`);
      setForm(formInicial);
      setMostrarForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo dar de alta.");
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarClave(id: string, nombre: string) {
    const password = window.prompt(`Nueva contraseña para ${nombre} (mínimo 8 caracteres):`);
    if (!password) return;
    setError(null);
    setAviso(null);
    try {
      await llamar("PATCH", { id, password });
      setAviso(`Contraseña de ${nombre} actualizada.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar la contraseña.");
    }
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

      {error && (
        <p className="mb-4 rounded-xl px-4 py-3 text-sm ring-1 ring-red-500/30" style={{ color: "var(--ox, #b4533c)" }} role="alert">
          {error}
        </p>
      )}
      {aviso && (
        <p className="mb-4 rounded-xl px-4 py-3 text-sm ring-1 ring-emerald-500/30" role="status">
          {aviso}
        </p>
      )}

      {mostrarForm && (
        <section className="anim-pop mb-6 rounded-3xl p-6 shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10" style={{ background: "var(--card)" }}>
          <h2 className="mb-4 font-semibold">Nuevo barbero</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <input
              value={form.nombre}
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
              placeholder="Nombre completo"
              className="rounded-xl border border-slate-300/70 bg-transparent px-4 py-2.5 text-sm outline-none focus:border-accent-500 dark:border-white/15"
            />
            <input
              value={form.especialidad}
              onChange={(e) => setForm((f) => ({ ...f, especialidad: e.target.value }))}
              placeholder="Especialidad (ej. Fades y diseño de barba)"
              className="rounded-xl border border-slate-300/70 bg-transparent px-4 py-2.5 text-sm outline-none focus:border-accent-500 dark:border-white/15"
            />
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="Correo para iniciar sesión"
              autoComplete="off"
              className="rounded-xl border border-slate-300/70 bg-transparent px-4 py-2.5 text-sm outline-none focus:border-accent-500 dark:border-white/15"
            />
            <input
              type="text"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="Contraseña inicial (mín. 8 caracteres)"
              autoComplete="new-password"
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
            disabled={
              guardando ||
              !form.nombre.trim() ||
              !form.especialidad.trim() ||
              !form.email.includes("@") ||
              form.password.length < 8
            }
            className="card-hover mt-4 flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-accent-500 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            {guardando && <Loader2 className="h-4 w-4 animate-spin" />}
            Crear barbero y su acceso
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
            <p className="mb-3 truncate text-xs" style={{ color: "var(--ink-muted)" }}>
              {correoDe(m.id) ?? "Sin cuenta de acceso"}
            </p>
            {correoDe(m.id) && (
              <button
                onClick={() => cambiarClave(m.id, m.nombre)}
                className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium transition-colors hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5"
              >
                <KeyRound className="h-4 w-4" /> Cambiar contraseña
              </button>
            )}
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

      <Administradores
        cuentas={cuentas.filter((c) => c.rol === "admin")}
        miId={sesion.id}
        onCreada={cargarCuentas}
        onCambiarClave={cambiarClave}
      />
    </PanelShell>
  );
}

/** Cuentas con acceso total al panel de administración. */
function Administradores({
  cuentas,
  miId,
  onCreada,
  onCambiarClave,
}: {
  cuentas: Cuenta[];
  miId: string;
  onCreada: () => Promise<void>;
  onCambiarClave: (id: string, nombre: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [form, setForm] = useState({ nombre: "", email: "", password: "" });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      await llamar("POST", { tipo: "admin", ...form });
      await onCreada();
      setForm({ nombre: "", email: "", password: "" });
      setAbierto(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la cuenta.");
    } finally {
      setGuardando(false);
    }
  }

  const campo = "rounded-xl border border-slate-300/70 bg-transparent px-4 py-2.5 text-sm outline-none focus:border-accent-500 dark:border-white/15";

  return (
    <section className="anim-in anim-d2 mt-8 rounded-3xl p-6 shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10" style={{ background: "var(--card)" }}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Administradores</h2>
          <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
            Tienen acceso completo: equipo, caja, clientes y configuración.
          </p>
        </div>
        <button
          onClick={() => setAbierto((v) => !v)}
          className="flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium dark:border-white/10"
        >
          {abierto ? <X className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
          {abierto ? "Cancelar" : "Nuevo administrador"}
        </button>
      </div>

      {abierto && (
        <form onSubmit={crear} className="mb-4 grid gap-3 sm:grid-cols-3">
          <input className={campo} placeholder="Nombre" value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} required minLength={2} />
          <input className={campo} type="email" placeholder="Correo" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required autoComplete="off" />
          <input className={campo} type="text" placeholder="Contraseña (mín. 8)" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required minLength={8} autoComplete="new-password" />
          {error && <p className="text-sm sm:col-span-3" style={{ color: "var(--ox, #b4533c)" }}>{error}</p>}
          <button type="submit" disabled={guardando} className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-accent-500 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40 sm:col-span-3 sm:justify-self-start">
            {guardando && <Loader2 className="h-4 w-4 animate-spin" />}
            Crear administrador
          </button>
        </form>
      )}

      <ul className="divide-y divide-slate-200/70 dark:divide-white/10">
        {cuentas.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
            <span className="min-w-0">
              <span className="block truncate font-medium">
                {c.nombre} {c.id === miId && <span className="text-xs" style={{ color: "var(--ink-muted)" }}>(tú)</span>}
              </span>
              <span className="block truncate text-xs" style={{ color: "var(--ink-muted)" }}>{c.email}</span>
            </span>
            <button onClick={() => onCambiarClave(c.id, c.nombre)} className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "var(--ink-muted)" }}>
              <KeyRound className="h-3.5 w-3.5" /> Cambiar contraseña
            </button>
          </li>
        ))}
      </ul>
    </section>
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
        Iniciar sesión
      </Link>
    </main>
  );
}
