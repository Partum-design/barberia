"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Scissors,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { authDisponible, getSupabaseBrowser } from "@/lib/supabase/client";
import { DESTINO_POR_ROL } from "@/lib/auth/roles";
import { correoDeTelefono, pareceTelefono } from "@/lib/auth/telefono";
import { entrarConGoogle } from "@/lib/auth/google";
import { normalizarTelefono, type Rol } from "@/lib/store";
import { Marca } from "@/components/shell/Marca";
import { LogoGoogle } from "@/components/app/LogoGoogle";
import "@/components/app/app.css";

/**
 * Pasos del acceso:
 *   identificar → escribe su celular o correo (o entra con Google)
 *   clave       → ya tiene contraseña: la escribe
 *   activar     → lo registraron en la barbería y es su primera vez: crea su contraseña
 *   registro    → cliente nuevo: nombre, celular o correo y contraseña
 */
type Paso = "identificar" | "clave" | "activar" | "registro";

const SIN_SUPABASE =
  "El acceso no está configurado: faltan NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.";

function mensajeDeError(mensaje: string) {
  if (/invalid login credentials/i.test(mensaje)) return "La contraseña no es correcta.";
  if (/email not confirmed/i.test(mensaje)) return "Tu correo aún no está confirmado.";
  if (/rate limit|too many/i.test(mensaje)) return "Demasiados intentos. Espera un momento y vuelve a probar.";
  return mensaje;
}

function borrarCookiesDeSesion() {
  for (const par of document.cookie.split(";")) {
    const nombre = par.split("=")[0].trim();
    if (nombre.startsWith("sb-")) document.cookie = `${nombre}=; Max-Age=0; path=/`;
  }
}

/** "5512345678" → "55 1234 5678" */
const telefonoBonito = (t: string) => {
  const d = normalizarTelefono(t);
  return d.length === 10 ? `${d.slice(0, 2)} ${d.slice(2, 6)} ${d.slice(6)}` : t;
};

