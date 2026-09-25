"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  CalendarCheck,
  CheckCircle2,
  CreditCard,
  Eye,
  EyeOff,
  Loader2,
  Scissors,
  ShieldCheck,
} from "lucide-react";
import { authDisponible, getSupabaseBrowser } from "@/lib/supabase/client";
import { DESTINO_POR_ROL, resolverRol } from "@/lib/auth/roles";
import type { Rol } from "@/lib/store";
import { Marca } from "@/components/shell/Marca";

type Modo = "entrar" | "crear";

const SIN_SUPABASE =
  "El acceso no está configurado: faltan NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.";

const TEXTOS: Record<Modo, { titulo: string; lead: string; accion: string }> = {
  entrar: {
    titulo: "Iniciar sesión",
    lead: "Entra con tu correo y contraseña para continuar donde lo dejaste.",
    accion: "Entrar",
  },
  crear: {
    titulo: "Crear cuenta de cliente",
    lead: "Reserva en segundos y guarda tus citas, pagos y tu tarjeta de lealtad.",
    accion: "Crear cuenta",
  },
};

/** Traduce los errores de Supabase Auth que puede ver una persona. */
function mensajeDeError(mensaje: string) {
  if (/invalid login credentials/i.test(mensaje)) return "Correo o contraseña incorrectos.";
  if (/email not confirmed/i.test(mensaje)) return "Tu correo aún no está confirmado.";
  if (/rate limit|too many/i.test(mensaje)) return "Demasiados intentos. Espera un momento y vuelve a probar.";
  return mensaje;
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="login-page" />}>
      <Acceso />
    </Suspense>
  );
}

function Acceso() {
  const params = useSearchParams();

  const siguiente = params.get("next");
  const [modo, setModo] = useState<Modo>("entrar");
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [nombre, setNombre] = useState("");
  const [verClave, setVerClave] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(params.get("error"));
  const [aviso, setAviso] = useState<string | null>(null);

  const texto = TEXTOS[modo];

  /** Destino tras autenticarse: respeta el `next` que puso el middleware. */
  const destino = (rol: Rol) =>
    siguiente && siguiente.startsWith("/") && !siguiente.startsWith("//") ? siguiente : DESTINO_POR_ROL[rol];

  function cambiarModo(nuevo: Modo) {
    setModo(nuevo);
    setError(null);
    setAviso(null);
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAviso(null);

    const supabase = getSupabaseBrowser();
    if (!supabase) {
      setError(SIN_SUPABASE);
      return;
    }

    setCargando(true);
    try {
      if (modo === "crear") {
        const res = await fetch("/api/auth/registro", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nombre, email: correo, password: clave }),
        });
        const cuerpo = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(cuerpo.error ?? "No se pudo crear la cuenta.");
      }

      const { data, error: err } = await supabase.auth.signInWithPassword({
        email: correo.trim(),
        password: clave,
      });
      if (err) throw err;
      // Recarga completa: el middleware y los paneles leen la sesión nueva
      // desde las cookies en la primera petición.
      window.location.assign(destino(resolverRol(data.user)));
    } catch (err) {
      setError(mensajeDeError(err instanceof Error ? err.message : "No pudimos completar el acceso."));
      setCargando(false);
    }
  }

  return (
    <main className="login-page">
      <div className="login-shell anim-in">
        {/* Panel de marca */}
        <section className="login-story">
          <Link href="/" className="login-brand">
            <span className="login-brand-mark">
              <Scissors className="h-4 w-4" />
            </span>
            <Marca />
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
            <span /> Sesión cifrada · cookies HttpOnly y renovación automática
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
                    minLength={2}
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
                  autoComplete={modo === "crear" ? "email" : "username"}
                  required
                />
              </div>
            </div>

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
                  minLength={modo === "crear" ? 8 : undefined}
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

            {modo === "entrar" && (
              <div className="login-options">
                <span />
                <button
                  type="button"
                  className="login-forgot"
                  onClick={() => {
                    setError(null);
                    setAviso(
                      "Pide a la administración de la barbería que te asigne una contraseña nueva desde su panel."
                    );
                  }}
                >
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

            <button type="submit" className="btn-gold login-submit" disabled={cargando || !authDisponible}>
              {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {texto.accion}
            </button>
          </form>

          <div className="login-modes">
            {modo === "entrar" ? (
              <button type="button" onClick={() => cambiarModo("crear")}>
                ¿Eres cliente nuevo? Crear una cuenta
              </button>
            ) : (
              <button type="button" onClick={() => cambiarModo("entrar")}>
                Ya tengo cuenta
              </button>
            )}
          </div>

          {!authDisponible && (
            <p className="login-alert is-error" role="alert">
              <AlertCircle /> {SIN_SUPABASE}
            </p>
          )}

          <p className="login-footnote">
            ¿Trabajas en la barbería? Tu cuenta la crea la administración desde el panel.
          </p>
        </section>
      </div>
    </main>
  );
}
