"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Ban,
  Gift,
  IdCard,
  Minus,
  Plus,
  RotateCcw,
  Search,
  Smartphone,
  Stamp,
  UserPlus,
} from "lucide-react";
import { PanelShell } from "@/components/shell/PanelShell";
import { EmptyState, Metric, ModulePanel, ShareBar, SinAcceso, numero } from "@/components/panel/ModuleUI";
import { TarjetaLealtadVisual } from "@/components/lealtad/TarjetaLealtadVisual";
import { BotonGoogleWallet } from "@/components/lealtad/BotonGoogleWallet";
import { estadoTarjeta, solicitarPase } from "@/lib/lealtad";
import { nombreDelNegocio, resumirClientes, useBarberia, type TarjetaLealtad } from "@/lib/store";

const CAMPO =
  "w-full rounded-xl border border-slate-300/70 bg-transparent px-3.5 py-2 text-sm outline-none focus:border-accent-500 dark:border-white/15";

/**
 * Mostrador del programa de lealtad: cada cliente tiene su tarjeta con número
 * y QR. Aquí se emiten, se ponen sellos a las visitas sin cita, se canjean
 * recompensas y se genera el pase de Google Wallet para mandarlo al cliente.
 */
export default function LealtadAdminPage() {
  const store = useBarberia();
  const { listo, sesion, clientes, tarjetas, citas, recompensasConfig, canjes, barberiaConfig } = store;

  const [busqueda, setBusqueda] = useState("");
  /** Cliente cuya tarjeta está desplegada */
  const [abierta, setAbierta] = useState<string | null>(null);
  const [form, setForm] = useState({ nombre: "", telefono: "", email: "" });

  const filas = useMemo(() => {
    return tarjetas
      .map((t) => {
        const cliente = clientes.find((c) => c.id === t.cliente_id);
        const titular = cliente?.nombre ?? "Cliente";
        return {
          tarjeta: t,
          cliente,
          titular,
          ...estadoTarjeta({ tarjeta: t, titular, citas, config: recompensasConfig, canjes, negocio: barberiaConfig }),
        };
      })
      .sort((a, b) => b.tarjeta.emitida_en.localeCompare(a.tarjeta.emitida_en));
  }, [tarjetas, clientes, citas, recompensasConfig, canjes, barberiaConfig]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase().replace(/\s+/g, "");
    if (!q) return filas;
    return filas.filter(
      (f) =>
        f.titular.toLowerCase().replace(/\s+/g, "").includes(q) ||
        f.tarjeta.numero.toLowerCase().replace(/-/g, "").includes(q.replace(/-/g, "")) ||
        (f.cliente?.telefono ?? "").replace(/\D/g, "").includes(q.replace(/\D/g, "") || "~")
    );
  }, [filas, busqueda]);

  // Clientes que ya reservaron pero todavía no tienen tarjeta (llegaron por
  // Google y no han abierto "Mi tarjeta").
  const sinTarjeta = useMemo(() => {
    const conTarjeta = new Set(tarjetas.map((t) => t.cliente_id));
    return resumirClientes(citas).filter((c) => !conTarjeta.has(c.id));
  }, [citas, tarjetas]);

  const totales = useMemo(
    () => ({
      emitidas: tarjetas.length,
      wallet: tarjetas.filter((t) => t.wallet_guardada_en).length,
      porCanjear: filas.reduce((s, f) => s + f.disponibles, 0),
      sellos: filas.reduce((s, f) => s + f.lealtad.puntos, 0),
    }),
    [tarjetas, filas]
  );

  if (!listo) return null;
  if (!sesion || sesion.rol !== "admin") return <SinAcceso mensaje="Este módulo es del administrador" />;

  const negocio = nombreDelNegocio(barberiaConfig);

  /** Si el cliente guardó la tarjeta en Wallet, le llega el cambio al teléfono. */
  function sincronizar(tarjeta: TarjetaLealtad, titular: string, canjesNuevos = canjes) {
    if (!tarjeta.wallet_guardada_en) return;
    const { pase } = estadoTarjeta({
      tarjeta,
      titular,
      citas,
      config: recompensasConfig,
      canjes: canjesNuevos,
      negocio: barberiaConfig,
    });
    solicitarPase(pase, true);
  }

  function emitir(e: React.FormEvent) {
    e.preventDefault();
    if (form.nombre.trim().length < 2) return;
    const cliente = store.registrarCliente(form);
    setForm({ nombre: "", telefono: "", email: "" });
    setBusqueda("");
    setAbierta(cliente.id);
  }

  return (
    <PanelShell sesion={sesion} activo="Tarjetas de lealtad" onLogout={store.logout}>
      <header className="anim-in mb-6">
        <p className="kicker">Programa de lealtad</p>
        <h1 className="font-display text-2xl font-bold tracking-tight">Tarjetas de lealtad</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
          Una tarjeta por cliente, con QR y pase para Google Wallet. Cada cita asistida pone un
          sello sola; aquí registras las visitas sin cita y los canjes.
        </p>
      </header>

      <div className="metric-grid anim-in anim-d1">
        <Metric icono={<IdCard />} label="Tarjetas emitidas" valor={numero.format(totales.emitidas)} />
        <Metric icono={<Smartphone />} label="En Google Wallet" valor={numero.format(totales.wallet)} />
        <Metric icono={<Stamp />} label="Sellos acumulados" valor={numero.format(totales.sellos)} />
        <Metric icono={<Gift />} label="Recompensas por canjear" valor={numero.format(totales.porCanjear)} nota={`${recompensasConfig.valor_descuento}% c/u`} />
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_20rem]">
        <ModulePanel
          titulo="Tarjetas"
          descripcion={`${visibles.length} de ${filas.length}`}
          extra={
            <label className="relative flex items-center">
              <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5" style={{ color: "var(--ink-faint)" }} />
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Nombre, teléfono o número"
                aria-label="Buscar tarjeta"
                className="w-52 rounded-full border py-1.5 pl-8 pr-3 text-xs"
              />
            </label>
          }
        >
          {visibles.length === 0 ? (
            <EmptyState icono={<IdCard />}>
              {filas.length === 0
                ? "Aún no hay tarjetas. Emite la primera con el formulario de la derecha."
                : "Ninguna tarjeta coincide con la búsqueda."}
            </EmptyState>
          ) : (
            <div className="grid gap-2">
              {visibles.map((f) => {
                const t = f.tarjeta;
                const abiertaEsta = abierta === t.cliente_id;
                return (
                  <article key={t.id} className="client-row flex-col items-stretch">
                    <div className="flex items-center gap-3">
                      <span className="client-avatar">{f.titular.charAt(0)}</span>
                      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setAbierta(abiertaEsta ? null : t.cliente_id)} aria-expanded={abiertaEsta}>
                        <p className="truncate text-sm font-semibold" style={{ color: "var(--ink)" }}>
                          {f.titular}
                          {t.estado === "suspendida" && <span className="badge badge-warm ml-2 align-middle">Suspendida</span>}
                          {t.wallet_guardada_en && <span className="badge badge-gold ml-2 align-middle"><Smartphone /> Wallet</span>}
                        </p>
                        <p className="mt-0.5 font-num text-[0.68rem]" style={{ color: "var(--ink-muted)" }}>
                          {t.numero}
                          {f.cliente?.telefono ? ` · ${f.cliente.telefono}` : ""}
                        </p>
                        <div className="mt-1.5 flex max-w-64 items-center gap-2">
                          <div className="flex-1">
                            <ShareBar valor={f.lealtad.progreso / f.lealtad.requerido} />
                          </div>
                          <span className="font-num text-[0.62rem]" style={{ color: "var(--gold)" }}>
                            {f.lealtad.progreso}/{f.lealtad.requerido}
                          </span>
                        </div>
                      </button>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          title="Quitar sello"
                          aria-label={`Quitar un sello a ${f.titular}`}
                          disabled={t.sellos_extra === 0 || t.estado === "suspendida"}
                          onClick={() => {
                            store.ajustarSellos(t.id, -1);
                            sincronizar({ ...t, sellos_extra: t.sellos_extra - 1 }, f.titular);
                          }}
                          className="grid h-8 w-8 place-items-center rounded-full border border-white/10 disabled:opacity-30"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Poner un sello a ${f.titular}`}
                          disabled={t.estado === "suspendida"}
                          onClick={() => {
                            store.ajustarSellos(t.id, 1);
                            sincronizar({ ...t, sellos_extra: t.sellos_extra + 1 }, f.titular);
                          }}
                          className="btn-gold flex h-8 items-center gap-1 rounded-full px-3 text-xs disabled:opacity-30"
                        >
                          <Plus className="h-3.5 w-3.5" /> Sello
                        </button>
                      </div>
                    </div>

                    {f.disponibles > 0 && (
                      <div className="mt-2 flex items-center justify-between gap-3 rounded-xl px-3 py-2" style={{ background: "rgb(230 197 118 / 0.08)" }}>
                        <span className="text-xs" style={{ color: "var(--gold)" }}>
                          <Gift className="mr-1 inline h-3.5 w-3.5" />
                          {f.disponibles} recompensa{f.disponibles === 1 ? "" : "s"} de {recompensasConfig.valor_descuento}% por canjear
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            store.canjearRecompensa(t.cliente_id, f.lealtad.recompensasGanadas);
                            sincronizar(t, f.titular, { ...canjes, [t.cliente_id]: f.canjeadas + 1 });
                          }}
                          className="rounded-full border border-accent-500/40 px-3 py-1 text-xs font-medium text-accent-600"
                        >
                          Canjear una
                        </button>
                      </div>
                    )}

                    {abiertaEsta && (
                      <div className="mt-3 grid gap-4 border-t border-white/10 pt-4 md:grid-cols-[22rem_1fr]">
                        <TarjetaLealtadVisual
                          compacta
                          negocio={negocio}
                          titular={f.titular}
                          numero={t.numero}
                          progreso={f.lealtad.progreso}
                          requerido={f.lealtad.requerido}
                          disponibles={f.disponibles}
                          descuento={recompensasConfig.valor_descuento}
                          suspendida={t.estado === "suspendida"}
                        />
                        <div className="grid content-start gap-3 text-xs" style={{ color: "var(--ink-muted)" }}>
                          <p>
                            Emitida el {format(new Date(t.emitida_en), "d 'de' MMMM, yyyy", { locale: es })} ·{" "}
                            {f.lealtad.puntos} sellos en total ({t.sellos_extra} en mostrador) · {f.canjeadas} canjeada{f.canjeadas === 1 ? "" : "s"}
                          </p>
                          {t.estado === "activa" && (
                            <BotonGoogleWallet
                              variante="enlace"
                              pase={f.pase}
                              onGuardada={() => store.marcarWalletGuardada(t.id)}
                            />
                          )}
                          <button
                            type="button"
                            onClick={() => store.cambiarEstadoTarjeta(t.id, t.estado === "activa" ? "suspendida" : "activa")}
                            className="flex w-fit items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5"
                          >
                            {t.estado === "activa" ? <Ban className="h-3.5 w-3.5" /> : <RotateCcw className="h-3.5 w-3.5" />}
                            {t.estado === "activa" ? "Suspender tarjeta" : "Reactivar tarjeta"}
                          </button>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </ModulePanel>

        <div className="grid content-start gap-6">
          <ModulePanel titulo="Emitir tarjeta" descripcion="Alta de cliente en mostrador">
            <form onSubmit={emitir} className="grid gap-2.5">
              <input
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Nombre completo"
                className={CAMPO}
                required
              />
              <input
                value={form.telefono}
                onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                placeholder="Teléfono / WhatsApp"
                type="tel"
                className={CAMPO}
              />
              <input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="Correo (opcional)"
                type="email"
                className={CAMPO}
              />
              <button type="submit" className="btn-gold flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm">
                <UserPlus className="h-4 w-4" /> Emitir tarjeta
              </button>
            </form>
          </ModulePanel>

          {sinTarjeta.length > 0 && (
            <ModulePanel titulo="Clientes sin tarjeta" descripcion="Ya reservaron, falta emitirla">
              <ul className="grid gap-2">
                {sinTarjeta.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate">{c.nombre}</span>
                    <button
                      type="button"
                      onClick={() => store.registrarCliente({ id: c.id, nombre: c.nombre, telefono: "", email: "" })}
                      className="shrink-0 rounded-full border border-accent-500/40 px-3 py-1 text-xs text-accent-600"
                    >
                      Emitir
                    </button>
                  </li>
                ))}
              </ul>
            </ModulePanel>
          )}
        </div>
      </div>
    </PanelShell>
  );
}
