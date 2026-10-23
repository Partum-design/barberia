"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Facebook,
  Gift,
  LockKeyhole,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  Navigation,
  Phone,
  Quote,
  Scissors,
  Smartphone,
  Star,
  TrainFront,
  UserRound,
  X,
} from "lucide-react";
import { BotonInstalarApp } from "@/components/app/BotonInstalarApp";
import { DESTINO_POR_ROL } from "@/lib/auth/roles";
import { Reveal } from "@/components/marketing/Reveal";
import { TarjetaLealtadVisual } from "@/components/lealtad/TarjetaLealtadVisual";
import { Brocha, Maquina, Navaja, Navajazo, Peine, Tijeras } from "@/components/landing/Iconos";
import { horarioConPersonal } from "@/lib/datos/disponibilidad";
import { PERFIL } from "@/lib/negocio/perfil";
import { DIAS_SEMANA, precioDe, useBarberia, type BarberiaConfig, type Servicio } from "@/lib/store";
import "./cortmart.css";
import { WALLET_VISIBLE } from "@/lib/modo";
import { LogoCM } from "@/components/shell/LogoCM";
import { slug } from "@/components/booking/FlujoReserva";

const mxn = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });


/** Acepta "usuario" o una URL completa de Facebook. */
function enlaceFacebook(valor: string) {
  const v = valor.trim();
  if (!v) return null;
  if (/^https?:\/\//.test(v)) return v;
  return `https://facebook.com/${v.replace(/^@/, "")}`;
}

/** "20:00" → "8 p.m." */
function hora12(h: string) {
  const [hh, mm] = h.split(":").map(Number);
  const sufijo = hh >= 12 ? "p.m." : "a.m.";
  const h12 = hh % 12 || 12;
  return mm ? `${h12}:${String(mm).padStart(2, "0")} ${sufijo}` : `${h12} ${sufijo}`;
}

/** Abierto/cerrado ahora mismo según el horario publicado. */
function estadoHoy(horario: BarberiaConfig["horario"], ahora: Date) {
  const dia = DIAS_SEMANA[(ahora.getDay() + 6) % 7];
  const bloque = horario[dia.id];
  if (!bloque?.activo) return { abierto: false, dia: dia.id, texto: "Hoy cerramos" };
  const minutos = ahora.getHours() * 60 + ahora.getMinutes();
  const [hi, mi] = bloque.inicio.split(":").map(Number);
  const [hf, mf] = bloque.fin.split(":").map(Number);
  if (minutos < hi * 60 + mi) return { abierto: false, dia: dia.id, texto: `Abrimos hoy a las ${hora12(bloque.inicio)}` };
  if (minutos >= hf * 60 + mf) return { abierto: false, dia: dia.id, texto: "Ya cerramos por hoy" };
  return { abierto: true, dia: dia.id, texto: `Abierto · cerramos a las ${hora12(bloque.fin)}` };
}

const ICONO_CATEGORIA: Record<Servicio["categoria"], (p: { className?: string }) => React.ReactElement> = {
  Corte: Tijeras,
  Barba: Navaja,
  Afeitado: Navaja,
  Rostro: Brocha,
  Ritual: Brocha,
  Color: Navajazo,
  Paquete: Maquina,
  Especial: Peine,
};

const TITULO_CATEGORIA: Partial<Record<Servicio["categoria"], string>> = {
  Corte: "Corte de cabello",
  Especial: "Servicios especiales",
  Paquete: "Paquetes",
};

/** WhatsApp pide lada de país: a un número de 10 dígitos le antepone el 52 de México. */
function enlaceWhatsApp(numero: string, texto: string) {
  const d = numero.replace(/\D/g, "");
  if (!d) return null;
  return `https://wa.me/${d.length === 10 ? `52${d}` : d}?text=${encodeURIComponent(texto)}`;
}


const MARQUESINA = ["Cortes", "Grecas", "Afeitado", "Facial", "Cejas", "Paquetes", "Crioterapia", "Box Braids"];

/** Número que sube desde 0 cuando entra en pantalla. */
function Contador({ valor, decimales = 0 }: { valor: number; decimales?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  // El valor final va en el HTML: si la animación no corre, el número es correcto.
  const [n, setN] = useState(valor);
  useEffect(() => {
    const el = ref.current;
    if (!el || sinMovimiento()) return;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const inicio = performance.now();
      const paso = (t: number) => {
        const p = Math.min(1, (t - inicio) / 1400);
        setN(valor * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(paso);
      };
      requestAnimationFrame(paso);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [valor]);
  return <span ref={ref}>{n.toFixed(decimales)}</span>;
}

/** Quien pidió menos movimiento (sistema o panel de accesibilidad). */
function sinMovimiento() {
  return (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    document.documentElement.dataset.movimiento === "reducido"
  );
}

function Estrellas({ className = "" }: { className?: string }) {
  return (
    <span className={`cm-stars ${className}`} role="img" aria-label="5 de 5 estrellas">
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} aria-hidden style={{ animationDelay: `${i * 90}ms` }} />
      ))}
    </span>
  );
}

