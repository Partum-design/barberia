"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarCheck,
  Clock3,
  Facebook,
  Gift,
  Instagram,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  Navigation,
  Phone,
  Scissors,
  Smartphone,
  Sparkles,
  X,
} from "lucide-react";
import { Reveal } from "@/components/marketing/Reveal";
import { ThreePulse } from "@/components/marketing/ThreePulse";
import { TarjetaLealtadVisual } from "@/components/lealtad/TarjetaLealtadVisual";
import { horarioConPersonal } from "@/lib/datos/disponibilidad";
import {
  DIAS_SEMANA,
  nombreDelNegocio,
  useBarberia,
  type BarberiaConfig,
  type Servicio,
} from "@/lib/store";

const mxn = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

const ORDEN_CATEGORIAS: Servicio["categoria"][] = ["Corte", "Barba", "Ritual", "Color", "Paquete"];

/** Sólo dígitos y "+", como piden `tel:` y wa.me. */
const soloDigitos = (v: string) => v.replace(/[^\d+]/g, "");

/** Acepta "@usuario", "usuario" o una URL completa. */
function enlaceRed(red: "instagram" | "facebook" | "tiktok", valor: string) {
  const v = valor.trim();
  if (!v) return null;
  if (/^https?:\/\//.test(v)) return v;
  const usuario = v.replace(/^@/, "");
  if (red === "instagram") return `https://instagram.com/${usuario}`;
  if (red === "facebook") return `https://facebook.com/${usuario}`;
  return `https://www.tiktok.com/@${usuario}`;
}

/** Abierto/cerrado ahora mismo según el horario publicado. */
function estadoHoy(horario: BarberiaConfig["horario"], ahora: Date) {
  const dia = DIAS_SEMANA[(ahora.getDay() + 6) % 7];
  const bloque = horario[dia.id];
  if (!bloque?.activo) return { abierto: false, dia: dia.id, texto: "Hoy cerramos" };
  const minutos = ahora.getHours() * 60 + ahora.getMinutes();
  const [hi, mi] = bloque.inicio.split(":").map(Number);
  const [hf, mf] = bloque.fin.split(":").map(Number);
  const abre = hi * 60 + mi;
  const cierra = hf * 60 + mf;
  if (minutos < abre) return { abierto: false, dia: dia.id, texto: `Abrimos hoy a las ${bloque.inicio}` };
  if (minutos >= cierra) return { abierto: false, dia: dia.id, texto: "Ya cerramos por hoy" };
  return { abierto: true, dia: dia.id, texto: `Abierto · cerramos a las ${bloque.fin}` };
}

/**
 * Sitio público de la barbería. Todo el contenido sale de lo que el
 * administrador captura en el panel —datos del negocio, servicios, equipo y
 * programa de lealtad—, y cada sección se oculta mientras no tenga nada que
 * decir. Nada de lo que se ve aquí es texto de ejemplo.
 */
export function SitioNegocio() {
  const { listo, barberiaConfig: negocio, servicios, barberos, recompensasConfig, horarioDeBarbero } = useBarberia();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [ahora, setAhora] = useState<Date | null>(null);

  useEffect(() => {
    setAhora(new Date());
    const t = setInterval(() => setAhora(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const nombre = nombreDelNegocio(negocio);
  const activos = useMemo(() => servicios.filter((s) => s.activo), [servicios]);
  const equipo = useMemo(() => barberos.filter((b) => b.activo), [barberos]);
  const porCategoria = useMemo(
    () =>
      ORDEN_CATEGORIAS.map((cat) => ({ cat, items: activos.filter((s) => s.categoria === cat) })).filter(
        (g) => g.items.length > 0
      ),
    [activos]
  );

  // Se publica el horario en que hay personal: un día sin barberos trabajando
  // aparece cerrado aunque el local tenga horario capturado.
  const horario = useMemo(
    () => horarioConPersonal(negocio, barberos, horarioDeBarbero),
    [negocio, barberos, horarioDeBarbero]
  );
  const tieneHorario = DIAS_SEMANA.some((d) => horario[d.id].activo);
  const hoy = ahora && tieneHorario ? estadoHoy(horario, ahora) : null;
  const anios =
    negocio.anio_fundacion && /^\d{4}$/.test(negocio.anio_fundacion)
      ? new Date().getFullYear() - Number(negocio.anio_fundacion)
      : null;

  const redes = [
    { id: "instagram" as const, icono: <Instagram />, url: enlaceRed("instagram", negocio.instagram), label: "Instagram" },
    { id: "facebook" as const, icono: <Facebook />, url: enlaceRed("facebook", negocio.facebook), label: "Facebook" },
    { id: "tiktok" as const, icono: <Sparkles />, url: enlaceRed("tiktok", negocio.tiktok), label: "TikTok" },
  ].filter((r) => r.url);

  const whatsapp = negocio.whatsapp
    ? `https://wa.me/${soloDigitos(negocio.whatsapp).replace(/^\+/, "")}?text=${encodeURIComponent(`Hola ${nombre}, quiero información para agendar.`)}`
    : null;
  const mapa =
    negocio.mapa_url ||
    (negocio.direccion ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(negocio.direccion)}` : null);

  const enlaces = [
    { href: "#nosotros", label: "Nosotros", visible: Boolean(negocio.descripcion) },
    { href: "#servicios", label: "Servicios", visible: activos.length > 0 },
    { href: "#equipo", label: "Equipo", visible: equipo.length > 0 },
    { href: "#lealtad", label: "Lealtad", visible: true },
    { href: "#visitanos", label: "Visítanos", visible: true },
  ].filter((e) => e.visible);

  return (
    <main className="landing-page biz overflow-x-hidden">
      {/* ── Portada ─────────────────────────────────────────────── */}
      <section className="landing-hero biz-hero">
        <nav className="landing-nav">
          <Link href="/" className="landing-logo min-w-0">
            <span className="landing-logo-mark shrink-0">
              <Scissors className="h-4 w-4" />
            </span>
            <span className="biz-logo-text">{nombre}</span>
          </Link>
          <div className="landing-nav-links">
            {enlaces.map((e) => (
              <a key={e.href} href={e.href} className="biz-nav-link">
                {e.label}
              </a>
            ))}
            <Link href="/reservar" className="landing-nav-cta">
              Reservar <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <button
              type="button"
              className="biz-menu-button"
              onClick={() => setMenuAbierto((v) => !v)}
              aria-label={menuAbierto ? "Cerrar menú" : "Abrir menú"}
              aria-expanded={menuAbierto}
            >
              {menuAbierto ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </nav>
        {menuAbierto && (
          <div className="biz-mobile-menu">
            {enlaces.map((e) => (
              <a key={e.href} href={e.href} onClick={() => setMenuAbierto(false)}>
                {e.label}
              </a>
            ))}
            <Link href="/login">Mi cuenta</Link>
          </div>
        )}

        <div className="landing-hero-grid">
          <div className="landing-hero-copy">
            <p className="anim-in anim-d1 landing-eyebrow">
              <span /> Barbería{negocio.direccion ? ` · ${negocio.direccion.split(",").slice(-1)[0].trim()}` : ""}
            </p>
            <h1 className="anim-in anim-d2 biz-title">
              {nombre}
              {negocio.eslogan && (
                <>
                  <br />
                  <span>{negocio.eslogan}</span>
                </>
              )}
            </h1>
            <div className="anim-in anim-d4 landing-hero-actions">
              <Link href="/reservar" className="landing-primary-action">
                <CalendarCheck className="h-4 w-4" /> Reservar cita
              </Link>
              {whatsapp ? (
                <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="landing-secondary-action">
                  <MessageCircle className="h-4 w-4" /> Escríbenos por WhatsApp
                </a>
              ) : negocio.telefono ? (
                <a href={`tel:${soloDigitos(negocio.telefono)}`} className="landing-secondary-action">
                  <Phone className="h-4 w-4" /> Llamar
                </a>
              ) : null}
            </div>
            <div className="anim-in anim-d5 landing-hero-facts">
              {hoy && (
                <span className={hoy.abierto ? "biz-open" : ""}>
                  <Clock3 className="h-3.5 w-3.5" /> {hoy.texto}
                </span>
              )}
              {negocio.direccion && (
                <span>
                  <MapPin className="h-3.5 w-3.5" /> {negocio.direccion}
                </span>
              )}
              {anios !== null && anios > 0 && (
                <span>
                  <Scissors className="h-3.5 w-3.5" /> {anios} año{anios === 1 ? "" : "s"} en el oficio
                </span>
              )}
            </div>
          </div>

          <div className="landing-product-stage biz-stage anim-pop anim-d3" aria-hidden>
            <ThreePulse />
          </div>
        </div>

        {listo && activos.length > 0 && (
          <div className="landing-capability-strip">
            {porCategoria.map((g) => (
              <span key={g.cat}>{g.cat.toUpperCase()}</span>
            ))}
            <span>TARJETA DE LEALTAD</span>
          </div>
        )}
      </section>

      {/* ── Nosotros ────────────────────────────────────────────── */}
      {negocio.descripcion && (
        <section id="nosotros" className="biz-section">
          <Reveal className="biz-about">
            <p className="kicker" style={{ color: "var(--gold)" }}>Nosotros</p>
            <h2 className="biz-h2">
              Sobre {nombre}
              {anios !== null && anios > 0 && <span className="biz-since"> · desde {negocio.anio_fundacion}</span>}
            </h2>
            <p className="biz-about-text">{negocio.descripcion}</p>
          </Reveal>
        </section>
      )}

      {/* ── Servicios ───────────────────────────────────────────── */}
      {activos.length > 0 && (
        <section id="servicios" className="biz-section">
          <Reveal className="biz-section-head">
            <p className="kicker" style={{ color: "var(--gold)" }}>Servicios</p>
            <h2 className="biz-h2">Nuestro menú</h2>
            <p>Precios en pesos mexicanos. Reserva en línea y paga con tarjeta o en efectivo.</p>
          </Reveal>
          <div className="biz-menu">
            {porCategoria.map((g, i) => (
              <Reveal key={g.cat} delay={i * 80} className="biz-menu-group">
                <h3>{g.cat}</h3>
                <ul>
                  {g.items.map((s) => (
                    <li key={s.id}>
                      <span className="biz-menu-name">{s.nombre}</span>
                      <span className="biz-menu-dots" aria-hidden />
                      <span className="biz-menu-price">{mxn.format(s.precio)}</span>
                      <small>{s.duracion_min} min</small>
                    </li>
                  ))}
                </ul>
              </Reveal>
            ))}
          </div>
          <div className="mt-8 flex justify-center">
            <Link href="/reservar" className="landing-primary-action">
              Reservar un servicio <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      )}

      {/* ── Equipo ──────────────────────────────────────────────── */}
      {equipo.length > 0 && (
        <section id="equipo" className="biz-section">
          <Reveal className="biz-section-head">
            <p className="kicker" style={{ color: "var(--gold)" }}>El equipo</p>
            <h2 className="biz-h2">Quién te atiende</h2>
          </Reveal>
          <div className="biz-team">
            {equipo.map((b, i) => (
              <Reveal key={b.id} delay={i * 80}>
                <article className="biz-barber">
                  <span className="biz-barber-avatar">{b.nombre.charAt(0)}</span>
                  <h3>{b.nombre}</h3>
                  <p className="biz-barber-role">{b.especialidad}</p>
                  {b.biografia && <p className="biz-barber-bio">{b.biografia}</p>}
                  <div className="biz-barber-meta">
                    <span>Desde {mxn.format(b.precio_servicio)}</span>
                    {b.acepta_domicilio && <span>También a domicilio</span>}
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* ── Tarjeta de lealtad ──────────────────────────────────── */}
      <section id="lealtad" className="biz-section">
        <div className="biz-loyalty">
          <Reveal className="biz-loyalty-copy">
            <p className="kicker" style={{ color: "var(--gold)" }}>Tarjeta de lealtad</p>
            <h2 className="biz-h2">Cada visita cuenta.</h2>
            <p>
              Todos nuestros clientes tienen tarjeta. Cada visita suma un sello y con{" "}
              {recompensasConfig.citas_requeridas} sellos ganas {recompensasConfig.valor_descuento}% de
              descuento en tu siguiente servicio.
            </p>
            <ul>
              <li><Gift /> Se llena sola cuando reservas en línea.</li>
              <li><Smartphone /> Guárdala en Google Wallet y llévala en tu teléfono.</li>
              <li><Scissors /> ¿Llegaste sin cita? Muestra tu QR y te ponemos el sello.</li>
            </ul>
            <Link href="/cuenta/tarjeta" className="landing-primary-action mt-6 w-fit">
              Obtener mi tarjeta <ArrowRight className="h-4 w-4" />
            </Link>
          </Reveal>
          <Reveal delay={120} className="biz-loyalty-card">
            <TarjetaLealtadVisual
              negocio={nombre}
              titular="Tu nombre"
              numero="LC-0000-0000"
              progreso={Math.min(3, recompensasConfig.citas_requeridas - 1)}
              requerido={recompensasConfig.citas_requeridas}
              disponibles={0}
              descuento={recompensasConfig.valor_descuento}
            />
          </Reveal>
        </div>
      </section>

      {/* ── Visítanos ───────────────────────────────────────────── */}
      <section id="visitanos" className="biz-section">
        <Reveal className="biz-section-head">
          <p className="kicker" style={{ color: "var(--gold)" }}>Visítanos</p>
          <h2 className="biz-h2">Te esperamos en la silla</h2>
        </Reveal>
        <div className="biz-visit">
          <Reveal className="biz-visit-card">
            <h3><Clock3 /> Horario</h3>
            {tieneHorario ? (
              <ul className="biz-hours">
                {DIAS_SEMANA.map((d) => {
                  const b = horario[d.id];
                  return (
                    <li key={d.id} className={hoy?.dia === d.id ? "is-today" : ""}>
                      <span>{d.label}</span>
                      <span>{b.activo ? `${b.inicio} – ${b.fin}` : "Cerrado"}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="biz-muted">Consulta nuestro horario por teléfono o WhatsApp.</p>
            )}
          </Reveal>

          <Reveal delay={100} className="biz-visit-card">
            <h3><MapPin /> Ubicación</h3>
            {negocio.direccion ? <p>{negocio.direccion}</p> : <p className="biz-muted">Dirección próximamente.</p>}
            {mapa && (
              <a href={mapa} target="_blank" rel="noopener noreferrer" className="landing-secondary-action mt-4 w-fit">
                <Navigation className="h-4 w-4" /> Cómo llegar
              </a>
            )}
          </Reveal>

          <Reveal delay={200} className="biz-visit-card">
            <h3><Phone /> Contacto</h3>
            <ul className="biz-contact">
              {negocio.telefono && (
                <li><a href={`tel:${soloDigitos(negocio.telefono)}`}><Phone /> {negocio.telefono}</a></li>
              )}
              {whatsapp && (
                <li><a href={whatsapp} target="_blank" rel="noopener noreferrer"><MessageCircle /> WhatsApp</a></li>
              )}
              {negocio.email && (
                <li><a href={`mailto:${negocio.email}`}><Mail /> {negocio.email}</a></li>
              )}
              {redes.map((r) => (
                <li key={r.id}><a href={r.url!} target="_blank" rel="noopener noreferrer">{r.icono} {r.label}</a></li>
              ))}
              <li><Link href="/reservar"><CalendarCheck /> Reservar en línea</Link></li>
            </ul>
          </Reveal>
        </div>
      </section>

      {/* ── Cierre ──────────────────────────────────────────────── */}
      <section className="landing-final">
        <Reveal className="mx-auto max-w-3xl px-6 py-16 text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Tu próximo corte, a un clic.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-white/70">
            Elige barbero y horario, paga en la barbería y suma un sello en tu tarjeta.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/reservar" className="btn-gold card-hover rounded-full px-6 py-3 font-semibold shadow-lg">
              Reservar cita
            </Link>
            <Link href="/login" className="card-hover rounded-full border border-white/25 px-6 py-3 font-semibold text-white transition-colors hover:bg-white/10">
              Mi cuenta
            </Link>
          </div>
        </Reveal>
      </section>
    </main>
  );
}
