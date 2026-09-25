"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, Mail, Scissors } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { DESTINO_POR_ROL, resolverRol } from "@/lib/auth/roles";
import { Marca } from "@/components/shell/Marca";

// Restablecer la contraseña en pasos cortos y con letra grande:
//
//   1. La persona escribe su correo y recibe un código de 6 números.
//   2. Escribe el código y su contraseña nueva.
//
// El correo también trae un botón que abre esta página con el código ya
// validado (token_hash); funciona aunque se abra en otro teléfono o
// computadora, porque no depende de la sesión del navegador que lo pidió.

type Paso = "correo" | "codigo" | "nueva" | "lista";

const ESPERA_REENVIO = 60;

function mensajeDeError(mensaje: string) {
  if (/expired|invalid|not found/i.test(mensaje)) return "El código no es correcto o ya venció. Pide uno nuevo.";
  if (/rate limit|too many|seconds/i.test(mensaje)) return "Ya te enviamos un código hace poco. Espera un minuto y vuelve a intentar.";
  if (/same.*password|different from the old/i.test(mensaje)) return "La contraseña nueva debe ser distinta a la anterior.";
  if (/at least|characters|weak/i.test(mensaje)) return "La contraseña debe tener al menos 8 letras o números.";
  if (/sending|smtp|email/i.test(mensaje)) return "No pudimos enviar el correo. Intenta más tarde o pide ayuda en la barbería.";
  return mensaje;
}

export default function RestablecerPage() {
  return (
    <Suspense fallback={<main className="login-page" />}>
      <Restablecer />
    </Suspense>
  );
}

