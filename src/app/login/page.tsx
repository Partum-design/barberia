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
  ShieldCheck,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { authDisponible, getSupabaseBrowser } from "@/lib/supabase/client";
import { DESTINO_POR_ROL } from "@/lib/auth/roles";
import { pareceTelefono } from "@/lib/auth/telefono";
import { entrarConGoogle } from "@/lib/auth/google";
import { normalizarTelefono, type Rol } from "@/lib/store";
import { Marca } from "@/components/shell/Marca";
import { LogoCM } from "@/components/shell/LogoCM";
import { LogoGoogle } from "@/components/app/LogoGoogle";
import {
  Campo,
  enfocarPrimerError,
  errorDeClaveNueva,
  errorDeIdentificador,
  errorDeNombre,
  errorDeRepetir,
  hayErrores,
  type Errores,
} from "@/components/formularios/Campo";
import "@/components/app/app.css";

/**
 * Pasos del acceso:
 *   identificar → escribe su celular o correo (o entra con Google)
 *   clave       → ya tiene contraseña: la escribe
 *   activar     → lo registraron en la barbería (o reservó con su número) y es
 *                 su primera vez: crea su contraseña
 *   registro    → cliente nuevo: nombre, celular o correo y contraseña
 */
type Paso = "identificar" | "clave" | "activar" | "registro";

const SIN_SUPABASE =
  "El acceso no está configurado: faltan NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.";

function mensajeDeError(mensaje: string) {
  if (/invalid login credentials/i.test(mensaje)) return "La contraseña no es correcta.";
  if (/email not confirmed/i.test(mensaje)) return "Tu correo aún no está confirmado.";
  if (/rate limit|too many/i.test(mensaje)) return "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.";
  if (/failed to fetch|network/i.test(mensaje)) return "No hay conexión. Revisa tu internet e inténtalo de nuevo.";
  return mensaje;
}

/** "5512345678" → "55 1234 5678" */
const telefonoBonito = (t: string) => {
  const d = normalizarTelefono(t);
  return d.length === 10 ? `${d.slice(0, 2)} ${d.slice(2, 6)} ${d.slice(6)}` : t;
};

class ErrorAcceso extends Error {
  constructor(
    message: string,
    public bloqueado = false
  ) {
    super(message);
  }
}

