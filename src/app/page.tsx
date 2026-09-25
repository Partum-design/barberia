import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck,
  CalendarX2,
  CreditCard,
  Gift,
  Home,
  Layers,
  PhoneOff,
  Quote,
  Scissors,
  ShieldCheck,
  Timer,
  User,
  UserCog,
  UserX,
} from "lucide-react";
import { Reveal } from "@/components/marketing/Reveal";
import { ThreePulse } from "@/components/marketing/ThreePulse";
import { BarberOSExperience } from "@/components/landing/BarberOSExperience";
import { PricingSection } from "@/components/landing/PricingSection";
import { FaqSection } from "@/components/landing/FaqSection";

// Landing: explica el porqué de la plataforma y da acceso a la demo por rol.
export default function LandingPage() {
  return (
    <main className="landing-page overflow-x-hidden">
      {/* Hero */}
      <section className="landing-hero">
        <nav className="landing-nav">
          <Link href="/" className="anim-in landing-logo">
            <span className="landing-logo-mark">
              <Scissors className="h-4 w-4" />
            </span>
            <span className="leading-none whitespace-nowrap">
              <span className="block text-sm font-semibold tracking-[0.3em] sm:text-base" style={{ fontFamily: "var(--font-serif)" }}>
                HAIRCUT
              </span>
              <span className="block text-[9px] uppercase tracking-[0.34em] text-brand-100/55">
                Barbershop
              </span>
            </span>
          </Link>
          <div className="anim-in anim-d1 landing-nav-links">
            <Link href="/" className="hidden sm:inline-flex">Inicio</Link>
            <Link href="#experiencia" className="hidden sm:inline-flex">Servicios</Link>
            <Link href="#testimonios" className="hidden md:inline-flex">Barberos</Link>
            <Link href="#precios" className="hidden sm:inline-flex">Precios</Link>
            <Link href="#contacto" className="hidden md:inline-flex">Contacto</Link>
            <Link href="/login" className="landing-nav-cta">
              Iniciar sesión <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </nav>

        <div className="landing-hero-grid">
          <div className="landing-hero-copy">
            <p className="anim-in anim-d1 landing-eyebrow">
              <span /> Barbería · Estilo · Precisión
            </p>
            <h1 className="anim-in anim-d2">
              Tu estilo,
              <br />
              <span>nuestra pasión.</span>
            </h1>
            <p className="anim-in anim-d3 landing-hero-lead">
              Reserva tu cita en segundos y vive la mejor experiencia con los barberos más completos de la ciudad.
            </p>
            <div className="anim-in anim-d4 landing-hero-actions">
              <Link href="/reservar" className="landing-primary-action">
                Reservar ahora <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="#experiencia" className="landing-secondary-action">
                Conoce nuestros servicios
              </Link>
            </div>
            <div className="anim-in anim-d5 landing-hero-facts">
              <span><CreditCard className="h-3.5 w-3.5" /> Tarjeta y efectivo</span>
              <span><Home className="h-3.5 w-3.5" /> Servicio a domicilio</span>
              <span><ShieldCheck className="h-3.5 w-3.5" /> OTP y antifraude</span>
            </div>
          </div>

          <div className="landing-product-stage anim-pop anim-d3">
            <ThreePulse />
            <div className="landing-console">
              <div className="landing-console-top">
                <div className="flex items-center gap-2">
                  <span className="landing-console-mark"><Scissors className="h-3 w-3" /></span>
                  <span className="text-xs font-semibold tracking-[0.18em]" style={{ fontFamily: "var(--font-serif)" }}>HAIRCUT</span>
                </div>
                <span className="landing-live"><span /> En vivo</span>
              </div>
              <div className="landing-console-body">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">Agenda de hoy</p>
                    <p className="mt-1 font-display text-lg font-semibold" style={{ color: "var(--ink)" }}>12 citas · 3 por atender</p>
                  </div>
                  <span className="landing-date">21 JUL</span>
                </div>
                <div className="landing-console-kpis">
                  <div><span>Cobrado</span><strong>$8,460</strong><small>Conciliado</small></div>
                  <div><span>Asistencia</span><strong>92%</strong><small>+8% este mes</small></div>
                </div>
                <div className="landing-agenda">
                  <HeroAppointment time="09:30" name="Mariana Gutiérrez" detail="Fade + barba · Pagada" state="Lista" />
                  <HeroAppointment time="11:00" name="Sofía Ramírez" detail="Corte clásico · Efectivo" state="Confirmada" />
                  <HeroAppointment time="13:30" name="Diego Torres" detail="Corte a domicilio · Pagada" state="Dirección lista" />
                </div>
              </div>
            </div>
            <div className="landing-confirmation">
              <CalendarCheck className="h-4 w-4" />
              <span><strong>Cita confirmada</strong><small>Agenda y cobro sincronizados</small></span>
            </div>
          </div>
        </div>

        <div className="landing-capability-strip">
          <span>AGENDA ONLINE</span>
          <span>PAGOS</span>
          <span>DOMICILIO</span>
          <span>FICHAS</span>
          <span>LEALTAD</span>
        </div>
      </section>

      {/* Franja de garantías */}
      <div className="landing-feature-strip">
        <Reveal delay={0} className="landing-feature">
          <span className="landing-feature-icon"><Timer className="h-5 w-5" /></span>
          <span>
            <strong>Reservas 24/7</strong>
            <small>Cuando tú quieras</small>
          </span>
        </Reveal>
        <Reveal delay={80} className="landing-feature">
          <span className="landing-feature-icon"><Scissors className="h-5 w-5" /></span>
          <span>
            <strong>Barberos expertos</strong>
            <small>Profesionales certificados</small>
          </span>
        </Reveal>
        <Reveal delay={160} className="landing-feature">
          <span className="landing-feature-icon"><CalendarCheck className="h-5 w-5" /></span>
          <span>
            <strong>Sin filas</strong>
            <small>Tu tiempo es valioso</small>
          </span>
        </Reveal>
      </div>

      {/* Experiencia interactiva antes / después */}
      <BarberOSExperience />

      {/* Núcleo único — estadísticas reales del producto, no vanidad */}
      <section className="landing-stats-band">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <Reveal className="mx-auto mb-10 max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">
              Un núcleo, no doce pestañas
            </p>
            <h2 className="font-display mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              La agenda, el cobro y la lealtad viven en el mismo sistema
            </h2>
            <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--ink-muted)" }}>
              Sin agenda de papel, sin hoja de cálculo aparte, sin terminal de cobro
              desconectada. Un mismo lugar para cliente, barbero y administrador.
            </p>
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat delay={0} icon={<Layers className="h-4 w-4" />} value="1" label="Sistema núcleo" nota="Sustituye agenda, chat, hoja de cálculo y terminal" />
            <Stat delay={80} icon={<Timer className="h-4 w-4" />} value="10 min" label="Bloqueo de horario" nota="Sin pago confirmado, se libera solo" />
            <Stat delay={160} icon={<Gift className="h-4 w-4" />} value="Cada 5" label="Citas asistidas" nota="Desbloquean una recompensa automática" />
            <Stat delay={240} icon={<UserCog className="h-4 w-4" />} value="3 roles" label="Un solo panel" nota="Cliente, barbero y administrador" />
          </div>
        </div>
      </section>

      {/* El problema */}
      <section className="landing-section mx-auto max-w-6xl px-6 py-20">
        <Reveal className="mx-auto mb-10 max-w-2xl text-center">
          <h2 className="font-display text-2xl font-bold tracking-tight">El problema que atacamos</h2>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--ink-muted)" }}>
            Las barberías independientes y los salones pequeños pierden ingresos todos los
            días por tres fugas silenciosas:
          </p>
        </Reveal>
        <div className="grid gap-4 sm:grid-cols-3">
          <Reveal delay={0}>
            <Problema
              icon={<CalendarX2 className="h-5 w-5" />}
              title="Citas que no llegan"
              text="Sin confirmación de pago, cancelar a última hora no le cuesta nada al cliente — y el hueco en la agenda ya no se llena."
            />
          </Reveal>
          <Reveal delay={100}>
            <Problema
              icon={<PhoneOff className="h-5 w-5" />}
              title="Agenda por teléfono"
              text="Recepción atada al teléfono, dobles reservas y clientes que se van con quien sí contesta a la primera."
            />
          </Reveal>
          <Reveal delay={200}>
            <Problema
              icon={<UserX className="h-5 w-5" />}
              title="Clientes que no vuelven"
              text="Conseguir un cliente nuevo cuesta mucho más que retener a uno actual, pero nadie mide ni premia la recurrencia."
            />
          </Reveal>
        </div>
      </section>

      {/* Cómo lo resolvemos */}
      <section className="landing-workflow mx-auto max-w-6xl px-6 pb-20">
        <Reveal className="mx-auto mb-10 max-w-2xl text-center">
          <h2 className="font-display text-2xl font-bold tracking-tight">Cómo lo resolvemos</h2>
        </Reveal>
        <div className="grid gap-4 sm:grid-cols-3">
          <Reveal delay={0}>
            <Paso n="01" icon={<CreditCard className="h-5 w-5" />} title="El cliente agenda y elige cómo pagar" text="Disponibilidad en tiempo real, verificación por WhatsApp y pago con tarjeta o en efectivo al llegar. El horario queda apartado 10 minutos: sin confirmación, se libera — adiós a los bloqueos fantasma." />
          </Reveal>
          <Reveal delay={100}>
            <Paso n="02" icon={<CalendarCheck className="h-5 w-5" />} title="El barbero solo atiende" text="La cita cae directo en su Google Calendar u Outlook, con la dirección lista si el servicio es a domicilio. Su agenda del día vive en un panel limpio." />
          </Reveal>
          <Reveal delay={200}>
            <Paso n="03" icon={<Gift className="h-5 w-5" />} title="La barbería fideliza sola" text="Cada 5 citas asistidas y pagadas, el sistema desbloquea automáticamente una recompensa: 20% de descuento o un corte de seguimiento gratis." />
          </Reveal>
        </div>
        <Reveal delay={280} className="mx-auto mt-8 flex w-fit">
          <p
            className="flex items-center gap-2 rounded-full px-5 py-2.5 text-sm shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10"
            style={{ background: "var(--card)", color: "var(--ink-muted)" }}
          >
            <ShieldCheck className="h-4 w-4 text-accent-500" />
            Con seguridad antifraude: captcha invisible, OTP por SMS/WhatsApp, límites
            antibots y datos aislados por barbería.
          </p>
        </Reveal>
      </section>

      {/* Demo por rol */}
      <section className="landing-roles mx-auto max-w-6xl px-6 pb-20">
        <Reveal className="mx-auto mb-10 max-w-2xl text-center">
          <h2 className="font-display text-2xl font-bold tracking-tight">Recorre la demo</h2>
          <p className="mt-2 text-sm" style={{ color: "var(--ink-muted)" }}>
            Tres perfiles, una sola operación. Lo que hagas en un panel se refleja en los
            demás — los datos viven en tu navegador.
          </p>
        </Reveal>
        <div className="grid gap-4 sm:grid-cols-3">
          <Reveal delay={0}>
            <RolCard icon={<User className="h-6 w-6" />} titulo="Cliente" texto="Agenda, paga, acumula recompensas y pide su corte a domicilio." tono="from-brand-500 to-brand-700" />
          </Reveal>
          <Reveal delay={100}>
            <RolCard icon={<Scissors className="h-6 w-6" />} titulo="Barbero" texto="Ve su agenda del día, atiende y marca citas como asistidas." tono="from-accent-400 to-brand-600" />
          </Reveal>
          <Reveal delay={200}>
            <RolCard icon={<ShieldCheck className="h-6 w-6" />} titulo="Administrador" texto="Supervisa ingresos, equipo barbero y el programa de lealtad." tono="from-brand-600 to-accent-500" />
          </Reveal>
        </div>
      </section>

      {/* Precios */}
      <PricingSection />

      {/* Testimonios (personajes de la propia demo) */}
      <section id="testimonios" className="landing-testimonials mx-auto max-w-6xl px-6 py-20">
        <Reveal className="mx-auto mb-10 max-w-2xl text-center">
          <h2 className="font-display text-2xl font-bold tracking-tight">Lo que dicen en Barbería Partum</h2>
          <p className="mt-2 text-sm" style={{ color: "var(--ink-muted)" }}>
            Testimonios de los mismos perfiles que puedes probar en la demo.
          </p>
        </Reveal>
        <div className="grid gap-4 sm:grid-cols-3">
          <Reveal delay={0}>
            <Testimonio
              nombre="Iván Rosales"
              rol="Barbero, especialista en fades"
              texto="Ya no reviso quién pagó antes de cada corte: llego y mi agenda del día ya me dice quién está confirmado y quién paga en efectivo al llegar."
            />
          </Reveal>
          <Reveal delay={100}>
            <Testimonio
              nombre="Bruno Salas"
              rol="Administrador, Barbería Partum"
              texto="Ver los ingresos por barbero y por método de pago en un solo panel nos ahorró la hoja de cálculo que llevábamos a mano cada semana."
            />
          </Reveal>
          <Reveal delay={200}>
            <Testimonio
              nombre="Mariana Gutiérrez"
              rol="Cliente"
              texto="Agendo, elijo si pago con tarjeta o en efectivo, y ya sé exactamente cuánto llevar el día de mi cita. Además veo mis recompensas acumuladas."
            />
          </Reveal>
        </div>
      </section>

      {/* FAQ */}
      <FaqSection />

      {/* CTA final */}
      <section id="contacto" className="landing-final">
        <Reveal className="mx-auto max-w-3xl px-6 py-20 text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Una barbería llena empieza con una agenda que cobra sola.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-white/70">
            Prueba los tres paneles de la demo con datos reales de tu navegador — sin
            registrarte, sin tarjeta.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/login" className="btn-gold card-hover rounded-full px-6 py-3 font-semibold shadow-lg">
              Probar la demo interactiva
            </Link>
            <Link href="#precios" className="card-hover rounded-full border border-white/25 px-6 py-3 font-semibold text-white backdrop-blur transition-colors hover:bg-white/10">
              Ver planes y precios
            </Link>
          </div>
        </Reveal>
      </section>
    </main>
  );
}

