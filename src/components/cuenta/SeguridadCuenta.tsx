"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { AlertCircle, CheckCircle2, KeyRound, Loader2, Mail } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { Campo } from "@/components/formularios/Campo";

type Acceso = { correo: string; correo_pendiente: string; con_clave: boolean; clave_cambiada_en: string | null };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * "Tu acceso" en Mi cuenta: fecha del último cambio de contraseña (para notar
 * si alguien más la cambió) y la invitación a agregar un correo, con el que
 * el cliente recupera su contraseña sin depender de la barbería.
 */
export function SeguridadCuenta() {
  const params = useSearchParams();
  const [acceso, setAcceso] = useState<Acceso | null>(null);
  const [correo, setCorreo] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [aviso, setAviso] = useState<string | null>(
    params.get("correo") === "ok" ? "Listo: tu correo quedó confirmado." : null
  );
  const [fallo, setFallo] = useState<string | null>(
    params.get("correo") === "error" ? "El enlace para confirmar tu correo ya no funciona. Pide uno nuevo." : null
  );
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    fetch("/api/cuenta/acceso", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Acceso | null) => setAcceso(d))
      .catch(() => setAcceso(null));
  }, [aviso]);

  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    setFallo(null);
    const v = correo.trim().toLowerCase();
    const err = !v ? "Escribe tu correo." : EMAIL.test(v) ? undefined : "Escribe un correo válido.";
    setError(err);
    if (err) {
      document.getElementById("correo-cuenta")?.focus();
      return;
    }
    const supabase = getSupabaseBrowser();
    if (!supabase) return;
    setEnviando(true);
    const { error: e2 } = await supabase.auth.updateUser(
      { email: v },
      { emailRedirectTo: `${window.location.origin}/cuenta?correo=ok` }
    );
    setEnviando(false);
    if (e2) {
      setFallo(
        /already|registered|exists/i.test(e2.message)
          ? "Ese correo ya está en otra cuenta."
          : /rate limit|seconds/i.test(e2.message)
            ? "Espera unos minutos e inténtalo de nuevo."
            : "No pudimos enviar el correo. Inténtalo más tarde."
      );
      return;
    }
    setAviso(`Te enviamos un correo a ${v}. Ábrelo y presiona «Confirmar mi correo».`);
    setCorreo("");
  }

  if (!acceso) return null;

  return (
    <section className="seguridad-cuenta anim-in" aria-labelledby="titulo-acceso">
      <h2 id="titulo-acceso">
        <KeyRound aria-hidden /> Tu acceso
      </h2>
      {acceso.con_clave && (
        <p>
          Último cambio de contraseña:{" "}
          <b>
            {acceso.clave_cambiada_en
              ? format(new Date(acceso.clave_cambiada_en), "d 'de' MMMM yyyy, HH:mm 'h'", { locale: es })
              : "sin registro"}
          </b>
          . Si no fuiste tú, avisa a la barbería.
        </p>
      )}
      {acceso.correo ? (
        <p>
          <Mail aria-hidden className="inline h-4 w-4" /> Correo para recuperar tu contraseña: <b>{acceso.correo}</b>
        </p>
      ) : (
        <form onSubmit={agregar} noValidate className="seguridad-correo">
          <p className="seguridad-invita">
            <Mail aria-hidden /> Agrega tu correo para recuperar tu contraseña tú solo.
          </p>
          {acceso.correo_pendiente && (
            <p className="campo-ayuda">
              Falta confirmar <b>{acceso.correo_pendiente}</b>: revisa tu correo (y la carpeta de spam).
            </p>
          )}
          <Campo id="correo-cuenta" label="Tu correo" error={error}>
            {(aria) => (
              <input
                {...aria}
                type="email"
                inputMode="email"
                autoComplete="email"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                placeholder="tu@correo.com"
              />
            )}
          </Campo>
          <button type="submit" className="btn-gold login-submit" disabled={enviando}>
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" aria-hidden />}
            Enviarme el correo de confirmación
          </button>
        </form>
      )}
      {aviso && (
        <p className="login-alert is-ok" role="status">
          <CheckCircle2 aria-hidden /> {aviso}
        </p>
      )}
      {fallo && (
        <p className="login-alert is-error" role="alert">
          <AlertCircle aria-hidden /> {fallo}
        </p>
      )}
    </section>
  );
}