async function pedir<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });
  const cuerpo = (await res.json().catch(() => ({}))) as T & { error?: string; bloqueado?: boolean };
  if (!res.ok) throw new ErrorAcceso(cuerpo.error ?? "No pudimos completar el acceso.", Boolean(cuerpo.bloqueado));
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
  const [identificador, setIdentificador] = useState(params.get("tel") ?? params.get("u") ?? "");
  const [nombre, setNombre] = useState("");
  const [clave, setClave] = useState("");
  const [clave2, setClave2] = useState("");
  const [codigo, setCodigo] = useState("");
  const [conSms, setConSms] = useState(false);
  const [verClave, setVerClave] = useState(false);
  const [cargando, setCargando] = useState<null | "form" | "google">(null);
  const [error, setError] = useState<string | null>(params.get("error"));
  const [errores, setErrores] = useState<Errores>({});
  const [aviso, setAviso] = useState<string | null>(null);
  const [bloqueado, setBloqueado] = useState(false);

  const esTelefono = pareceTelefono(identificador);
  const destino = (rol: Rol) =>
    siguiente && siguiente.startsWith("/") && !siguiente.startsWith("//") ? siguiente : DESTINO_POR_ROL[rol];
  const enlaceRecuperar = `/recuperar${identificador.trim() ? `?u=${encodeURIComponent(identificador.trim())}` : ""}`;

  function ir(nuevo: Paso) {
    setPaso(nuevo);
    setError(null);
    setErrores({});
    setBloqueado(false);
    setClave("");
    setClave2("");
    setCodigo("");
  }

  /**
   * Inicia sesión en el servidor (que limita los intentos y escribe las
   * cookies) y sale de esta pantalla.
   */
  async function entrar(password: string) {
    if (!authDisponible) throw new Error(SIN_SUPABASE);
    await getSupabaseBrowser()?.auth.signOut({ scope: "local" }).catch(() => {});
    await pedir<{ rol: Rol }>("/api/auth/entrar", { identificador: identificador.trim(), password });
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

  function validar(): boolean {
    const e: Errores = {};
    if (paso === "registro") e.nombre = errorDeNombre(nombre);
    if (paso === "identificar" || paso === "registro") e.id = errorDeIdentificador(identificador);
    if (paso === "clave" && !clave) e.pass = "Escribe tu contraseña.";
    if (paso === "activar" || paso === "registro") {
      e.pass = errorDeClaveNueva(clave);
      e.pass2 = errorDeRepetir(clave, clave2);
    }
    if ((paso === "activar" || paso === "registro") && conSms && !/^\d{6}$/.test(codigo)) {
      e.codigo = "Escribe el código de 6 números.";
    }
    setErrores(e);
    if (hayErrores(e)) {
      enfocarPrimerError(e, ["nombre", "id", "codigo", "pass", "pass2"]);
      return false;
    }
    return true;
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAviso(null);
    if (!authDisponible) return setError(SIN_SUPABASE);
    if (!validar()) return;
    setCargando("form");
    try {
      if (paso === "identificar") {
        const valor = identificador.trim();
        if (valor.includes("@")) {
          ir("clave");
        } else {
          const r = await pedir<{ estado: string; pista?: string; google?: boolean; sms?: boolean }>("/api/auth/telefono", {
            accion: "consultar",
            telefono: valor,
          });
          setConSms(Boolean(r.sms));
          if (r.estado === "entrar") {
            setAviso("Ya eres cliente. Escribe tu contraseña.");
            ir("clave");
          } else if (r.estado === "activar") {
            ir("activar");
          } else if (r.estado === "nuevo") {
            setAviso("Aún no tienes cuenta con ese número. Créala en un momento.");
            ir("registro");
          } else if (r.estado === "correo") {
            setError(`Ese número está ligado a tu cuenta de Google (${r.pista}). Entra con «Continuar con Google».`);
          }
        }
        setCargando(null);
        return;
      }

      if (paso === "clave") {
        await entrar(clave);
        return;
      }

      if (paso === "activar") {
        await pedir("/api/auth/telefono", { accion: "activar", telefono: identificador, password: clave, codigo });
        await entrar(clave);
        return;
      }

      // registro
      if (esTelefono) {
        await pedir("/api/auth/telefono", { accion: "registrar", telefono: identificador, nombre, password: clave, codigo });
      } else {
        await pedir("/api/auth/registro", { nombre, email: identificador.trim(), password: clave });
      }
      await entrar(clave);
    } catch (err) {
      if (err instanceof ErrorAcceso && err.bloqueado) setBloqueado(true);
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
      lead: "Guarda tus citas y junta sellos en tu tarjeta de lealtad.",
      accion: "Crear cuenta",
    },
  };
  const t = titulos[paso];
  const pideNueva = paso === "activar" || paso === "registro";
  const bienvenida =
    paso === "registro" ? "Bienvenido a CortMart." : paso === "activar" ? "Bienvenido a tu cuenta." : "Bienvenido de vuelta.";

  return (
    <main className="login-page">
      <div className="login-shell anim-in">
        <section className="login-story" aria-label="CortMart">
          <Link href="/" className="login-brand">
            <span className="login-brand-mark">
              <LogoCM />
            </span>
            <Marca />
          </Link>
          <div className="login-story-copy">
            <p className="login-kicker">Barbería</p>
            <p className="login-story-title">{bienvenida}</p>
            <p>Tus citas, tu QR de llegada y tu tarjeta de lealtad, en un solo lugar.</p>
          </div>
          <div className="login-flow" aria-label="Lo que puedes hacer">
            <span>
              <CalendarCheck className="h-4 w-4" aria-hidden /> Reserva
            </span>
            <span>
              <Sparkles className="h-4 w-4" aria-hidden /> Sellos
            </span>
            <span>
              <ShieldCheck className="h-4 w-4" aria-hidden /> Avisos
            </span>
          </div>
          <p className="login-local-note">
            <span aria-hidden /> Sesión cifrada · tu contraseña nunca se guarda en texto
          </p>
        </section>

        <section className="login-access">
          {paso === "identificar" ? (
            <Link href="/" className="login-back">
              <ArrowLeft className="inline h-4 w-4" aria-hidden /> Volver al inicio
            </Link>
          ) : (
            <button type="button" className="login-back" onClick={() => ir("identificar")}>
              <ArrowLeft className="inline h-4 w-4" aria-hidden /> Volver
            </button>
          )}
          <header>
            <p className="login-kicker" style={{ color: "var(--gold)" }}>
              {t.kicker}
            </p>
            <h1 className="login-title-lg">{t.titulo}</h1>
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

          <form onSubmit={enviar} noValidate>
            {paso === "registro" && (
              <Campo id="nombre" label="Nombre completo" error={errores.nombre}>
                {(aria) => (
                  <input {...aria} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Tu nombre" autoComplete="name" />
                )}
              </Campo>
            )}

            {(paso === "identificar" || paso === "registro") && (
              <Campo id="id" label="Celular o correo" ayuda="Tu celular a 10 dígitos o tu correo electrónico." error={errores.id}>
                {(aria) => (
                  <input
                    {...aria}
                    type="text"
                    value={identificador}
                    onChange={(e) => setIdentificador(e.target.value)}
                    placeholder="55 1234 5678 o tu@correo.com"
                    autoComplete="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                )}
              </Campo>
            )}

            {(paso === "clave" || paso === "activar") && (
              <div className="login-chip">
                <Smartphone className="h-4 w-4" aria-hidden />
                <span className="min-w-0 flex-1 truncate">
                  {esTelefono ? telefonoBonito(identificador) : identificador.trim().toLowerCase()}
                </span>
                {/* Para el gestor de contraseñas: a qué cuenta pertenece la clave */}
                <input type="text" name="username" autoComplete="username" value={identificador} readOnly hidden />
                <button type="button" onClick={() => ir("identificar")}>
                  Cambiar
                </button>
              </div>
            )}

            {pideNueva && conSms && (
              <Campo id="codigo" label="Código que te enviamos por SMS" error={errores.codigo}>
                {(aria) => (
                  <input
                    {...aria}
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="123456"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                  />
                )}
              </Campo>
            )}

            {paso !== "identificar" && (
              <Campo
                id="pass"
                label={pideNueva ? "Crea tu contraseña" : "Contraseña"}
                ayuda={pideNueva ? "Mínimo 8 caracteres." : undefined}
                error={errores.pass}
              >
                {(aria) => (
                  <>
                    <input
                      {...aria}
                      type={verClave ? "text" : "password"}
                      value={clave}
                      onChange={(e) => setClave(e.target.value)}
                      autoComplete={pideNueva ? "new-password" : "current-password"}
                      autoFocus={paso === "clave"}
                    />
                    <button
                      type="button"
                      onClick={() => setVerClave((v) => !v)}
                      aria-label={verClave ? "Ocultar contraseña" : "Mostrar contraseña"}
                      aria-pressed={verClave}
                    >
                      {verClave ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </>
                )}
              </Campo>
            )}

            {paso === "clave" && (
              <p className="login-options">
                <Link href={enlaceRecuperar} className={`login-forgot ${bloqueado ? "is-resaltado" : ""}`}>
                  <KeyRound className="h-4 w-4" aria-hidden /> ¿Olvidaste tu contraseña?
                </Link>
              </p>
            )}

            {pideNueva && (
              <Campo id="pass2" label="Repite tu contraseña" error={errores.pass2}>
                {(aria) => (
                  <input
                    {...aria}
                    type={verClave ? "text" : "password"}
                    value={clave2}
                    onChange={(e) => setClave2(e.target.value)}
                    autoComplete="new-password"
                  />
                )}
              </Campo>
            )}

            {error && (
              <p className="login-alert is-error" role="alert">
                <AlertCircle aria-hidden /> {error}
              </p>
            )}
            {aviso && (
              <p className="login-alert is-ok" role="status">
                <CheckCircle2 aria-hidden /> {aviso}
              </p>
            )}

            <button type="submit" className="btn-gold login-submit" disabled={cargando !== null || !authDisponible}>
              {cargando === "form" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t.accion}
              {paso === "identificar" && cargando !== "form" && <ArrowRight className="h-4 w-4" aria-hidden />}
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
            {paso === "identificar" && <Link href={enlaceRecuperar}>¿Olvidaste tu contraseña?</Link>}
          </div>

          {!authDisponible && (
            <p className="login-alert is-error" role="alert">
              <AlertCircle aria-hidden /> {SIN_SUPABASE}
            </p>
          )}

          <p className="login-footnote">
            ¿Te registraron en la barbería o reservaste sólo con tu número? Escríbelo: la primera vez te pediremos crear tu contraseña.
          </p>
        </section>
      </div>
    </main>
  );
}
