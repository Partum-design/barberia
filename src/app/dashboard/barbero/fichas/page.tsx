"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ClipboardList, FileText, Scissors, Search } from "lucide-react";
import { PanelShell } from "@/components/shell/PanelShell";
import { useDemoStore } from "@/lib/demo-store";

// Nodo Barbero: ficha básica por cliente — historial de servicios y
// preferencias de corte capturadas tras cada visita. Vive en el almacén local de la demo.
export default function FichasPage() {
  const store = useDemoStore();
  const { listo, citas, sesion, fichas } = store;
  const [busqueda, setBusqueda] = useState("");
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [servicio, setServicio] = useState("");
  const [notas, setNotas] = useState("");

  const clientes = useMemo(() => {
    if (!sesion) return [];
    const propias = citas.filter((c) => c.barbero_id === sesion.id);
    const mapa = new Map<string, { id: string; nombre: string; citas: number; ultima: string }>();
    propias.forEach((c) => {
      const actual = mapa.get(c.cliente_id);
      if (!actual || c.inicio > actual.ultima) {
        mapa.set(c.cliente_id, {
          id: c.cliente_id,
          nombre: c.cliente_nombre,
          citas: (actual?.citas ?? 0) + 1,
          ultima: c.inicio,
        });
      } else {
        mapa.set(c.cliente_id, { ...actual, citas: actual.citas + 1 });
      }
    });
    return Array.from(mapa.values())
      .filter((p) => p.nombre.toLowerCase().includes(busqueda.toLowerCase()))
      .sort((a, b) => b.ultima.localeCompare(a.ultima));
  }, [citas, sesion, busqueda]);

  const seleccionado = clientes.find((p) => p.id === clienteId) ?? clientes[0] ?? null;

  const historialSeleccionado = useMemo(
    () =>
      fichas
        .filter((e) => e.cliente_id === seleccionado?.id && e.barbero_id === sesion?.id)
        .sort((a, b) => b.creado_en.localeCompare(a.creado_en)),
    [fichas, seleccionado, sesion]
  );

  if (!listo) return null;

  if (!sesion || sesion.rol !== "barbero") {
    return <SinSesion />;
  }

  function agregarNota() {
    if (!seleccionado || !sesion || !servicio.trim()) return;
    store.agregarFicha({
      cliente_id: seleccionado.id,
      cliente_nombre: seleccionado.nombre,
      barbero_id: sesion.id,
      servicio: servicio.trim(),
      notas: notas.trim(),
    });
    setServicio("");
    setNotas("");
  }

  return (
    <PanelShell sesion={sesion} activo="Fichas" onLogout={store.logout}>
      <header className="anim-in mb-6">
        <p className="kicker">Clientes</p>
        <h1 className="font-display text-2xl font-bold tracking-tight">Fichas</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
          Historial de servicio de tus clientes: cortes, estilos y preferencias por visita.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Lista de clientes */}
        <section className="anim-in anim-d1 lg:col-span-1">
          <div className="mb-3 flex items-center gap-2 rounded-xl px-3 py-2 shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10" style={{ background: "var(--card)" }}>
            <Search className="h-4 w-4" style={{ color: "var(--ink-muted)" }} />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar cliente…"
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
          <div className="space-y-2">
            {clientes.length === 0 && (
              <p className="rounded-2xl border border-dashed border-brand-500/30 p-6 text-center text-sm" style={{ color: "var(--ink-muted)" }}>
                Aún no tienes clientes con citas registradas.
              </p>
            )}
            {clientes.map((p) => (
              <button
                key={p.id}
                onClick={() => setClienteId(p.id)}
                className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left shadow-sm ring-1 transition-colors ${
                  seleccionado?.id === p.id
                    ? "ring-accent-500 bg-accent-100/50 dark:bg-accent-500/10"
                    : "ring-slate-900/5 dark:ring-white/10"
                }`}
                style={seleccionado?.id === p.id ? undefined : { background: "var(--card)" }}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-accent-500 text-sm font-semibold text-white">
                  {p.nombre.charAt(0)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.nombre}</p>
                  <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
                    {p.citas} {p.citas === 1 ? "cita" : "citas"} · última{" "}
                    {format(new Date(p.ultima), "d MMM", { locale: es })}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Detalle del cliente seleccionado */}
        <section className="anim-in anim-d2 lg:col-span-2">
          {!seleccionado ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-brand-500/30 py-16 text-center" style={{ background: "var(--card)" }}>
              <ClipboardList className="h-8 w-8 text-accent-500" />
              <p className="font-medium">Elige un cliente para ver su ficha</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-3xl p-5 shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10" style={{ background: "var(--card)" }}>
                <div className="mb-4 flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-accent-500 text-lg font-semibold text-white">
                    {seleccionado.nombre.charAt(0)}
                  </span>
                  <div>
                    <p className="font-semibold">{seleccionado.nombre}</p>
                    <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
                      {seleccionado.citas} {seleccionado.citas === 1 ? "visita registrada" : "visitas registradas"}
                    </p>
                  </div>
                </div>

                <p className="mb-2 text-xs font-medium" style={{ color: "var(--ink-muted)" }}>
                  Nueva entrada
                </p>
                <div className="space-y-2">
                  <input
                    value={servicio}
                    onChange={(e) => setServicio(e.target.value)}
                    placeholder="Servicio realizado (p. ej. Corte + barba)"
                    className="w-full rounded-xl border border-slate-300/70 bg-transparent px-4 py-2.5 text-sm outline-none focus:border-accent-500 dark:border-white/15"
                  />
                  <textarea
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                    placeholder="Preferencias de estilo (opcional)"
                    rows={3}
                    className="w-full rounded-xl border border-slate-300/70 bg-transparent px-4 py-2.5 text-sm outline-none focus:border-accent-500 dark:border-white/15"
                  />
                  <button
                    onClick={agregarNota}
                    disabled={!servicio.trim()}
                    className="card-hover rounded-xl bg-gradient-to-r from-brand-600 to-accent-500 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-40"
                  >
                    Guardar en ficha
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <h2 className="flex items-center gap-2 font-semibold">
                  <FileText className="h-4 w-4 text-accent-500" /> Historial
                </h2>
                {historialSeleccionado.length === 0 && (
                  <p className="rounded-2xl border border-dashed border-brand-500/30 p-6 text-center text-sm" style={{ color: "var(--ink-muted)" }}>
                    Sin entradas todavía.
                  </p>
                )}
                {historialSeleccionado.map((e) => (
                  <article key={e.id} className="card-hover rounded-2xl p-4 shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10" style={{ background: "var(--card)" }}>
                    <div className="mb-1.5 flex items-center justify-between">
                      <p className="font-medium">{e.servicio}</p>
                      <span className="text-xs" style={{ color: "var(--ink-muted)" }}>
                        {format(new Date(e.creado_en), "d MMM yyyy", { locale: es })}
                      </span>
                    </div>
                    {e.notas && (
                      <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
                        {e.notas}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </PanelShell>
  );
}

function SinSesion() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <Scissors className="h-8 w-8 text-accent-500" />
      <p className="anim-in text-lg font-semibold">Inicia sesión como barbero para ver este panel</p>
      <Link
        href="/login"
        className="anim-in anim-d1 rounded-full bg-gradient-to-r from-brand-600 to-accent-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md"
      >
        Entrar a la demo
      </Link>
    </main>
  );
}