async function pedir<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });
  const cuerpo = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(cuerpo.error ?? "No pudimos completar el acceso.");
  return cuerpo;
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

  const [paso, setPaso] = useState<Paso>(params.get("modo") === "crear" ? "registro" : "identificar");
  const [identificador, setIdentificador] = useState("");
  /** Correo con el que se inicia sesión (el real o el interno del celular) */
  const [correo, setCorreo] = useState("");
  const [nombre, setNombre] = useState("");
  const [clave, setClave] = useState("");
  const [clave2, setClave2] = useState("");
  const [codigo, setCodigo] = useState("");
  const [conSms, setConSms] = useState(false);
  const [verClave, setVerClave] = useState(false);
  const [cargando, setCargando] = useState<null | "form" | "google">(null);
  const [error, setError] = useState<string | null>(params.get("error"));
  const [aviso, setAviso] = useState<string | null>(null);

  const esTelefono = pareceTelefono(identificador);
  const destino = (rol: Rol) =>
    siguiente && siguiente.startsWith("/") && !siguiente.startsWith("//") ? siguiente : DESTINO_POR_ROL[rol];

  function ir(nuevo: Paso) {
    setPaso(nuevo);
    setError(null);
    setClave("");
    setClave2("");
    setCodigo("");
  }

  /** Inicia sesión en el navegador y sale de esta pantalla. */
  async function entrar(email: string, password: string) {
    const supabase = getSupabaseBrowser();
    if (!supabase) throw new Error(SIN_SUPABASE);
    await supabase.auth.signOut({ scope: "local" }).catch(() => {});
    borrarCookiesDeSesion();
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) throw err;
    const res = await fetch("/api/auth/sesion", { cache: "no-store", credentials: "same-origin" });
    const { rol } = (await res.json().catch(() => ({ rol: null }))) as { rol: Rol | null };
    if (!rol) {
      throw new Error(
        "Tu contraseña es correcta, pero el navegador no guardó la sesión. Permite las cookies para este sitio (o sal del modo incógnito) y vuelve a intentar."
      );
    }
    window.location.assign(destino(rol));
  }

  async function google() {
    setError(null);
    setCargando("google");
    try {
      await entrarConGoogle(siguiente);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo abrir Google.");
      setCargando(null);
    }
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAviso(null);
    if (!authDisponible) return setError(SIN_SUPABASE);
    setCargando("form");
    try {
      if (paso === "identificar") {
        const valor = identificador.trim();
        if (valor.includes("@")) {
          setCorreo(valor.toLowerCase());
          ir("clave");
        } else if (esTelefono) {
          const r = await pedir<{ estado: string; correo?: string; pista?: string; google?: boolean; sms?: boolean }>(
            "/api/auth/telefono",
            { accion: "consultar", telefono: valor }
          );
          setConSms(Boolean(r.sms));
          if (r.estado === "entrar" && r.correo) {
            setCorreo(r.correo);
            ir("clave");
          } else if (r.estado === "activar") {
            ir("activar");
          } else if (r.estado === "nuevo") {
            setAviso("Aún no tienes cuenta con ese número. Créala en un momento.");
            ir("registro");
          } else if (r.estado === "correo") {
            setError(
              r.google
                ? `Ese número está ligado a tu cuenta de Google (${r.pista}). Entra con «Continuar con Google».`
                : `Ese número está ligado a la cuenta ${r.pista}. Escribe tu correo para entrar.`
            );
          }
        } else {
          setError("Escribe tu correo o tu número de celular a 10 dígitos.");
        }
        setCargando(null);
        return;
      }

      if (paso === "clave") {
        await entrar(correo, clave);
        return;
      }

      if (clave.length < 8) throw new Error("Tu contraseña debe tener al menos 8 caracteres.");
      if (clave !== clave2) throw new Error("Las contraseñas no coinciden.");

      if (paso === "activar") {
        await pedir("/api/auth/telefono", { accion: "activar", telefono: identificador, password: clave, codigo });
        await entrar(correoDeTelefono(identificador), clave);
        return;
      }

      // registro
      if (nombre.trim().length < 2) throw new Error("Escribe tu nombre.");
      if (esTelefono) {
        await pedir("/api/auth/telefono", { accion: "registrar", telefono: identificador, nombre, password: clave, codigo });
        await entrar(correoDeTelefono(identificador), clave);
      } else if (identificador.includes("@")) {
        await pedir("/api/auth/registro", { nombre, email: identificador.trim(), password: clave });
        await entrar(identificador.trim().toLowerCase(), clave);
      } else {
        throw new Error("Escribe tu celular a 10 dígitos o tu correo.");
      }
    } catch (err) {
      setError(mensajeDeError(err instanceof Error ? err.message : "No pudimos completar el acceso."));
      setCargando(null);
    }
  }

  const titulos: Record<Paso, { kicker: string; titulo: string; lead: string; accion: string }> = {
    identificar: {
      kicker: "Acceso",
      titulo: "Inicia sesión",
      lead: "Con tu número de celular, tu correo o tu cuenta de Google.",
      accion: "Continuar",
    },
    clave: {
      kicker: "Acceso",
      titulo: "Escribe tu contraseña",
      lead: "Qué gusto verte de nuevo.",
      accion: "Entrar",
    },
    activar: {
      kicker: "Primera vez",
      titulo: "Crea tu contraseña",
      lead: "Ya eres cliente de la barbería. Como es tu primera vez, elige una contraseña: con ella y tu número entrarás siempre.",
      accion: "Crear contraseña y entrar",
    },
    registro: {
      kicker: "Cuenta nueva",
      titulo: "Crea tu cuenta",
      lead: "Reserva en segundos, guarda tus citas y junta sellos en tu tarjeta de lealtad.",
      accion: "Crear cuenta",
    },
  };
  const t = titulos[paso];
  const pideNueva = paso === "activar" || paso === "registro";

  return (
    <main className="login-page">
      <div className="login-shell anim-in">
        <section className="login-story">
          <Link href="/" className="login-brand">
            <span className="login-brand-mark">
              <Scissors className="h-4 w-4" />
            </span>
            <Marca />
          </Link>
          <div className="login-story-copy">
            <p className="login-kicker">Barbería</p>
            <h1>{paso === "activar" ? "Bienvenido a tu cuenta." : "Bienvenido de vuelta."}</h1>
            <p>Tus citas, tu QR de llegada y tu tarjeta de lealtad, en un solo lugar.</p>
          </div>
          <div className="login-flow" aria-label="Lo que puedes hacer">
            <span>
              <CalendarCheck className="h-4 w-4" /> Reserva
            </span>
            <span>
              <Sparkles className="h-4 w-4" /> Sellos
            </span>
            <span>
              <ShieldCheck className="h-4 w-4" /> Avisos
            </span>
          </div>
          <p className="login-local-note">
            <span /> Sesión cifrada · tu contraseña nunca se guarda en texto
          </p>
        </section>

        <section className="login-access">
          {paso === "identificar" ? (
            <Link href="/" className="login-back">
              ← Volver al inicio
            </Link>
          ) : (
            <button type="button" className="login-back" onClick={() => ir("identificar")}>
              <ArrowLeft className="inline h-3.5 w-3.5" /> Volver
            </button>
          )}
          <header>
            <p className="login-kicker" style={{ color: "var(--gold)" }}>
              {t.kicker}
            </p>
            <h2>{t.titulo}</h2>
            <p>{t.lead}</p>
          </header>

          {(paso === "identificar" || paso === "registro") && (
            <>
              <button type="button" className="google-boton" onClick={() => void google()} disabled={cargando !== null || !authDisponible}>
                {cargando === "google" ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogoGoogle className="h-5 w-5" />}
                {paso === "registro" ? "Crear cuenta con Google" : "Continuar con Google"}
              </button>
              <p className="login-divisor">
                <span>o</span>
              </p>
            </>
          )}

          <form onSubmit={enviar}>
            {paso === "registro" && (
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

            {(paso === "identificar" || paso === "registro") && (
              <div className="login-field">
                <label htmlFor="id">Celular o correo</label>
                <div className="login-input-wrap">
                  <input
                    id="id"
                    value={identificador}
                    onChange={(e) => setIdentificador(e.target.value)}
                    placeholder="55 1234 5678 o tu@correo.com"
                    autoComplete="username"
                    inputMode={/^[\d\s+()-]*$/.test(identificador) ? "tel" : "email"}
                    autoFocus
                    required
                  />
                </div>
              </div>
            )}

            {(paso === "clave" || paso === "activar") && (
              <div className="login-chip">
                <Smartphone className="h-4 w-4" />
                <span className="min-w-0 flex-1 truncate">
                  {pareceTelefono(identificador) ? telefonoBonito(identificador) : correo}
                </span>
                <button type="button" onClick={() => ir("identificar")}>
                  Cambiar
                </button>
              </div>
            )}

            {pideNueva && conSms && (
              <div className="login-field">
                <label htmlFor="codigo">Código que te enviamos por SMS</label>
                <div className="login-input-wrap">
                  <input
                    id="codigo"
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="123456"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                  />
                </div>
              </div>
            )}

            {paso !== "identificar" && (
              <div className="login-field">
                <label htmlFor="pass">{pideNueva ? "Crea tu contraseña" : "Contraseña"}</label>
                <div className="login-input-wrap">
                  <input
                    id="pass"
                    type={verClave ? "text" : "password"}
                    value={clave}
                    onChange={(e) => setClave(e.target.value)}
                    placeholder={pideNueva ? "Mínimo 8 caracteres" : "••••••••••"}
                    autoComplete={pideNueva ? "new-password" : "current-password"}
                    minLength={pideNueva ? 8 : undefined}
                    autoFocus={paso !== "registro"}
                    required
                  />
                  <button type="button" onClick={() => setVerClave((v) => !v)} aria-label="Mostrar u ocultar contraseña">
                    {verClave ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            {pideNueva && (
              <div className="login-field">
                <label htmlFor="pass2">Repite tu contraseña</label>
                <div className="login-input-wrap">
                  <input
                    id="pass2"
                    type={verClave ? "text" : "password"}
                    value={clave2}
                    onChange={(e) => setClave2(e.target.value)}
                    placeholder="Otra vez, para confirmar"
                    autoComplete="new-password"
                    required
                  />
                </div>
              </div>
            )}

            {paso === "clave" && !pareceTelefono(identificador) && (
              <div className="login-options">
                <span />
                <Link href={`/restablecer?email=${encodeURIComponent(correo)}`} className="login-forgot">
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
            )}
            {paso === "clave" && pareceTelefono(identificador) && (
              <p className="login-ayuda">
                <KeyRound className="h-3.5 w-3.5" /> ¿Olvidaste tu contraseña? Pídele a la barbería que te la restablezca.
              </p>
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

            <button type="submit" className="btn-gold login-submit" disabled={cargando !== null || !authDisponible}>
              {cargando === "form" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t.accion}
              {paso === "identificar" && cargando !== "form" && <ArrowRight className="h-4 w-4" />}
            </button>
          </form>

          <div className="login-modes">
            {paso === "registro" ? (
              <button type="button" onClick={() => ir("identificar")}>
                Ya tengo cuenta
              </button>
            ) : (
              <button type="button" onClick={() => ir("registro")}>
                ¿Eres cliente nuevo? Crear una cuenta
              </button>
            )}
          </div>

          {!authDisponible && (
            <p className="login-alert is-error" role="alert">
              <AlertCircle /> {SIN_SUPABASE}
            </p>
          )}

          <p className="login-footnote">
            ¿Te registraron en la barbería? Escribe tu número: la primera vez te pediremos crear tu contraseña.
          </p>
        </section>
      </div>
    </main>
  );
}
