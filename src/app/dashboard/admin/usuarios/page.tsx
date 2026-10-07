"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Crown, KeyRound, Loader2, Scissors, ShieldCheck, Trash2, User, UserPlus, Users, X } from "lucide-react";
import { PanelShell } from "@/components/shell/PanelShell";
import { EmptyState, Metric, ModulePanel, ModuleTabs, SinAcceso, numero } from "@/components/panel/ModuleUI";
import { useBarberia, type Rol } from "@/lib/store";

type Cuenta = {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
  principal: boolean;
  creado_en: string;
  ultimo_acceso: string | null;
  puede_cambiar_clave: boolean;
  puede_eliminar: boolean;
};

type Filtro = "todos" | Rol;

const ETIQUETA: Record<Rol, string> = { admin: "Administrador", barbero: "Barbero", cliente: "Cliente" };
const ICONO: Record<Rol, React.ReactNode> = {
  admin: <ShieldCheck className="h-4 w-4" />,
  barbero: <Scissors className="h-4 w-4" />,
  cliente: <User className="h-4 w-4" />,
};

async function llamar(metodo: "GET" | "POST" | "PATCH" | "DELETE", body?: unknown, query = "") {
  const res = await fetch(`/api/admin/usuarios${query}`, {
    method: metodo,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const cuerpo = (await res.json().catch(() => ({}))) as {
    error?: string;
    usuarios?: Cuenta[];
    yo?: { id: string; principal: boolean };
  };
  if (!res.ok) throw new Error(cuerpo.error ?? "No se pudo completar la acción.");
  return cuerpo;
}

const formVacio = {
  tipo: "cliente" as Rol,
  nombre: "",
  email: "",
  password: "",
  telefono: "",
  especialidad: "",
  precio_servicio: 0,
  duracion_cita_min: 30,
};

/** Contraseña inicial legible para dictarla o mandarla por WhatsApp. */
function sugerirClave() {
  const letras = "abcdefghjkmnpqrstuvwxyz";
  const n = () => letras[Math.floor(Math.random() * letras.length)];
  return `Cort${n()}${n()}${n()}${Math.floor(1000 + Math.random() * 9000)}`;
}

/**
 * Usuarios: alta, contraseña y baja de todas las cuentas. El administrador
 * principal gestiona además a los otros administradores; el resto de los
 * administradores sólo a clientes y barberos. El servidor aplica las mismas
 * reglas: la interfaz sólo esconde lo que de todos modos sería rechazado.
 */
export default function UsuariosPage() {
  const store = useBarberia();
  const { listo, sesion } = store;
  const [cuentas, setCuentas] = useState<Cuenta[] | null>(null);
  const [principal, setPrincipal] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busqueda, setBusqueda] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [form, setForm] = useState(formVacio);
  const [guardando, setGuardando] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const r = await llamar("GET");
      setCuentas(r.usuarios ?? []);
      setPrincipal(Boolean(r.yo?.principal));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los usuarios.");
      setCuentas([]);
    }
  }, []);

  const esAdmin = sesion?.rol === "admin";
  useEffect(() => {
    if (esAdmin) void cargar();
  }, [esAdmin, cargar]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return (cuentas ?? []).filter(
      (c) =>
        (filtro === "todos" || c.rol === filtro) &&
        (!q || c.nombre.toLowerCase().includes(q) || c.email.toLowerCase().includes(q))
    );
  }, [cuentas, filtro, busqueda]);

  const cuenta = (rol: Rol) => (cuentas ?? []).filter((c) => c.rol === rol).length;

  if (!listo) return null;
  if (!sesion || !esAdmin) return <SinAcceso mensaje="Inicia sesión como administrador para ver este módulo" />;

  const tipos: Rol[] = principal ? ["cliente", "barbero", "admin"] : ["cliente", "barbero"];

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    setAviso(null);
    try {
      await llamar("POST", {
        tipo: form.tipo,
        nombre: form.nombre.trim(),
        email: form.email.trim(),
        password: form.password,
        telefono: form.telefono.trim(),
        barbero:
          form.tipo === "barbero"
            ? {
                especialidad: form.especialidad.trim(),
                precio_servicio: form.precio_servicio,
                duracion_cita_min: form.duracion_cita_min,
              }
            : undefined,
      });
      await Promise.all([cargar(), store.recargar()]);
      setAviso(
        `Listo: ${form.nombre.trim()} (${ETIQUETA[form.tipo].toLowerCase()}) ya puede entrar con ${form.email.trim()} y la contraseña ${form.password}`
      );
      setForm({ ...formVacio, tipo: form.tipo });
      setAbierto(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la cuenta.");
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarClave(c: Cuenta) {
    const password = window.prompt(`Nueva contraseña para ${c.nombre} (mínimo 8 caracteres):`, sugerirClave());
    if (!password) return;
    setError(null);
    setAviso(null);
    setOcupado(c.id);
    try {
      await llamar("PATCH", { id: c.id, password });
      setAviso(`Contraseña de ${c.nombre} actualizada: ${password}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar la contraseña.");
    } finally {
      setOcupado(null);
    }
  }

  async function eliminar(c: Cuenta) {
    if (!window.confirm(`¿Eliminar la cuenta de ${c.nombre} (${c.email})? Ya no podrá iniciar sesión. Esta acción no se puede deshacer.`)) return;
    setError(null);
    setAviso(null);
    setOcupado(c.id);
    try {
      await llamar("DELETE", undefined, `?id=${encodeURIComponent(c.id)}`);
      await Promise.all([cargar(), store.recargar()]);
      setAviso(`Se eliminó la cuenta de ${c.nombre}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar la cuenta.");
    } finally {
      setOcupado(null);
    }
  }

  const campo =
    "w-full rounded-xl border border-white/15 bg-transparent px-4 py-2.5 text-sm outline-none focus:border-accent-500";

  return (
    <PanelShell sesion={sesion} activo="Usuarios" onLogout={store.logout}>
      <header className="anim-in mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker">Accesos</p>
          <h1 className="font-display text-2xl font-bold tracking-tight">Usuarios</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
            {principal
              ? "Como administrador principal puedes crear clientes, barberos y administradores, y eliminar cualquier cuenta excepto la tuya."
              : "Puedes crear y eliminar clientes y barberos. Los administradores sólo los gestiona el administrador principal."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setAbierto((v) => !v);
            setForm((f) => ({ ...f, password: f.password || sugerirClave() }));
          }}
          className="btn-gold px-5 py-2.5 text-sm"
        >
          {abierto ? <X className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
          {abierto ? "Cancelar" : "Nuevo usuario"}
        </button>
      </header>

      {error && (
        <p className="mb-4 rounded-xl px-4 py-3 text-sm ring-1 ring-red-500/30" style={{ color: "#f0a59c" }} role="alert">
          {error}
        </p>
      )}
      {aviso && (
        <p className="mb-4 rounded-xl px-4 py-3 text-sm ring-1 ring-emerald-500/30" role="status">
          {aviso}
        </p>
      )}

      {abierto && (
        <form onSubmit={crear} className="anim-pop mb-6">
          <ModulePanel titulo="Nuevo usuario" descripcion="La cuenta queda lista para entrar de inmediato, sin confirmar correo.">
            <div className="mb-4 flex flex-wrap gap-2" role="radiogroup" aria-label="Tipo de cuenta">
              {tipos.map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={form.tipo === t}
                  onClick={() => setForm((f) => ({ ...f, tipo: t }))}
                  className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                    form.tipo === t ? "border-accent-500 bg-accent-500 text-[#120802]" : "border-white/15 hover:border-accent-500"
                  }`}
                >
                  {ICONO[t]} {ETIQUETA[t]}
                </button>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-xs" style={{ color: "var(--ink-muted)" }}>
                Nombre completo
                <input className={campo} value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} required minLength={2} />
              </label>
              <label className="grid gap-1 text-xs" style={{ color: "var(--ink-muted)" }}>
                Correo (con este inicia sesión)
                <input className={campo} type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required autoComplete="off" />
              </label>
              <label className="grid gap-1 text-xs" style={{ color: "var(--ink-muted)" }}>
                Contraseña inicial (mín. 8)
                <input className={campo} type="text" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required minLength={8} autoComplete="new-password" />
              </label>
              {form.tipo === "cliente" && (
                <label className="grid gap-1 text-xs" style={{ color: "var(--ink-muted)" }}>
                  Teléfono (opcional)
                  <input className={campo} type="tel" value={form.telefono} onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))} />
                </label>
              )}
              {form.tipo === "barbero" && (
                <>
                  <label className="grid gap-1 text-xs" style={{ color: "var(--ink-muted)" }}>
                    Especialidad
                    <input className={campo} value={form.especialidad} onChange={(e) => setForm((f) => ({ ...f, especialidad: e.target.value }))} required placeholder="Ej. Fades y barba" />
                  </label>
                  <label className="grid gap-1 text-xs" style={{ color: "var(--ink-muted)" }}>
                    Precio base del servicio (MXN)
                    <input className={campo} type="number" min={0} value={form.precio_servicio} onChange={(e) => setForm((f) => ({ ...f, precio_servicio: Number(e.target.value) }))} />
                  </label>
                  <label className="grid gap-1 text-xs" style={{ color: "var(--ink-muted)" }}>
                    Duración de cita
                    <select className={campo} value={form.duracion_cita_min} onChange={(e) => setForm((f) => ({ ...f, duracion_cita_min: Number(e.target.value) }))}>
                      {[15, 20, 30, 45, 60].map((d) => (
                        <option key={d} value={d} className="bg-[#150d08]">
                          {d} minutos
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}
            </div>
            {form.tipo === "admin" && (
              <p className="mt-3 text-xs" style={{ color: "var(--ink-muted)" }}>
                Un administrador ve todo el panel y puede crear clientes y barberos, pero no gestionar a otros administradores.
              </p>
            )}
            <button type="submit" disabled={guardando} className="btn-gold mt-4 px-5 py-2.5 text-sm disabled:opacity-40">
              {guardando && <Loader2 className="h-4 w-4 animate-spin" />}
              Crear {ETIQUETA[form.tipo].toLowerCase()}
            </button>
          </ModulePanel>
        </form>
      )}

      <div className="metric-grid anim-in anim-d1 mb-6">
        <Metric icono={<Users />} label="Cuentas" valor={numero.format(cuentas?.length ?? 0)} />
        <Metric icono={<User />} label="Clientes" valor={numero.format(cuenta("cliente"))} />
        <Metric icono={<Scissors />} label="Barberos" valor={numero.format(cuenta("barbero"))} />
        <Metric icono={<ShieldCheck />} label="Administradores" valor={numero.format(cuenta("admin"))} />
      </div>

      <ModulePanel
        titulo="Todas las cuentas"
        extra={
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o correo"
            className="w-full max-w-xs rounded-xl border border-white/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-accent-500"
          />
        }
      >
        <div className="mb-4">
          <ModuleTabs<Filtro>
            valor={filtro}
            onChange={setFiltro}
            opciones={[
              { id: "todos", label: "Todos" },
              { id: "cliente", label: "Clientes" },
              { id: "barbero", label: "Barberos" },
              { id: "admin", label: "Administradores" },
            ]}
          />
        </div>

        {cuentas === null ? (
          <p className="flex items-center gap-2 text-sm" style={{ color: "var(--ink-muted)" }}>
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando cuentas…
          </p>
        ) : visibles.length === 0 ? (
          <EmptyState icono={<Users />}>No hay cuentas con ese filtro.</EmptyState>
        ) : (
          <ul className="divide-y divide-white/10">
            {visibles.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 py-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-500 font-semibold text-[#120802]">
                  {c.nombre.charAt(0).toUpperCase() || "?"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2 font-medium">
                    <span className="truncate">{c.nombre}</span>
                    {c.id === sesion.id && <span className="text-xs" style={{ color: "var(--ink-muted)" }}>(tú)</span>}
                    <span className="badge badge-gold">
                      {c.principal ? <Crown /> : ICONO[c.rol]} {c.principal ? "Administrador principal" : ETIQUETA[c.rol]}
                    </span>
                  </span>
                  <span className="block truncate text-xs" style={{ color: "var(--ink-muted)" }}>
                    {c.email}
                    {" · "}
                    {c.ultimo_acceso
                      ? `último acceso ${format(new Date(c.ultimo_acceso), "d MMM yyyy", { locale: es })}`
                      : "nunca ha entrado"}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  {c.puede_cambiar_clave && (
                    <button
                      type="button"
                      onClick={() => cambiarClave(c)}
                      disabled={ocupado === c.id}
                      className="flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium transition-colors hover:border-accent-500"
                    >
                      <KeyRound className="h-3.5 w-3.5" /> Contraseña
                    </button>
                  )}
                  {c.puede_eliminar && (
                    <button
                      type="button"
                      onClick={() => eliminar(c)}
                      disabled={ocupado === c.id}
                      className="btn-danger-ghost flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium"
                    >
                      {ocupado === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      Eliminar
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </ModulePanel>
    </PanelShell>
  );
}
