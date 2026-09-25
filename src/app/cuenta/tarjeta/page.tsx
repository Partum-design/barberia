"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarPlus, CheckCircle2, Gift, QrCode, Smartphone, User } from "lucide-react";
import { PanelShell } from "@/components/shell/PanelShell";
import { TarjetaLealtadVisual } from "@/components/lealtad/TarjetaLealtadVisual";
import { BotonGoogleWallet } from "@/components/lealtad/BotonGoogleWallet";
import { estadoTarjeta, solicitarPase } from "@/lib/lealtad";
import { nombreDelNegocio, useBarberia } from "@/lib/store";

// Nodo Cliente: su tarjeta de lealtad, con QR para el mostrador y el botón
// para llevarla en Google Wallet.
export default function MiTarjetaPage() {
  const store = useBarberia();
  const { listo, sesion, tarjetas, clientes, citas, recompensasConfig, canjes, barberiaConfig } = store;
  const { asegurarClienteDeSesion, marcarWalletGuardada } = store;

  // Todo cliente tiene tarjeta: si llegó por Google y nunca pasó por el
  // mostrador, se le emite aquí la primera vez que abre esta pantalla.
  useEffect(() => {
    if (listo && sesion?.rol === "cliente") asegurarClienteDeSesion(sesion);
  }, [listo, sesion, asegurarClienteDeSesion]);

  const tarjeta = tarjetas.find((t) => t.cliente_id === sesion?.id);
  const titular = clientes.find((c) => c.id === sesion?.id)?.nombre ?? sesion?.nombre ?? "";

  const estado = useMemo(
    () =>
      tarjeta
        ? estadoTarjeta({ tarjeta, titular, citas, config: recompensasConfig, canjes, negocio: barberiaConfig })
        : null,
    [tarjeta, titular, citas, recompensasConfig, canjes, barberiaConfig]
  );

  // Si ya la guardó en Wallet, al abrir esta pantalla se sincronizan sus
  // sellos (p. ej. tras una cita que el barbero marcó como asistida).
  const sincronizado = useRef(false);
  useEffect(() => {
    if (!estado || !tarjeta?.wallet_guardada_en || sincronizado.current) return;
    sincronizado.current = true;
    solicitarPase(estado.pase, true);
  }, [estado, tarjeta?.wallet_guardada_en]);

  const sellosRecientes = useMemo(
    () =>
      citas
        .filter((c) => c.cliente_id === sesion?.id && c.estado === "asistida")
        .sort((a, b) => b.inicio.localeCompare(a.inicio))
        .slice(0, 8),
    [citas, sesion?.id]
  );

  if (!listo) return null;

  if (!sesion || sesion.rol !== "cliente") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <User className="h-8 w-8 text-accent-500" />
        <p className="anim-in text-lg font-semibold">Inicia sesión para ver tu tarjeta de lealtad</p>
        <Link href="/login?next=/cuenta/tarjeta" className="btn-gold anim-in anim-d1 rounded-full px-6 py-2.5 text-sm">
          Iniciar sesión
        </Link>
      </main>
    );
  }

  return (
    <PanelShell sesion={sesion} activo="Mi tarjeta" onLogout={store.logout}>
      <header className="anim-in mb-6">
        <p className="kicker">Programa de lealtad</p>
        <h1 className="font-display text-2xl font-bold tracking-tight">Mi tarjeta</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
          Muéstrala en mostrador o llévala en Google Wallet. Cada visita suma un sello.
        </p>
      </header>

      {tarjeta && estado ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,28rem)_1fr]">
          <section className="anim-in anim-d1 grid content-start gap-4">
            <TarjetaLealtadVisual
              negocio={nombreDelNegocio(barberiaConfig)}
              titular={titular}
              numero={tarjeta.numero}
              progreso={estado.lealtad.progreso}
              requerido={estado.lealtad.requerido}
              disponibles={estado.disponibles}
              descuento={recompensasConfig.valor_descuento}
              suspendida={tarjeta.estado === "suspendida"}
            />
            {tarjeta.estado === "activa" ? (
              <BotonGoogleWallet pase={estado.pase} onGuardada={() => marcarWalletGuardada(tarjeta.id)} />
            ) : (
              <p className="wallet-note is-error">
                Tu tarjeta está suspendida. Acércate al mostrador para reactivarla.
              </p>
            )}
            {tarjeta.wallet_guardada_en && (
              <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
                Guardada en Google Wallet el{" "}
                {format(new Date(tarjeta.wallet_guardada_en), "d 'de' MMMM, yyyy", { locale: es })}.
              </p>
            )}
          </section>

          <section className="anim-in anim-d2 grid content-start gap-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Dato icono={<CheckCircle2 className="h-4 w-4" />} label="Sellos totales" valor={String(estado.lealtad.puntos)} />
              <Dato icono={<Gift className="h-4 w-4" />} label="Recompensas listas" valor={String(estado.disponibles)} />
              <Dato icono={<QrCode className="h-4 w-4" />} label="Faltan" valor={`${estado.lealtad.faltan} sello${estado.lealtad.faltan === 1 ? "" : "s"}`} />
            </div>

            <div className="rounded-3xl p-5 text-sm shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10" style={{ background: "var(--card)" }}>
              <h2 className="mb-3 font-semibold">Cómo funciona</h2>
              <ul className="space-y-2.5" style={{ color: "var(--ink-muted)" }}>
                <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent-500" /> Cada visita suma un sello, reserves en línea o llegues directo.</li>
                <li className="flex gap-2"><Gift className="mt-0.5 h-4 w-4 shrink-0 text-accent-500" /> Con {estado.lealtad.requerido} sellos ganas {recompensasConfig.valor_descuento}% de descuento en tu siguiente servicio.</li>
                <li className="flex gap-2"><Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-accent-500" /> En Google Wallet la tarjeta se actualiza sola cuando sumas sellos.</li>
                <li className="flex gap-2"><QrCode className="mt-0.5 h-4 w-4 shrink-0 text-accent-500" /> En mostrador basta con mostrar el código QR o dictar el número {tarjeta.numero}.</li>
              </ul>
              <Link href="/cuenta/recompensas" className="mt-4 inline-block text-sm font-medium text-accent-600">
                Canjear recompensas →
              </Link>
            </div>

            <div className="rounded-3xl p-5 text-sm shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10" style={{ background: "var(--card)" }}>
              <h2 className="mb-3 font-semibold">Últimas visitas</h2>
              {sellosRecientes.length === 0 ? (
                <div className="text-center" style={{ color: "var(--ink-muted)" }}>
                  <p>Aún no hay visitas registradas.</p>
                  <Link href="/reservar" className="btn-gold mt-3 inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm">
                    <CalendarPlus className="h-4 w-4" /> Reservar mi primera cita
                  </Link>
                </div>
              ) : (
                <ul className="space-y-2">
                  {sellosRecientes.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-3">
                      <span>{c.barbero_nombre}</span>
                      <span className="text-xs" style={{ color: "var(--ink-muted)" }}>
                        {format(new Date(c.inicio), "d MMM yyyy", { locale: es })} · +1 sello
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {tarjeta.sellos_extra > 0 && (
                <p className="mt-3 text-xs" style={{ color: "var(--ink-muted)" }}>
                  Además, {tarjeta.sellos_extra} sello{tarjeta.sellos_extra === 1 ? "" : "s"} registrado{tarjeta.sellos_extra === 1 ? "" : "s"} en mostrador.
                </p>
              )}
            </div>
          </section>
        </div>
      ) : (
        <p className="text-sm" style={{ color: "var(--ink-muted)" }}>Emitiendo tu tarjeta…</p>
      )}
    </PanelShell>
  );
}

function Dato({ icono, label, valor }: { icono: React.ReactNode; label: string; valor: string }) {
  return (
    <div className="metric-card">
      <span>
        {icono}
        {label}
      </span>
      <strong>{valor}</strong>
    </div>
  );
}
