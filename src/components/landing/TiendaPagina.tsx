"use client";

import Link from "next/link";
import { ArrowLeft, CalendarCheck, Loader2, MapPin, ShoppingBag } from "lucide-react";
import { Tienda } from "@/components/landing/Tienda";
import { LogoCM } from "@/components/shell/LogoCM";
import { PERFIL } from "@/lib/negocio/perfil";
import { useBarberia } from "@/lib/store";
import "./cortmart.css";

/** /productos — la tienda completa, con el mismo look de la portada. */
export function TiendaPagina() {
  const { listo, productos, barberiaConfig: cfg } = useBarberia();
  const tienda = productos.filter((p) => p.publico && p.precio_venta > 0);
  const nombre = cfg.nombre.trim() || PERFIL.nombre;

  return (
    <main className="cm cm-tienda-pagina overflow-x-hidden">
      <header className="cm-tienda-nav">
        <Link href="/" className="cm-logo" aria-label={`Inicio de ${nombre}`}>
          <span className="cm-logo-mark">
            <LogoCM />
          </span>
          <span className="cm-logo-text">
            <b>{PERFIL.marca}</b>
            <small>Tienda</small>
          </span>
        </Link>
        <nav className="flex items-center gap-2">
          <Link href="/" className="cm-tienda-volver">
            <ArrowLeft aria-hidden /> Inicio
          </Link>
          <Link href="/reservar" className="cm-btn cm-btn-sm">
            <CalendarCheck /> Reservar
          </Link>
        </nav>
      </header>

      <section className="cm-tienda-hero cm-brick">
        <p className="cm-kicker">{nombre}</p>
        <h1 className="cm-h2">
          La tienda <span>del barbero</span>
        </h1>
        <p className="cm-tienda-sub">
          Lo mismo que usamos en el sillón: ceras, aceites, pomadas y afeitado. Aparta por WhatsApp, paga en la barbería con
          transferencia, tarjeta o efectivo.
        </p>
        <ul className="cm-tienda-pasos">
          <li>
            <ShoppingBag aria-hidden /> Elige tu producto
          </li>
          <li>
            <span aria-hidden>→</span> Apártalo por WhatsApp
          </li>
          <li>
            <MapPin aria-hidden /> Recógelo en tu cita
          </li>
        </ul>
      </section>

      <section className="cm-section cm-tienda">
        {!listo ? (
          <p className="cm-tienda-vacia">
            <Loader2 className="animate-spin" aria-hidden /> Cargando productos…
          </p>
        ) : tienda.length === 0 ? (
          <div className="cm-tienda-vacia">
            <ShoppingBag aria-hidden />
            <p>Estamos surtiendo la tienda. Pregunta en tu próxima visita por los productos que usamos.</p>
            <Link href="/reservar" className="cm-btn">
              <CalendarCheck /> Reservar cita
            </Link>
          </div>
        ) : (
          <Tienda productos={tienda} whatsapp={cfg.whatsapp.trim() || PERFIL.whatsapp} completa />
        )}
      </section>
    </main>
  );
}
