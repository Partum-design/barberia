"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  CreditCard,
  Eye,
  EyeOff,
  Loader2,
  Mail,
  Scissors,
  ShieldCheck,
  User,
} from "lucide-react";
import { GoogleMark } from "@/components/payments/BrandMarks";
import { authDisponible, getSupabaseBrowser } from "@/lib/supabase/client";
import { DESTINO_POR_ROL } from "@/lib/auth/roles";
import { CUENTAS_DEMO, useDemoStore, type RolDemo } from "@/lib/demo-store";

type Modo = "entrar" | "crear" | "enlace";

const TEXTOS: Record<Modo, { titulo: string; lead: string; accion: string }> = {
  entrar: {
    titulo: "Iniciar sesión",
    lead: "Entra con Google o con tu correo para continuar donde lo dejaste.",
    accion: "Entrar",
  },
  crear: {
    titulo: "Crear cuenta",
    lead: "Reserva en segundos y guarda tus preferencias de corte y tus métodos de pago.",
    accion: "Crear cuenta",
  },
  enlace: {
    titulo: "Entrar sin contraseña",
    lead: "Te enviamos un enlace de un solo uso a tu correo. Sin contraseñas que recordar.",
    accion: "Enviar enlace",
  },
};

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="login-page" />}>
      <Acceso />
    </Suspense>
  );
}