function Restablecer() {
  const params = useSearchParams();
  const [paso, setPaso] = useState<Paso>("correo");
  const [correo, setCorreo] = useState(params.get("email") ?? "");
  const [codigo, setCodigo] = useState("");
  const [clave, setClave] = useState("");
  const [clave2, setClave2] = useState("");
  const [verClave, setVerClave] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [espera, setEspera] = useState(0);
  const tituloRef = useRef<HTMLHeadingElement>(null);

  // Llegó desde el correo: se valida el enlace y se pasa directo a escribir
  // la contraseña nueva. Hay dos formatos:
  //   · token_hash — el de nuestra plantilla; sirve en cualquier dispositivo.
  //   · code — el enlace estándar de Supabase (PKCE); sólo sirve en el mismo
  //     navegador donde se pidió el cambio.
  useEffect(() => {
    const tokenHash = params.get("token_hash");
    const code = params.get("code");
    const fallo = params.get("error_description") ?? params.get("error");
    if (fallo) {
      setError("El enlace ya se usó o venció. Escribe tu correo para recibir uno nuevo.");
      return;
    }
    if (!tokenHash && !code) return;
    const supabase = getSupabaseBrowser();
    if (!supabase) return;
    setCargando(true);
    const validar = tokenHash
      ? supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" })
      : supabase.auth.exchangeCodeForSession(code!);
    validar
      .then(({ error: err }) => {
        if (err) {
          setError(
            code
              ? "Abre el enlace en el mismo teléfono o computadora donde pediste el cambio, o pide uno nuevo aquí."
              : "El enlace ya se usó o venció. Escribe tu correo para recibir uno nuevo."
          );
          setPaso("correo");
        } else {
          setPaso("nueva");
        }
      })
      .finally(() => setCargando(false));
  }, [params]);

  // Lleva el foco al título de cada paso: los lectores de pantalla anuncian
  // el cambio y quien navega con teclado empieza desde arriba.
  useEffect(() => {
    tituloRef.current?.focus();
  }, [paso]);

  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  async function enviarCodigo(e?: React.FormEvent) {
    e?.preventDefault();
    const supabase = getSupabaseBrowser();
    if (!supabase) return;
    setError(null);
    setCargando(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(correo.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/restablecer`,
    });
    setCargando(false);
    if (err) {
      setError(mensajeDeError(err.message));
      return;
    }
    setEspera(ESPERA_REENVIO);
    setPaso("codigo");
  }

  async function validarCodigo(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseBrowser();
    if (!supabase) return;
    setError(null);
    setCargando(true);
    const { error: err } = await supabase.auth.verifyOtp({
      email: correo.trim().toLowerCase(),
      token: codigo,
      type: "recovery",
    });
    setCargando(false);
    if (err) {
      setError(mensajeDeError(err.message));
      return;
    }
    setPaso("nueva");
  }

  async function guardarClave(e: React.FormEvent) {
    e.preventDefault();
    if (clave !== clave2) {
      setError("Las dos contraseñas no coinciden. Escríbelas otra vez.");
      return;
    }
    const supabase = getSupabaseBrowser();
    if (!supabase) return;
    setError(null);
    setCargando(true);
    const { data, error: err } = await supabase.auth.updateUser({ password: clave });
    setCargando(false);
    if (err || !data.user) {
      setError(mensajeDeError(err?.message ?? "No se pudo guardar la contraseña."));
      return;
    }
    setPaso("lista");
    setTimeout(() => window.location.assign(DESTINO_POR_ROL[resolverRol(data.user)]), 2500);
  }

  const titulos: Record<Paso, { titulo: string; lead: string }> = {
    correo: {
      titulo: "¿Olvidaste tu contraseña?",
      lead: "Escribe tu correo. Te enviaremos un código de 6 números para crear una contraseña nueva.",
    },
    codigo: {
      titulo: "Revisa tu correo",
      lead: `Te enviamos un correo a ${correo}. Escribe aquí el código de 6 números que viene en él, o presiona el botón del correo.`,
    },
    nueva: { titulo: "Crea tu contraseña nueva", lead: "Usa al menos 8 letras o números. Anótala en un lugar seguro." },
    lista: { titulo: "¡Listo!", lead: "Tu contraseña cambió. Te llevamos a tu cuenta…" },
  };
  const { titulo, lead } = titulos[paso];

  const campoClave = (
    <>
      <div className="login-field">
        <label htmlFor="clave">Contraseña nueva</label>
        <div className="login-input-wrap">
          <input
            id="clave"
            type={verClave ? "text" : "password"}
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
          <button type="button" onClick={() => setVerClave((v) => !v)} aria-label={verClave ? "Ocultar contraseña" : "Mostrar contraseña"}>
            {verClave ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <div className="login-field">
        <label htmlFor="clave2">Escríbela otra vez</label>
        <div className="login-input-wrap">
          <input
            id="clave2"
            type={verClave ? "text" : "password"}
            value={clave2}
            onChange={(e) => setClave2(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>
      </div>
    </>
  );

  return (
    <main className="login-page">
      <div className="login-shell login-shell-single anim-in">
        <section className="login-access">
          <div className="flex items-center justify-between gap-3">
            <Link href="/" className="login-brand">
              <span className="login-brand-mark">
                <Scissors className="h-4 w-4" />
              </span>
              <Marca />
            </Link>
            <Link href="/login" className="login-back">
              ← Volver a iniciar sesión
            </Link>
          </div>

          <header>
            <p className="login-kicker" style={{ color: "var(--gold)" }}>
              {paso === "lista" ? "Contraseña actualizada" : `Paso ${{ correo: 1, codigo: 2, nueva: 3 }[paso]} de 3`}
            </p>
            <h1 ref={tituloRef} tabIndex={-1} className="login-title-lg">
              {titulo}
            </h1>
            <p className="login-lead-lg">{lead}</p>
          </header>

          {error && (
            <p className="login-alert is-error" role="alert">
              <AlertCircle /> {error}
            </p>
          )}

          {cargando && paso === "correo" && (params.get("token_hash") || params.get("code")) && (
            <p className="login-alert is-ok" role="status">
              <Loader2 className="animate-spin" /> Revisando el enlace…
            </p>
          )}

          {paso === "correo" && (
            <form onSubmit={enviarCodigo}>
              <div className="login-field">
                <label htmlFor="email">Tu correo electrónico</label>
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
              <button type="submit" className="btn-gold login-submit" disabled={cargando}>
                {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                Enviarme el código
              </button>
            </form>
          )}

          {paso === "codigo" && (
            <form onSubmit={validarCodigo}>
              <div className="login-field">
                <label htmlFor="codigo">Código de 6 números</label>
                <div className="login-input-wrap">
                  <input
                    id="codigo"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
                    className="login-code-input"
                    aria-describedby="ayuda-codigo"
                    required
                  />
                </div>
                <p id="ayuda-codigo" className="login-help">
                  ¿No te llegó? Busca en la carpeta de correo no deseado o spam.
                </p>
              </div>
              <button type="submit" className="btn-gold login-submit" disabled={cargando || codigo.length !== 6}>
                {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                Continuar
              </button>
              <div className="login-modes">
                <button type="button" onClick={() => enviarCodigo()} disabled={espera > 0 || cargando}>
                  {espera > 0 ? `Puedes pedir otro código en ${espera} s` : "Enviarme otro código"}
                </button>
                <button type="button" onClick={() => { setPaso("correo"); setCodigo(""); setError(null); }}>
                  Usar otro correo
                </button>
              </div>
            </form>
          )}

          {paso === "nueva" && (
            <form onSubmit={guardarClave}>
              {campoClave}
              <button type="submit" className="btn-gold login-submit" disabled={cargando}>
                {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                Guardar contraseña
              </button>
            </form>
          )}

          {paso === "lista" && (
            <p className="login-alert is-ok" role="status">
              <CheckCircle2 /> Contraseña guardada.
            </p>
          )}

          <p className="login-footnote">
            ¿Necesitas ayuda? En la barbería con gusto te asignamos una contraseña nueva.
          </p>
        </section>
      </div>
    </main>
  );
}
