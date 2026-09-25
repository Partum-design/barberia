"use client";

import Link from "next/link";
import { useMemo } from "react";
import { CalendarCheck, Clock3, Scissors, ShieldCheck } from "lucide-react";
import { FlujoReserva } from "@/components/booking/FlujoReserva";
import { useBarberia } from "@/lib/store";
import { MODO_LOCAL } from "@/lib/modo";
import { Marca } from "@/components/shell/Marca";

// Nodo Cliente: búsqueda de barberos + reserva con bloqueo de slot.
export default function ReservarPage() {
  const { listo, barberos } = useBarberia();
  const activos = useMemo(() => barberos.filter((m) => m.activo), [barberos]);

  return (
    <main className="booking-page">
      <header className="booking-hero anim-in">
        <nav className="booking-nav">
          <Link href="/" className="login-brand">
            <span className="login-brand-mark"><Scissors className="h-4 w-4" /></span>
            <Marca />
          </Link>
          <Link href="/" className="booking-back">Volver al inicio</Link>
        </nav>
        <div className="booking-hero-copy">
          <p className="login-kicker text-mint-raw">Reserva protegida</p>
          <h1>Tu cita, lista en pocos minutos.</h1>
          <p>Elige barbero y horario. Mantenemos tu espacio apartado mientras confirmas.</p>
        </div>
        <div className="booking-trust">
          <span><Clock3 className="h-4 w-4" /> Bloqueo de 10 minutos</span>
          <span><ShieldCheck className="h-4 w-4" /> Verificación segura</span>
          <span><CalendarCheck className="h-4 w-4" /> Confirmación inmediata</span>
        </div>
      </header>

      <section className="booking-layout">
        <aside className="booking-context anim-in anim-d1">
          <p className="login-kicker text-brand-700">Así funciona</p>
          <ol>
            <li><span>1</span><div><strong>Elige barbero</strong><small>Consulta precio, duración y modalidad.</small></div></li>
            <li><span>2</span><div><strong>Confirma tu identidad</strong><small>Protegemos la agenda contra reservas falsas.</small></div></li>
            <li><span>3</span><div><strong>Asegura tu horario</strong><small>Paga con tarjeta o al llegar a la barbería.</small></div></li>
          </ol>
        </aside>
        <div className="booking-panel anim-in anim-d2">
          {listo && <FlujoReserva barberos={activos} local={MODO_LOCAL} />}
        </div>
      </section>
    </main>
  );
}
