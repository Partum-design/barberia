"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertCircle, ArrowLeft, CalendarCheck, CheckCircle2, KeyRound, Loader2, Mail, UserPlus } from "lucide-react";
import { Marca } from "@/components/shell/Marca";
import { LogoCM } from "@/components/shell/LogoCM";
import { BotonesContacto } from "@/components/contacto/BotonesContacto";
import { Campo, errorDeIdentificador } from "@/components/formularios/Campo";
import { normalizarTelefono } from "@/lib/datos/modelo";
import "@/components/app/app.css";

type Resultado =
  | { estado: "correo"; pista: string }
  | { estado: "solicitud"; telefono: string }
  | { estado: "no_existe" }
  | { estado: "sin_clave" }
  | { estado: "google"; pista: string };

const bonito = (t: string) => {
  const d = normalizarTelefono(t);
  return d.length === 10 ? `${d.slice(0, 2)} ${d.slice(2, 6)} ${d.slice(6)}` : t;
};

export default function RecuperarPage() {
  return (
    <Suspense fallback={<main className="login-page" />}>
      <Recuperar />
    </Suspense>
  );
}

/**
 * "¿Olvidaste tu contraseña?" — un solo campo. Con correo llega un enlace;
 * con sólo celular se avisa a la barbería, que manda el enlace por WhatsApp
 * o lo da en persona (Panel → Restablecer contraseñas).
 */
function Recuperar() {
  const params = useSearchParams();
  const [valor, setValor] = useState(params.get("u") ?? "");
  const [error, setError] = useState<string | undefined>();
  const [fallo, setFallo] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const tituloRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (resultado) tituloRef.current?.focus();
  }, [resultado]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setFallo(null);
    const err = errorDeIdentificador(valor);
    setError(err);
    if (err) {
      document.getElementById("u")?.focus();
      return;
    }
    setCargando(true);
    try {
      const res = await fetch("/api/auth/recuperar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identificador: valor.trim() }),
      });
      const cuerpo = (await res.json().catch(() => ({}))) as Resultado & { error?: string };
      if (!res.ok) throw new Error(cuerpo.error ?? "No pudimos completar la solicitud.");
      setResultado(cuerpo);
    } catch (e) {
      setFallo(e instanceof Error && !/fetch/i.test(e.message) ? e.message : "No hay conexión. Revisa tu internet e inténtalo de nuevo.");
    } finally {
      setCargando(false);
    }
  }

  const textoWhatsApp = `Hola, olvidé mi contraseña de la app de CortMart. Mi número es ${
    resultado?.estado === "solicitud" ? bonito(resultado.telefono) : bonito(valor)
  }.`;

  const pantalla = (() => {
    if (!resultado) return null;
    switch (resultado.estado) {
      case "correo":
        return {
          icono: <Mail aria-hidden />,
          titulo: "Revisa tu correo",
          texto: (
            <>
              Te enviamos un correo a <b>{resultado.pista}</b>. Revisa también la carpeta de spam. El enlace sirve 30 minutos y
              sólo una vez.
            </>
          ),
        };
      case "solicitud":
        return {
          icono: <CheckCircle2 aria-hidden />,
          titulo: "Avisamos a la barbería",
          texto: (
            <>
              Te contactaremos por WhatsApp al <b>{bonito(resultado.telefono)}</b>, o puedes pedir tu nueva contraseña en tu próxima
              visita. Si tienes prisa, llámanos o escríbenos:
            </>
          ),
        };
      case "sin_clave":
        return {
          icono: <KeyRound aria-hidden />,
          titulo: "Aún no tienes contraseña",
          texto: <>Ese número ya es cliente, pero todavía no crea su contraseña. Entra con tu número y te pediremos crearla.</>,
        };
      case "google":
        return {
          icono: <KeyRound aria-hidden />,
          titulo: "Entras con Google",
          texto: (
            <>
              Ese número está ligado a tu cuenta de Google (<b>{resultado.pista}</b>). No necesitas contraseña: inicia sesión con
              «Continuar con Google».
            </>
          ),
        };
      case "no_existe":
        return {
          icono: <AlertCircle aria-hidden />,
          titulo: "No encontramos una cuenta con ese dato",
          texto: <>Revisa que esté bien escrito, crea tu cuenta o reserva tu cita sólo con tu nombre y celular.</>,
        };
    }
  })();

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
            <Link href={`/login${valor.trim() ? `?u=${encodeURIComponent(valor.trim())}` : ""}`} className="login-back">
              <ArrowLeft className="inline h-4 w-4" aria-hidden /> Volver a iniciar sesión
            </Link>
          </div>

          {!pantalla ? (
            <>
              <header>
                <p className="login-kicker" style={{ color: "var(--gold)" }}>
                  Recuperar acceso
                </p>
                <h1 className="login-title-lg">¿Olvidaste tu contraseña?</h1>
                <p className="login-lead-lg">Escribe tu celular o tu correo. Te ayudamos a crear una contraseña nueva.</p>
              </header>
              <form onSubmit={enviar} noValidate>
                <Campo id="u" label="Celular o correo" ayuda="Tu celular a 10 dígitos o tu correo electrónico." error={error}>
                  {(aria) => (
                    <input
                      {...aria}
                      type="text"
                      value={valor}
                      onChange={(e) => setValor(e.target.value)}
                      placeholder="55 1234 5678 o tu@correo.com"
                      autoComplete="username"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                  )}
                </Campo>
                {fallo && (
                  <p className="login-alert is-error" role="alert">
                    <AlertCircle aria-hidden /> {fallo}
                  </p>
                )}
                <button type="submit" className="btn-gold login-submit" disabled={cargando}>
                  {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" aria-hidden />}
                  Recuperar mi contraseña
                </button>
              </form>
              <p className="login-footnote">¿Prefieres hablar con alguien? Llámanos o escríbenos y te ayudamos.</p>
              <BotonesContacto textoWhatsApp={textoWhatsApp} />
            </>
          ) : (
            <>
              <header className="recuperar-resultado" role="status">
                <span className="recuperar-icono">{pantalla.icono}</span>
                <h1 ref={tituloRef} tabIndex={-1} className="login-title-lg">
                  {pantalla.titulo}
                </h1>
                <p className="login-lead-lg">{pantalla.texto}</p>
              </header>

              {resultado?.estado === "solicitud" && <BotonesContacto textoWhatsApp={textoWhatsApp} />}

              {resultado?.estado === "correo" && (
                <p className="login-help">
                  ¿Te llegó un código de 6 números?{" "}
                  <Link href={`/restablecer?email=${encodeURIComponent(valor.trim().includes("@") ? valor.trim() : "")}`}>
                    Escríbelo aquí
                  </Link>
                  .
                </p>
              )}

              <div className="recuperar-acciones">
                {(resultado?.estado === "sin_clave" || resultado?.estado === "google") && (
                  <Link href={`/login?u=${encodeURIComponent(valor.trim())}`} className="btn-gold login-submit">
                    Ir a iniciar sesión
                  </Link>
                )}
                {resultado?.estado === "no_existe" && (
                  <>
                    <Link href="/login?modo=crear" className="btn-gold login-submit">
                      <UserPlus className="h-4 w-4" aria-hidden /> Crear cuenta
                    </Link>
                    <Link href="/reservar" className="contacto-boton">
                      <CalendarCheck aria-hidden /> Reservar una cita
                    </Link>
                  </>
                )}
                <button
                  type="button"
                  className="login-back"
                  onClick={() => {
                    setResultado(null);
                    setFallo(null);
                  }}
                >
                  Usar otro celular o correo
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