function HeroAppointment({
  time,
  name,
  detail,
  state,
}: {
  time: string;
  name: string;
  detail: string;
  state: string;
}) {
  return (
    <div className="hero-appointment">
      <span className="font-num text-[10px]" style={{ color: "var(--ink-muted)" }}>{time}</span>
      <span className="hero-appointment-avatar">{name.charAt(0)}</span>
      <span className="min-w-0 flex-1">
        <strong>{name}</strong>
        <small>{detail}</small>
      </span>
      <span className="hero-appointment-state">{state}</span>
    </div>
  );
}

function Stat({
  icon,
  value,
  label,
  nota,
  delay,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  nota: string;
  delay: number;
}) {
  return (
    <Reveal delay={delay}>
      <div className="landing-stat-card">
        <div className="landing-card-icon">
          {icon}
        </div>
        <p className="font-num text-3xl font-semibold tracking-tight" style={{ color: "var(--ink)" }}>{value}</p>
        <p className="mt-1 text-sm font-medium">{label}</p>
        <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--ink-muted)" }}>
          {nota}
        </p>
      </div>
    </Reveal>
  );
}

function Problema({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div
      className="landing-problem-card"
      style={{ background: "var(--card)" }}
    >
      <div className="landing-problem-icon">
        {icon}
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--ink-muted)" }}>
        {text}
      </p>
    </div>
  );
}

