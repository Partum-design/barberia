"use client";

import Link from "next/link";
import { Banknote, CalendarCheck, Clock3, Scissors } from "lucide-react";
import { FlujoReserva } from "@/components/booking/FlujoReserva";
import { useBarberia } from "@/lib/store";
import { Marca } from "@/components/shell/Marca";

// Nodo Cliente: elección de barbero y horario con disponibilidad real.
export default function ReservarPage() {
  const { listo } = useBarberia();

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
          <p className="login-kicker text-mint-raw">Reserva en línea</p>
          <h1>Tu cita, lista en pocos minutos.</h1>
          <p>Elige barbero y horario. Sólo verás horas con un barbero disponible.</p>
        </div>
        <div className="booking-trust">
          <span><Clock3 className="h-4 w-4" /> Disponibilidad en tiempo real</span>
          <span><Banknote className="h-4 w-4" /> Pagas en la barbería</span>
          <span><CalendarCheck className="h-4 w-4" /> Confirmación inmediata</span>
        </div>
      </header>

      <section className="booking-layout">
        <aside className="booking-context anim-in anim-d1">
          <p className="login-kicker text-brand-700">Así funciona</p>
          <ol>
            <li><span>1</span><div><strong>Elige barbero</strong><small>Consulta precio, duración y modalidad.</small></div></li>
            <li><span>2</span><div><strong>Elige horario</strong><small>Sólo aparecen horas con un barbero trabajando.</small></div></li>
            <li><span>3</span><div><strong>Confirma tu cita</strong><small>Pagas en efectivo al llegar a la barbería.</small></div></li>
          </ol>
        </aside>
        <div className="booking-panel anim-in anim-d2">
          {listo && <FlujoReserva />}
        </div>
      </section>
    </main>
  );
}
