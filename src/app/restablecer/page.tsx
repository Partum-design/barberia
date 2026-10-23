"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertCircle, ArrowLeft, CalendarCheck, CheckCircle2, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { Marca } from "@/components/shell/Marca";
import { LogoCM } from "@/components/shell/LogoCM";
import {
  Campo,
  enfocarPrimerError,
  errorDeClaveNueva,
  errorDeRepetir,
  hayErrores,
  type Errores,
} from "@/components/formularios/Campo";
import "@/components/app/app.css";

// Crear la contraseña nueva. Llega por uno de tres caminos:
//
//   · ?token=…       enlace de un solo uso que generó la barbería (clientes
//                    sólo con celular). Lo valida y lo gasta el servidor.
//   · ?token_hash=…  botón del correo de Supabase (cliente con correo).
//   · ?email=…       escribió el código de 6 números que trae ese correo.
//
// Al guardar se cierran las demás sesiones de la cuenta y se entra aquí.

type Paso = "revisando" | "codigo" | "nueva" | "lista" | "invalido";

function mensajeDeError(mensaje: string) {
  if (/expired|invalid|not found/i.test(mensaje)) return "El código no es correcto o ya venció. Pide uno nuevo.";
  if (/rate limit|too many|seconds/i.test(mensaje)) return "Espera unos minutos e inténtalo de nuevo.";
  if (/same.*password|different from the old/i.test(mensaje)) return "La contraseña nueva debe ser distinta a la anterior.";
  if (/at least|characters|weak/i.test(mensaje)) return "La contraseña debe tener al menos 8 caracteres.";
  return mensaje;
}