/**
 * Sitio público de Barbería CortMart. Los datos del negocio salen del panel
 * del administrador y, mientras no estén capturados, de su ficha pública de
 * Google Maps (`PERFIL`).
 */
export function SitioNegocio() {
  const { listo, sesion, barberiaConfig: cfg, servicios, barberos, recompensasConfig, horarioDeBarbero } = useBarberia();
  // Con sesión abierta el botón lleva directo a su cuenta o a su panel.
  const cuenta = sesion
    ? { href: DESTINO_POR_ROL[sesion.rol], label: sesion.rol === "cliente" ? "Mi cuenta" : "Mi panel", nota: `Hola, ${sesion.nombre.split(" ")[0]}` }
    : { href: "/login", label: "Iniciar sesión", nota: "Tus citas, QR y sellos" };
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [ahora, setAhora] = useState<Date | null>(null);
  const [resena, setResena] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [pausado, setPausado] = useState(false);
  const raiz = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const toque = useRef<number | null>(null);

  useEffect(() => {
    setAhora(new Date());
    const t = setInterval(() => setAhora(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Reseñas en carrusel automático: se detiene con el puntero o el foco
  // encima, y no avanza solo si se pidió menos movimiento.
  useEffect(() => {
    if (pausado || sinMovimiento()) return;
    const t = setInterval(() => setResena((i) => (i + 1) % PERFIL.resenas.length), 7000);
    return () => clearInterval(t);
  }, [resena, pausado]);

  // Menú móvil: Escape o tocar fuera lo cierran; el foco se queda dentro
  // mientras está abierto y vuelve al botón al cerrarse.
  useEffect(() => {
    if (!menuAbierto) return;
    const menu = menuRef.current;
    const enfocables = () => Array.from(menu?.querySelectorAll<HTMLElement>("a, button") ?? []);
    enfocables()[0]?.focus();
    const cerrar = () => {
      setMenuAbierto(false);
      burgerRef.current?.focus();
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") return cerrar();
      if (e.key !== "Tab") return;
      const lista = [burgerRef.current!, ...enfocables()].filter(Boolean);
      const i = lista.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey && i <= 0) {
        e.preventDefault();
        lista[lista.length - 1].focus();
      } else if (!e.shiftKey && i === lista.length - 1) {
        e.preventDefault();
        lista[0].focus();
      }
    };
    const fuera = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!menu?.contains(t) && !burgerRef.current?.contains(t)) setMenuAbierto(false);
    };
    document.addEventListener("keydown", tecla);
    document.addEventListener("pointerdown", fuera);
    return () => {
      document.removeEventListener("keydown", tecla);
      document.removeEventListener("pointerdown", fuera);
    };
  }, [menuAbierto]);

  // Parallax: cada [data-parallax] recibe su avance en pantalla (-1…1) en --p
  useEffect(() => {
    const el = raiz.current;
    if (!el) return;
    let raf = 0;
    const capas = Array.from(el.querySelectorAll<HTMLElement>("[data-parallax]"));
    const pintar = () => {
      raf = 0;
      const vh = window.innerHeight;
      for (const c of capas) {
        const r = c.getBoundingClientRect();
        const p = (r.top + r.height / 2 - vh / 2) / (vh / 2 + r.height / 2);
        c.style.setProperty("--p", Math.max(-1, Math.min(1, p)).toFixed(3));
      }
      setScrolled(window.scrollY > 40);
    };
    const pedir = () => {
      if (!raf) raf = requestAnimationFrame(pintar);
    };
    pintar();
    window.addEventListener("scroll", pedir, { passive: true });
    window.addEventListener("resize", pedir);
    return () => {
      window.removeEventListener("scroll", pedir);
      window.removeEventListener("resize", pedir);
      cancelAnimationFrame(raf);
    };
  }, []);

  // El puntero mueve las herramientas flotantes de la portada
  const moverPuntero = (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
    e.currentTarget.style.setProperty("--my", ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
  };

  // Lo capturado en el panel manda; la ficha de Google Maps rellena huecos.
  const nombre = cfg.nombre.trim() || PERFIL.nombre;
  const eslogan = cfg.eslogan.trim() || PERFIL.eslogan;
  const descripcion = cfg.descripcion.trim() || PERFIL.descripcion;
  const direccion = cfg.direccion.trim() || PERFIL.direccion;
  const telefono = cfg.telefono.trim() || PERFIL.telefono;
  const mapa = cfg.mapa_url.trim() || PERFIL.mapa_url;

  const equipoPanel = useMemo(() => barberos.filter((b) => b.activo), [barberos]);
  // Si algún barbero cobra distinto, la portada muestra el menor «desde».
  const activos = useMemo(
    () =>
      servicios
        .filter((s) => s.activo)
        .map((s) => {
          const precios = equipoPanel.map((b) => precioDe(s, b));
          if (precios.length === 0) return s;
          const min = Math.min(...precios);
          return { ...s, precio: min, desde: s.desde || precios.some((p) => p !== min) };
        }),
    [servicios, equipoPanel]
  );

  const horarioPanel = useMemo(
    () => horarioConPersonal(cfg, barberos, horarioDeBarbero),
    [cfg, barberos, horarioDeBarbero]
  );
  const horario = DIAS_SEMANA.some((d) => horarioPanel[d.id].activo) ? horarioPanel : PERFIL.horario;
  const hoy = ahora ? estadoHoy(horario, ahora) : null;

  // La portada sólo publica Facebook (decisión del dueño, oct 2026).
  const facebook = enlaceFacebook(cfg.facebook.trim() || PERFIL.facebook);
  const digitosTel = telefono.replace(/\D/g, "");
  const tel = digitosTel.length > 10 ? `tel:+${digitosTel}` : `tel:+52${digitosTel}`;

  const whatsapp = enlaceWhatsApp(cfg.whatsapp.trim() || PERFIL.whatsapp, `Hola ${nombre}, quiero información para agendar.`);

  // El catálogo del panel manda; sin él se muestra el menú impreso.
  const secciones = useMemo(() => {
    type Item = Pick<Servicio, "nombre" | "categoria" | "precio" | "duracion_min" | "descripcion" | "desde"> & { id?: string };
    const menu: readonly Item[] = activos.length > 0 ? activos : PERFIL.menu;
    const m = new Map<Servicio["categoria"], Item[]>();
    for (const s of menu) m.set(s.categoria, [...(m.get(s.categoria) ?? []), s]);
    return [...m.entries()];
  }, [activos]);
  // Tarjetas grandes: el primer servicio de cada sección.
  const tarjetasServicio = secciones.slice(0, 6).map(([, lista]) => {
    const s = lista[0];
    return {
      icono: ICONO_CATEGORIA[s.categoria] ?? Tijeras,
      href: `/reservar?servicio=${encodeURIComponent(s.id ?? slug(s.nombre))}`,
      nombre: s.nombre,
      texto: s.descripcion || `${TITULO_CATEGORIA[s.categoria] ?? s.categoria} · ${s.duracion_min} min`,
      precio: s.precio,
      desde: Boolean(s.desde),
    };
  });

  const equipo =
    equipoPanel.length > 0
      ? equipoPanel.map((b) => ({ id: b.id, nombre: b.nombre, rol: b.especialidad || "Barbero", nota: b.biografia }))
      : PERFIL.equipo.map((b) => ({ ...b, id: slug(b.nombre) }));

  const enlaces = [
    { href: "#servicios", label: "Servicios" },
    { href: "#lugar", label: "El lugar" },
    { href: "#equipo", label: "Equipo" },
    { href: "#resenas", label: "Reseñas" },
    { href: "#lealtad", label: "Lealtad" },
    { href: "#visitanos", label: "Visítanos" },
  ];

  const letras = PERFIL.marca.toUpperCase().split("");
  const r = PERFIL.resenas;
  const anterior = (resena - 1 + r.length) % r.length;
  const siguiente = (resena + 1) % r.length;

  return (
    <main ref={raiz} className="cm overflow-x-hidden">
      {/* ── Navegación ──────────────────────────────────────────── */}
      <header className={`cm-nav ${scrolled ? "is-scrolled" : ""}`}>
        <Link href="/" className="cm-logo">
          <span className="cm-logo-mark">
            <LogoCM />
          </span>
          <span className="cm-logo-text">
            <b>{PERFIL.marca}</b>
            <small>Barbería</small>
          </span>
        </Link>
        <nav className="cm-nav-links" aria-label="Secciones">
          {enlaces.map((e) => (
            <a key={e.href} href={e.href}>
              {e.label}
            </a>
          ))}
        </nav>
        <div className="cm-nav-actions">
          <Link href={cuenta.href} className="cm-nav-login" aria-label={cuenta.label}>
            <UserRound />
            <span>{cuenta.label}</span>
          </Link>
          <Link href="/reservar" className="cm-btn cm-btn-sm cm-nav-agendar">
            <CalendarCheck /> Agendar
          </Link>
          <button
            ref={burgerRef}
            type="button"
            className="cm-burger"
            onClick={() => setMenuAbierto((v) => !v)}
            aria-label={menuAbierto ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={menuAbierto}
            aria-controls="menu-movil"
          >
            {menuAbierto ? <X /> : <Menu />}
          </button>
        </div>
        {menuAbierto && (
          <div className="cm-mobile-menu" id="menu-movil" ref={menuRef}>
            {enlaces.map((e) => (
              <a key={e.href} href={e.href} onClick={() => setMenuAbierto(false)}>
                {e.label}
              </a>
            ))}
            <Link href="/reservar" onClick={() => setMenuAbierto(false)}>
              Agendar cita
            </Link>
            <Link href={cuenta.href}>{cuenta.label}</Link>
            <a href={tel} className="cm-mobile-contacto">
              <Phone aria-hidden /> Llamar: {telefono}
            </a>
            {whatsapp && (
              <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="cm-mobile-contacto">
                <MessageCircle aria-hidden /> WhatsApp
              </a>
            )}
          </div>
        )}
      </header>

      {/* ── Portada ─────────────────────────────────────────────── */}
      <section className="cm-hero" onPointerMove={moverPuntero}>
        <div className="cm-hero-photo" aria-hidden>
          <Image src={PERFIL.fotos.interior} alt="" fill priority sizes="100vw" className="cm-kenburns" />
        </div>
        <div className="cm-hero-shade" aria-hidden />
        <div className="cm-hero-ghost" aria-hidden>
          BARBERÍA
        </div>

        <div className="cm-floaters" aria-hidden>
          <Tijeras className="cm-float f1" />
          <Navaja className="cm-float f2" />
          <Brocha className="cm-float f3" />
          <Peine className="cm-float f4" />
          <Maquina className="cm-float f5" />
        </div>

        <div className="cm-hero-inner">
          <p className="cm-eyebrow cm-in" style={{ animationDelay: "0ms" }}>
            <span /> Barbería · {PERFIL.zona}
          </p>
          <h1 className="cm-hero-title" aria-label={nombre}>
            {letras.map((l, i) => (
              <span key={i} aria-hidden className={i >= 4 ? "is-accent" : ""} style={{ animationDelay: `${i * 30}ms` }}>
                {l}
              </span>
            ))}
          </h1>
          <p className="cm-hero-tag cm-in" style={{ animationDelay: "150ms" }}>
            {eslogan}
          </p>

          <div className="cm-cta">
            <Link href="/reservar" className="cm-cta-agendar">
              <span className="cm-cta-icono" aria-hidden>
                <CalendarCheck />
              </span>
              <span className="cm-cta-texto">
                <b>Agendar cita</b>
                <small>Elige barbero y hora en un minuto</small>
              </span>
              <ArrowRight className="cm-cta-flecha" aria-hidden />
            </Link>
            <Link href={cuenta.href} className="cm-cta-login">
              <span className="cm-cta-icono" aria-hidden>
                <UserRound />
              </span>
              <span className="cm-cta-texto">
                <b>{cuenta.label}</b>
                <small>{cuenta.nota}</small>
              </span>
            </Link>
          </div>
          <div className="cm-cta-contacto">
            <a href={tel} className="cm-cta-tel">
              <Phone aria-hidden /> Llamar: {telefono}
            </a>
            {whatsapp && (
              <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="cm-cta-tel is-whatsapp">
                <MessageCircle aria-hidden /> WhatsApp
              </a>
            )}
          </div>
          <div className="cm-cta-extra">
            <BotonInstalarApp />
          </div>

          <div className="cm-hero-facts">
            <a href="#resenas" className="cm-rating">
              <strong>{PERFIL.calificacion.toFixed(1)}</strong>
              <span>
                <Estrellas />
                <small>{PERFIL.total_resenas} reseñas en Google</small>
              </span>
            </a>
            {hoy && (
              <span className={`cm-chip ${hoy.abierto ? "is-open" : ""}`}>
                <i /> {hoy.texto}
              </span>
            )}
          </div>
        </div>

        <a href="#servicios" className="cm-scroll" aria-label="Ver más: servicios">
          <span />
        </a>
      </section>

      {/* ── Marquesina ──────────────────────────────────────────── */}
      <div className="cm-marquee" aria-hidden>
        <div className="cm-marquee-track">
          {[0, 1].map((k) => (
            <div key={k}>
              {MARQUESINA.map((m) => (
                <span key={m}>
                  {m} <Scissors />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── Servicios ───────────────────────────────────────────── */}
      <section id="servicios" className="cm-section cm-brick">
        <Reveal className="cm-head">
          <p className="cm-kicker">Cuidado para caballero</p>
          <h2 className="cm-h2">Servicios</h2>
        </Reveal>
        <div className="cm-services">
          {tarjetasServicio.map((s, i) => {
            const Icono = s.icono;
            return (
              <Reveal key={s.nombre} delay={i * 90}>
                <article className={`cm-service ${i === 1 ? "is-featured" : ""}`}>
                  <span className="cm-service-icon">
                    <Icono />
                  </span>
                  <h3>{s.nombre}</h3>
                  <p>{s.texto}</p>
                  <div className="cm-service-price">
                    {s.desde && <small>A partir de</small>}
                    <b>{mxn.format(s.precio)}</b>
                  </div>
                  <Link href={s.href} className="cm-service-link">
                    Agendar {s.nombre.toLowerCase()} <ArrowRight aria-hidden />
                  </Link>
                </article>
              </Reveal>
            );
          })}
        </div>

        <details className="cm-menu-acordeon">
          <summary>
            <span>Ver todos los precios</span>
            <ChevronRight aria-hidden />
          </summary>
        <div className="cm-menu">
          {secciones.map(([categoria, lista]) => (
            <div key={categoria} className="cm-menu-seccion">
              <h3>{TITULO_CATEGORIA[categoria] ?? categoria}</h3>
              <ul>
                {lista.map((s) => (
                  <li key={s.nombre}>
                    <span className="cm-menu-nombre">
                      {s.nombre}
                      <small>
                        {s.descripcion ? `${s.descripcion} · ` : ""}
                        {s.duracion_min} min
                      </small>
                    </span>
                    <i aria-hidden />
                    <span className="cm-menu-precio">
                      {s.desde && <small>A partir de </small>}
                      {mxn.format(s.precio)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <Link href="/reservar" className="cm-btn cm-menu-cta">
            <CalendarCheck /> Reservar cita
          </Link>
        </div>
        </details>
        <Brocha className="cm-deco cm-deco-a" />
        <Tijeras className="cm-deco cm-deco-b" />
      </section>

      {/* ── El lugar ────────────────────────────────────────────── */}
      <section id="lugar" className="cm-gallery">
        <div className="cm-band">
          <Reveal>
            <h2 className="cm-h2 cm-h2-dark">El lugar</h2>
            <p>Ladrillo, luz cálida y tres sillas listas para ti en la colonia Industrial.</p>
          </Reveal>
        </div>
        <div className="cm-gallery-stage" data-parallax>
          <div className="cm-gallery-ghost" aria-hidden>
            CORTMART · CORTMART · CORTMART
          </div>
          <div className="cm-frames">
            <Reveal delay={0} className="cm-frame-wrap">
              <figure className="cm-frame tilt-l">
                <Image src={PERFIL.fotos.letrero} alt="Letrero de la barbería sobre muro de ladrillo con lámparas cálidas" fill sizes="(max-width: 768px) 90vw, 30vw" />
              </figure>
            </Reveal>
            <Reveal delay={120} className="cm-frame-wrap is-main">
              <figure className="cm-frame">
                <Image src={PERFIL.fotos.interior} alt={`Interior de ${nombre}: sillas de barbero, muro de ladrillo y letrero`} fill sizes="(max-width: 768px) 90vw, 40vw" />
                <figcaption>
                  <MapPin /> Av. Euzkaro 152
                </figcaption>
              </figure>
            </Reveal>
            <Reveal delay={240} className="cm-frame-wrap">
              <figure className="cm-frame tilt-r">
                <Image src={PERFIL.fotos.sillas} alt="Tres sillas de barbero con capas de colores" fill sizes="(max-width: 768px) 90vw, 30vw" />
              </figure>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Nosotros ────────────────────────────────────────────── */}
      <section id="nosotros" className="cm-section cm-about">
        <Reveal className="cm-about-photo" >
          <div className="cm-about-img" data-parallax>
            <Image src={PERFIL.fotos.sala} alt="Sala de espera con sillón de piel y muro verde" fill sizes="(max-width: 768px) 90vw, 40vw" />
          </div>
          <span className="cm-about-badge">
            <Scissors /> Desde la silla
          </span>
        </Reveal>
        <Reveal delay={120} className="cm-about-copy">
          <p className="cm-kicker">Nosotros</p>
          <h2 className="cm-h2">
            Sobre <span>{PERFIL.marca}</span>
          </h2>
          <p>{descripcion}</p>
          <div className="cm-stats">
            <div>
              <b>
                <Contador valor={PERFIL.calificacion} decimales={1} />
              </b>
              <small>Calificación en Google</small>
            </div>
            <div>
              <b>
                <Contador valor={PERFIL.total_resenas} />
              </b>
              <small>Reseñas de 5 estrellas</small>
            </div>
            <div>
              <b>
                <Contador valor={DIAS_SEMANA.filter((d) => horario[d.id].activo).length} />
              </b>
              <small>Días abiertos a la semana</small>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── Equipo ──────────────────────────────────────────────── */}
      <section id="equipo" className="cm-section cm-brick">
        <Reveal className="cm-head">
          <p className="cm-kicker">Manos expertas</p>
          <h2 className="cm-h2">El equipo</h2>
        </Reveal>
        <div className="cm-team">
          {equipo.map((b, i) => (
            <Reveal key={b.nombre} delay={i * 110}>
              <article className="cm-barber">
                <span className="cm-barber-avatar">
                  <span>{b.nombre.charAt(0)}</span>
                </span>
                <h3>{b.nombre}</h3>
                <p className="cm-barber-role">{b.rol}</p>
                {b.nota && <p className="cm-barber-note">{b.nota}</p>}
                <Link href={`/reservar?barbero=${encodeURIComponent(b.id)}`} className="cm-service-link">
                  Agendar con {b.nombre.split(" ")[0]} <ArrowRight aria-hidden />
                </Link>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Reseñas ─────────────────────────────────────────────── */}
      <section id="resenas" className="cm-reviews">
        <div className="cm-band">
          <Reveal>
            <p className="cm-band-kicker">Lo que dicen nuestros clientes</p>
            <h2 className="cm-h2 cm-h2-dark">Reseñas</h2>
          </Reveal>
        </div>
        <div className="cm-reviews-stage">
          <Reveal className="cm-score">
            <b>
              <Contador valor={PERFIL.calificacion} decimales={1} />
            </b>
            <Estrellas className="is-lg" />
            <small>{PERFIL.total_resenas} reseñas en Google Maps</small>
          </Reveal>
          <div
            className="cm-carousel"
            role="region"
            aria-roledescription="carrusel"
            aria-label="Reseñas de clientes"
            onPointerEnter={() => setPausado(true)}
            onPointerLeave={() => setPausado(false)}
            onFocusCapture={() => setPausado(true)}
            onBlurCapture={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setPausado(false);
            }}
            onTouchStart={(e) => {
              toque.current = e.touches[0].clientX;
              setPausado(true);
            }}
            onTouchEnd={(e) => {
              const inicio = toque.current;
              toque.current = null;
              if (inicio === null) return;
              const dx = e.changedTouches[0].clientX - inicio;
              if (Math.abs(dx) > 40) setResena(dx < 0 ? siguiente : anterior);
            }}
          >
            <button type="button" className="cm-arrow" onClick={() => setResena(anterior)} aria-label="Ver la reseña anterior">
              <ChevronLeft />
            </button>
            <div className="cm-cards" aria-live={pausado ? "polite" : "off"}>
              {r.map((x, i) => {
                const pos = i === resena ? "is-center" : i === anterior ? "is-left" : i === siguiente ? "is-right" : "is-hidden";
                return (
                  <blockquote
                    key={x.autor}
                    className={`cm-review ${pos}`}
                    aria-hidden={i !== resena}
                    aria-roledescription="reseña"
                    aria-label={`Reseña ${i + 1} de ${r.length}, de ${x.autor}`}
                  >
                    <Quote className="cm-review-quote" aria-hidden />
                    <Estrellas />
                    <p tabIndex={i === resena ? 0 : -1}>{x.texto}</p>
                    <footer>
                      <span className="cm-review-avatar">{x.autor.charAt(0)}</span>
                      <span>
                        <b>{x.autor}</b>
                        <small>Reseña en Google</small>
                      </span>
                    </footer>
                  </blockquote>
                );
              })}
            </div>
            <button type="button" className="cm-arrow" onClick={() => setResena(siguiente)} aria-label="Ver la siguiente reseña">
              <ChevronRight />
            </button>
          </div>
          <div className="cm-dots">
            {r.map((x, i) => (
              <button
                key={x.autor}
                type="button"
                className={i === resena ? "is-active" : ""}
                onClick={() => setResena(i)}
                aria-label={`Ver reseña ${i + 1} de ${r.length}, de ${x.autor}`}
                aria-current={i === resena ? "true" : undefined}
              >
                <span aria-hidden />
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Tarjeta de lealtad ──────────────────────────────────── */}
      <section id="lealtad" className="cm-section cm-brick">
        <div className="cm-loyalty">
          <Reveal className="cm-loyalty-copy">
            <p className="cm-kicker">Tarjeta de lealtad</p>
            <h2 className="cm-h2">Cada visita cuenta</h2>
            <p>
              Cada visita suma un sello y con {recompensasConfig.citas_requeridas} sellos ganas{" "}
              <b>{recompensasConfig.valor_descuento}% de descuento</b> en tu siguiente servicio.
            </p>
            <ul>
              <li><Gift /> Se llena sola cuando reservas en línea.</li>
              {WALLET_VISIBLE ? (
                <li><Smartphone /> Guárdala en Google Wallet y llévala en tu teléfono.</li>
              ) : (
                <li><Smartphone /> Llévala siempre en tu teléfono desde tu cuenta.</li>
              )}
              <li><Scissors /> ¿Llegaste sin cita? Muestra tu QR y te ponemos el sello.</li>
            </ul>
            <Link href="/cuenta/tarjeta" className="cm-btn">
              Obtener mi tarjeta <ArrowRight />
            </Link>
          </Reveal>
          <Reveal delay={150} className="cm-loyalty-card">
            {/* Ilustración: el texto de la tarjeta de muestra no se lee aparte */}
            <div role="img" aria-label="Ejemplo de la tarjeta de lealtad CortMart con sus sellos">
            <div aria-hidden>
            <TarjetaLealtadVisual
              negocio={nombre}
              titular="Tu nombre"
              numero="LC-0000-0000"
              progreso={Math.min(3, recompensasConfig.citas_requeridas - 1)}
              requerido={recompensasConfig.citas_requeridas}
              disponibles={0}
              descuento={recompensasConfig.valor_descuento}
            />
            </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Visítanos ───────────────────────────────────────────── */}
      <section id="visitanos" className="cm-section cm-visit-section">
        <Reveal className="cm-head">
          <p className="cm-kicker">Visítanos</p>
          <h2 className="cm-h2">Te esperamos en la silla</h2>
        </Reveal>
        <div className="cm-visit">
          <Reveal className="cm-map">
            <iframe
              title={`Mapa de ${nombre}`}
              src={PERFIL.mapa_embed}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </Reveal>
          <div className="cm-visit-info">
            <Reveal delay={80} className="cm-card">
              <h3><MapPin /> Dirección</h3>
              <p>{direccion}</p>
              <p className="cm-muted"><TrainFront /> {PERFIL.referencia}</p>
              <a href={mapa} target="_blank" rel="noopener noreferrer" className="cm-btn cm-btn-sm">
                <Navigation /> Cómo llegar
              </a>
            </Reveal>
            <Reveal delay={160} className="cm-card">
              <h3><Clock3 /> Horario</h3>
              <ul className="cm-hours">
                {DIAS_SEMANA.map((d) => {
                  const b = horario[d.id];
                  return (
                    <li key={d.id} className={hoy?.dia === d.id ? "is-today" : ""}>
                      <span>{d.label}</span>
                      <span>{b.activo ? `${hora12(b.inicio)} – ${hora12(b.fin)}` : "Cerrado"}</span>
                    </li>
                  );
                })}
              </ul>
            </Reveal>
            <Reveal delay={240} className="cm-card">
              <h3><Phone /> Contacto</h3>
              <ul className="cm-contact">
                <li><a href={tel}><Phone aria-hidden /> Llamar: {telefono}</a></li>
                {whatsapp && (
                  <li><a href={whatsapp} target="_blank" rel="noopener noreferrer"><MessageCircle /> WhatsApp</a></li>
                )}
                {cfg.email && (
                  <li><a href={`mailto:${cfg.email}`}><Mail /> {cfg.email}</a></li>
                )}
                {facebook && (
                  <li><a href={facebook} target="_blank" rel="noopener noreferrer"><Facebook aria-hidden /> Facebook</a></li>
                )}
                <li><Link href="/reservar"><CalendarCheck /> Reservar en línea</Link></li>
              </ul>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Cierre ──────────────────────────────────────────────── */}
      <section className="cm-final">
        <div className="cm-final-photo" data-parallax aria-hidden>
          <Image src={PERFIL.fotos.letrero} alt="" fill sizes="100vw" />
        </div>
        <Reveal className="cm-final-inner">
          <h2 className="cm-h2">Tu próximo corte, a un clic</h2>
          <p>Elige barbero y horario, paga al llegar con transferencia, tarjeta o efectivo y suma un sello en tu tarjeta.</p>
          <div className="cm-hero-actions">
            <Link href="/reservar" className="cm-btn">
              <CalendarCheck /> Reservar cita
            </Link>
            <Link href={cuenta.href} className="cm-btn cm-btn-ghost">
              <UserRound /> {cuenta.label}
            </Link>
          </div>
        </Reveal>
      </section>
      {/* ── Pie ─────────────────────────────────────────────────── */}
      <footer className="cm-footer">
        <div className="cm-footer-brand">
          <span className="cm-logo-mark">
            <LogoCM />
          </span>
          <span>
            <b>{nombre}</b>
            <small>{PERFIL.zona}</small>
          </span>
        </div>
        <p className="cm-footer-credit">
          Desarrollado por{" "}
          <a href="https://partumdesign.com.mx" target="_blank" rel="noopener noreferrer">
            Partum Design
          </a>
        </p>
        <Link href="/login" className="cm-admin-link">
          <LockKeyhole /> Administración
        </Link>
      </footer>
      {!listo && <span className="sr-only">Cargando información del negocio…</span>}
    </main>
  );
}