function Acceso() {
  const router = useRouter();
  const params = useSearchParams();
  const { login } = useDemoStore();

  const siguiente = params.get("next");
  const [modo, setModo] = useState<Modo>("entrar");
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [nombre, setNombre] = useState("");
  const [verClave, setVerClave] = useState(false);
  const [cargando, setCargando] = useState<null | "google" | "correo">(null);
  const [error, setError] = useState<string | null>(params.get("error"));
  const [aviso, setAviso] = useState<string | null>(null);

  const texto = TEXTOS[modo];

  /** Destino tras autenticarse: respeta el `next` que puso el middleware. */
  const destino = (rol: RolDemo) =>
    siguiente && siguiente.startsWith("/") ? siguiente : DESTINO_POR_ROL[rol];

  async function entrarConGoogle() {
    setError(null);
    setAviso(null);
    const supabase = getSupabaseBrowser();
    if (!supabase) {
      // Sin Supabase configurado el botón sigue siendo útil: abre la demo,
      // dejando claro en pantalla que no es una sesión real.
      entrarDemo("cliente");
      return;
    }
    setCargando("google");
    const retorno = new URL("/auth/callback", window.location.origin);
    if (siguiente) retorno.searchParams.set("next", siguiente);

    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: retorno.toString(),
        // `consent` fuerza a Google a devolver refresh token la primera vez;
        // sin él, una segunda autorización vuelve sin él y la sesión no se
        // puede renovar en segundo plano.
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
    if (err) {
      setCargando(null);
      setError(err.message);
    }
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAviso(null);

    const supabase = getSupabaseBrowser();
    if (!supabase) {
      entrarDemo("cliente");
      return;
    }

    setCargando("correo");
    try {
      if (modo === "enlace") {
        const retorno = new URL("/auth/callback", window.location.origin);
        if (siguiente) retorno.searchParams.set("next", siguiente);
        const { error: err } = await supabase.auth.signInWithOtp({
          email: correo,
          options: { emailRedirectTo: retorno.toString() },
        });
        if (err) throw err;
        setAviso(`Enlace enviado a ${correo}. Revisa tu bandeja de entrada.`);
        return;
      }

      if (modo === "crear") {
        const { data, error: err } = await supabase.auth.signUp({
          email: correo,
          password: clave,
          options: {
            data: { full_name: nombre, rol: "cliente" },
            emailRedirectTo: new URL("/auth/callback", window.location.origin).toString(),
          },
        });
        if (err) throw err;
        if (!data.session) {
          setAviso("Cuenta creada. Confirma tu correo para poder entrar.");
          return;
        }
        router.push(destino("cliente"));
        return;
      }

      const { data, error: err } = await supabase.auth.signInWithPassword({
        email: correo,
        password: clave,
      });
      if (err) throw err;
      const rol = (data.user?.app_metadata?.rol ?? data.user?.user_metadata?.rol) as RolDemo | undefined;
      router.push(destino(rol ?? "cliente"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos completar el acceso.");
    } finally {
      setCargando(null);
    }
  }

  function entrarDemo(rol: RolDemo) {
    login(rol);
    router.push(destino(rol));
  }

  const cuentas: { rol: RolDemo; icon: React.ReactNode; desc: string }[] = [
    {
      rol: "cliente",
      icon: <User className="h-6 w-6" />,
      desc: "Consulta tus citas, agenda nuevas y revisa tu programa de recompensas.",
    },
    {
      rol: "barbero",
      icon: <Scissors className="h-6 w-6" />,
      desc: "Revisa tu agenda del día, atiende a domicilio y marca citas como asistidas.",
    },
    {
      rol: "admin",
      icon: <ShieldCheck className="h-6 w-6" />,
      desc: "Supervisa ingresos, marketing, equipo, inventario y caja de la barbería.",
    },
  ];

  return (
    <main className="login-page">
      <div className="login-shell anim-in">
        {/* Panel de marca */}
        <section className="login-story">
          <Link href="/" className="login-brand">
            <span className="login-brand-mark">
              <Scissors className="h-4 w-4" />
            </span>
            <span>
              Hair<strong>cut</strong>
            </span>
          </Link>
          <div className="login-story-copy">
            <p className="login-kicker">Barbershop</p>
            <h1>Bienvenido de vuelta.</h1>
            <p>Inicia sesión para continuar gestionando tus citas, tus pagos y tu estilo.</p>
          </div>
          <div className="login-flow" aria-label="Flujo conectado">
            <span>
              <CalendarCheck className="h-4 w-4" /> Reserva
            </span>
            <span>
              <CreditCard className="h-4 w-4" /> Pago
            </span>
            <span>
              <ShieldCheck className="h-4 w-4" /> Seguimiento
            </span>
          </div>
          <p className="login-local-note">
            <span />{" "}
            {authDisponible
              ? "Sesión cifrada · cookies HttpOnly y renovación automática"
              : "Modo demostración · los datos viven en este navegador"}
          </p>
        </section>

        {/* Panel de acceso */}
        <section className="login-access">
          <Link href="/" className="login-back">
            ← Volver al inicio
          </Link>
          <header>
            <p className="login-kicker" style={{ color: "var(--gold)" }}>
              Acceso
            </p>
            <h2>{texto.titulo}</h2>
            <p>{texto.lead}</p>
          </header>

          {/* Google primero: es la vía más rápida y la que menos fricción tiene */}
          <button type="button" onClick={entrarConGoogle} className="login-google" disabled={cargando !== null}>
            {cargando === "google" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <GoogleMark className="h-4 w-4" />
            )}
            Continuar con Google
          </button>

          <div className="login-divider">
            <span />o con tu correo<span />
          </div>

          <form onSubmit={enviar}>
            {modo === "crear" && (
              <div className="login-field">
                <label htmlFor="nombre">Nombre completo</label>
                <div className="login-input-wrap">
                  <input
                    id="nombre"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Tu nombre"
                    autoComplete="name"
                    required
                  />
                </div>
              </div>
            )}

            <div className="login-field">
              <label htmlFor="email">Correo electrónico</label>
              <div className="login-input-wrap">
                <input
                  id="email"
                  type="email"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  placeholder="tu@email.com"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            {modo !== "enlace" && (
              <div className="login-field">
                <label htmlFor="pass">Contraseña</label>
                <div className="login-input-wrap">
                  <input
                    id="pass"
                    type={verClave ? "text" : "password"}
                    value={clave}
                    onChange={(e) => setClave(e.target.value)}
                    placeholder="••••••••••"
                    autoComplete={modo === "crear" ? "new-password" : "current-password"}
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setVerClave((v) => !v)}
                    aria-label="Mostrar u ocultar contraseña"
                  >
                    {verClave ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            {modo === "entrar" && (
              <div className="login-options">
                <label className="login-remember">
                  <input type="checkbox" defaultChecked /> Recordarme
                </label>
                <button type="button" className="login-forgot" onClick={() => setModo("enlace")}>
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
            )}

            {error && (
              <p className="login-alert is-error" role="alert">
                <AlertCircle /> {error}
              </p>
            )}
            {aviso && (
              <p className="login-alert is-ok" role="status">
                <CheckCircle2 /> {aviso}
              </p>
            )}

            <button type="submit" className="btn-gold login-submit" disabled={cargando !== null}>
              {cargando === "correo" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {texto.accion}
            </button>
          </form>

          <div className="login-modes">
            {modo !== "enlace" && (
              <button type="button" onClick={() => setModo("enlace")}>
                <Mail /> Entrar con enlace mágico
              </button>
            )}
            {modo !== "entrar" && (
              <button type="button" onClick={() => setModo("entrar")}>
                Ya tengo cuenta
              </button>
            )}
            {modo !== "crear" && (
              <button type="button" onClick={() => setModo("crear")}>
                Crear una cuenta
              </button>
            )}
          </div>

          {/* Acceso rápido a los tres paneles de la demo */}
          <div className="login-divider">
            <span />o entra a la demo como<span />
          </div>
          <div className="login-role-list">
            {cuentas.map((c, i) => {
              const cuenta = CUENTAS_DEMO[c.rol];
              return (
                <button
                  key={c.rol}
                  onClick={() => entrarDemo(c.rol)}
                  className={`login-role anim-in anim-d${i + 1}`}
                >
                  <span className={`login-role-icon role-${c.rol}`}>{c.icon}</span>
                  <span className="min-w-0 flex-1">
                    <strong>{cuenta.nombre}</strong>
                    <small>{cuenta.subtitulo}</small>
                    <span className="login-role-copy">{c.desc}</span>
                  </span>
                  <ArrowRight className="login-role-arrow" />
                </button>
              );
            })}
          </div>

          <p className="login-footnote">
            {authDisponible
              ? "El acceso real usa Supabase Auth con OAuth de Google (PKCE), verificación de correo y sesión en cookies HttpOnly."
              : "Configura NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY para activar el acceso real con Google; mientras tanto, estos accesos abren la demo."}
          </p>
        </section>
      </div>
    </main>
  );
}
