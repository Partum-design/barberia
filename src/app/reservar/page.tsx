"use client";

import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft, Banknote, CalendarCheck, Clock3 } from "lucide-react";
import { FlujoReserva } from "@/components/booking/FlujoReserva";
import { BotonesContacto } from "@/components/contacto/BotonesContacto";
import { useBarberia } from "@/lib/store";
import { Marca } from "@/components/shell/Marca";
import { LogoCM } from "@/components/shell/LogoCM";

// Reserva en línea, sin cuenta: barbero, servicio, día y hora, nombre y celular.
export default function ReservarPage() {
  const { listo } = useBarberia();

  return (
    <main className="booking-page">
      <header className="booking-hero anim-in">
        <nav className="booking-nav" aria-label="Reserva">
          <Link href="/" className="login-brand">
            <span className="login-brand-mark">
              <LogoCM />
            </span>
            <Marca />
          </Link>
          <Link href="/" className="booking-back">
            <ArrowLeft className="inline h-4 w-4" aria-hidden /> Volver al inicio
          </Link>
        </nav>
        <div className="booking-hero-copy">
          <p className="login-kicker text-mint-raw">Reserva en línea</p>
          <h1>Tu cita, lista en un minuto.</h1>
          <p>Elige barbero, servicio y horario. Sólo necesitas tu nombre y tu celular: no hace falta crear cuenta.</p>
        </div>
        <ul className="booking-trust">
          <li>
            <Clock3 className="h-5 w-5" aria-hidden /> Disponibilidad en tiempo real
          </li>
          <li>
            <Banknote className="h-5 w-5" aria-hidden /> Pagas en la barbería
          </li>
          <li>
            <CalendarCheck className="h-5 w-5" aria-hidden /> Confirmación inmediata
          </li>
        </ul>
      </header>

      <div className="booking-layout">
        <section className="booking-context anim-in anim-d1" aria-labelledby="como-funciona">
          <h2 id="como-funciona" className="login-kicker text-brand-700">
            Así funciona
          </h2>
          <ol>
            <li>
              <span aria-hidden>1</span>
              <div>
                <strong>Elige barbero y servicio</strong>
                <small>Verás el precio y cuánto dura.</small>
              </div>
            </li>
            <li>
              <span aria-hidden>2</span>
              <div>
                <strong>Elige día y hora</strong>
                <small>Sólo aparecen horas libres.</small>
              </div>
            </li>
            <li>
              <span aria-hidden>3</span>
              <div>
                <strong>Escribe tu nombre y celular</strong>
                <small>Pagas en efectivo al llegar a la barbería.</small>
              </div>
            </li>
          </ol>
          <div className="booking-telefono">
            <p>¿Prefieres agendar por teléfono? Llámanos o escríbenos por WhatsApp.</p>
            <BotonesContacto />
          </div>
        </section>
        <section className="booking-panel anim-in anim-d2" aria-label="Reservar cita">
          {listo ? (
            <Suspense fallback={null}>
              <FlujoReserva />
            </Suspense>
          ) : (
            <p className="reserva-quien" role="status">
              Cargando horarios…
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