function Paso({ n, icon, title, text }: { n: string; icon: React.ReactNode; title: string; text: string }) {
  return (
    <div
      className="landing-step-card"
      style={{ background: "var(--card)" }}
    >
      <span className="font-num absolute right-5 top-4 text-3xl font-semibold text-slate-100 dark:text-white/5">
        {n}
      </span>
      <div className="landing-card-icon mb-3 h-10 w-10">
        {icon}
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--ink-muted)" }}>
        {text}
      </p>
    </div>
  );
}

function Testimonio({ nombre, rol, texto }: { nombre: string; rol: string; texto: string }) {
  return (
    <div
      className="landing-quote-card"
      style={{ background: "var(--card)" }}
    >
      <Quote className="mb-3 h-6 w-6 text-accent-500" />
      <p className="flex-1 text-sm leading-relaxed" style={{ color: "var(--ink-muted)" }}>
        “{texto}”
      </p>
      <div className="mt-4 flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-accent-400 text-sm font-semibold text-white">
          {nombre.charAt(0)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{nombre}</p>
          <p className="truncate text-xs" style={{ color: "var(--ink-muted)" }}>{rol}</p>
        </div>
      </div>
    </div>
  );
}

function RolCard({ icon, titulo, texto, tono }: { icon: React.ReactNode; titulo: string; texto: string; tono: string }) {
  return (
    <Link
      href="/login"
      className="landing-role-card group"
      style={{ background: "var(--card)" }}
    >
      <div className={`landing-role-icon bg-gradient-to-br ${tono}`}>
        {icon}
      </div>
      <h3 className="font-semibold">{titulo}</h3>
      <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--ink-muted)" }}>
        {texto}
      </p>
      <span className="mt-4 inline-block text-sm font-medium text-brand-600 transition-transform group-hover:translate-x-1">
        Entrar como {titulo.toLowerCase()} →
      </span>
    </Link>
  );
}