async function api(body: Record<string, unknown>) {
  const res = await fetch("/api/auth/restablecer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });
  const cuerpo = (await res.json().catch(() => ({}))) as { error?: string; nombre?: string; rol?: string | null };
  return { ok: res.ok, status: res.status, ...cuerpo };
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
  const token = params.get("token");
  const tokenHash = params.get("token_hash");
  const code = params.get("code");
  const email = params.get("email") ?? "";
  const falloProveedor = params.get("error_description") ?? params.get("error");

  const [paso, setPaso] = useState<Paso>(token || tokenHash || code ? "revisando" : email ? "codigo" : "invalido");
  const [nombre, setNombre] = useState("");
  const [codigo, setCodigo] = useState("");
  const [clave, setClave] = useState("");
  const [clave2, setClave2] = useState("");
  const [verClave, setVerClave] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errores, setErrores] = useState<Errores>({});
  const tituloRef = useRef<HTMLHeadingElement>(null);

  // Valida el enlace al abrir la página.
  useEffect(() => {
    if (falloProveedor) {
      setPaso("invalido");
      return;
    }
    if (token) {
      void api({ accion: "validar", token }).then((r) => {
        if (r.ok) {
          setNombre(r.nombre ?? "");
          setPaso("nueva");
        } else {
          setPaso("invalido");
        }
      });
      return;
    }
    if (!tokenHash && !code) return;
    const supabase = getSupabaseBrowser();
    if (!supabase) return setPaso("invalido");
    const validar = tokenHash
      ? supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" })
      : supabase.auth.exchangeCodeForSession(code!);
    void validar.then(({ error: err }) => setPaso(err ? "invalido" : "nueva"));
  }, [token, tokenHash, code, falloProveedor]);

  // El foco va al título de cada paso: el lector de pantalla anuncia el cambio.
  useEffect(() => {
    if (paso !== "revisando") tituloRef.current?.focus();
  }, [paso]);

  async function validarCodigo(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(codigo)) {
      setErrores({ codigo: "Escribe el código de 6 números." });
      document.getElementById("codigo")?.focus();
      return;
    }
    const supabase = getSupabaseBrowser();
    if (!supabase) return;
    setErrores({});
    setError(null);
    setCargando(true);
    const { error: err } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: codigo, type: "recovery" });
    setCargando(false);
    if (err) return setError(mensajeDeError(err.message));
    setPaso("nueva");
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    const errs: Errores = { clave: errorDeClaveNueva(clave), clave2: errorDeRepetir(clave, clave2) };
    setErrores(errs);
    if (hayErrores(errs)) {
      enfocarPrimerError(errs, ["clave", "clave2"]);
      return;
    }
    setError(null);
    setCargando(true);
    try {
      if (token) {
        const r = await api({ accion: "guardar", token, password: clave });
        if (!r.ok) {
          if (r.status === 410) return setPaso("invalido");
          throw new Error(r.error ?? "No se pudo guardar la contraseña.");
        }
      } else {
        const supabase = getSupabaseBrowser();
        if (!supabase) throw new Error("El acceso no está configurado.");
        const { error: err } = await supabase.auth.updateUser({ password: clave });
        if (err) throw err;
        // Las demás sesiones (otro teléfono, otra computadora) se cierran.
        await supabase.auth.signOut({ scope: "others" }).catch(() => {});
        await api({ accion: "registrar_cambio" });
      }
      setPaso("lista");
    } catch (err) {
      setError(mensajeDeError(err instanceof Error ? err.message : "No se pudo guardar la contraseña."));
    } finally {
      setCargando(false);
    }
  }

  const titulos: Record<Paso, { kicker: string; titulo: string; lead: string }> = {
    revisando: { kicker: "Un momento", titulo: "Revisando tu enlace…", lead: "" },
    codigo: {
      kicker: "Recuperar acceso",
      titulo: "Escribe tu código",
      lead: `Escribe el código de 6 números que te enviamos a ${email}, o presiona el botón del correo.`,
    },
    nueva: {
      kicker: "Contraseña nueva",
      titulo: nombre ? `Hola, ${nombre}: crea tu contraseña` : "Crea tu contraseña nueva",
      lead: "Usa al menos 8 caracteres. Anótala en un lugar seguro.",
    },
    lista: {
      kicker: "Contraseña actualizada",
      titulo: "Listo, tu contraseña se cambió",
      lead: "Ya iniciaste sesión. Cerramos tu sesión en otros teléfonos o computadoras por seguridad.",
    },
    invalido: {
      kicker: "Enlace vencido",
      titulo: "Este enlace ya no funciona",
      lead: "Ya se usó, venció (dura 30 minutos) o está incompleto. Pide uno nuevo: es rápido.",
    },
  };
  const t = titulos[paso];

  return (
    <main className="login-page">
      <div className="login-shell login-shell-single anim-in">
        <section className="login-access">
          <div className="login-top">
            <Link href="/" className="login-brand">
              <span className="login-brand-mark">
                <LogoCM />
              </span>
              <Marca />
            </Link>
            <Link href="/login" className="login-back">
              <ArrowLeft className="inline h-4 w-4" aria-hidden /> Volver a iniciar sesión
            </Link>
          </div>

          <header>
            <p className="login-kicker" style={{ color: "var(--gold)" }}>
              {t.kicker}
            </p>
            <h1 ref={tituloRef} tabIndex={-1} className="login-title-lg">
              {t.titulo}
            </h1>
            {t.lead && <p className="login-lead-lg">{t.lead}</p>}
          </header>

          {paso === "revisando" && (
            <p className="login-alert is-ok" role="status">
              <Loader2 className="animate-spin" aria-hidden /> Revisando el enlace…
            </p>
          )}

          {error && (
            <p className="login-alert is-error" role="alert">
              <AlertCircle aria-hidden /> {error}
            </p>
          )}

          {paso === "codigo" && (
            <form onSubmit={validarCodigo} noValidate>
              <Campo id="codigo" label="Código de 6 números" ayuda="¿No te llegó? Busca en la carpeta de spam." error={errores.codigo}>
                {(aria) => (
                  <input
                    {...aria}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
                    className="login-code-input"
                  />
                )}
              </Campo>
              <button type="submit" className="btn-gold login-submit" disabled={cargando}>
                {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" aria-hidden />}
                Continuar
              </button>
            </form>
          )}

          {paso === "nueva" && (
            <form onSubmit={guardar} noValidate>
              <Campo id="clave" label="Nueva contraseña" ayuda="Mínimo 8 caracteres." error={errores.clave}>
                {(aria) => (
                  <>
                    <input
                      {...aria}
                      type={verClave ? "text" : "password"}
                      value={clave}
                      onChange={(e) => setClave(e.target.value)}
                      autoComplete="new-password"
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
              <Campo id="clave2" label="Repite la contraseña" error={errores.clave2}>
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
              <button type="submit" className="btn-gold login-submit" disabled={cargando}>
                {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" aria-hidden />}
                Guardar contraseña
              </button>
            </form>
          )}

          {paso === "lista" && (
            <div className="recuperar-acciones">
              <p className="login-alert is-ok" role="status">
                <CheckCircle2 aria-hidden /> Contraseña guardada.
              </p>
              <Link href="/cuenta" className="btn-gold login-submit">
                <CalendarCheck className="h-4 w-4" aria-hidden /> Mis citas
              </Link>
            </div>
          )}

          {paso === "invalido" && (
            <div className="recuperar-acciones">
              <Link href="/recuperar" className="btn-gold login-submit">
                <KeyRound className="h-4 w-4" aria-hidden /> Pedir uno nuevo
              </Link>
            </div>
          )}

          <p className="login-footnote">¿Necesitas ayuda? En la barbería con gusto te damos un enlace nuevo.</p>
        </section>
      </div>
    </main>
  );
}
