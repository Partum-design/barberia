"use client";

import { getSupabaseBrowser } from "@/lib/supabase/client";

// Acceso y vínculo con Google desde el navegador. El regreso siempre pasa por
// /auth/callback, que canjea el código en el servidor (PKCE).

export const ALCANCE_CALENDARIO = "https://www.googleapis.com/auth/calendar.events";

/** Traduce los errores de Supabase al configurar Google. */
export function mensajeGoogle(mensaje: string) {
  if (/provider is not enabled|unsupported provider/i.test(mensaje)) {
    return "El acceso con Google aún no está activado en la barbería. Usa tu número o correo por ahora.";
  }
  if (/manual linking is disabled/i.test(mensaje)) {
    return "Vincular Google aún no está activado en la barbería. Avísale al administrador.";
  }
  if (/identity is already linked|already linked to another user/i.test(mensaje)) {
    return "Esa cuenta de Google ya está ligada a otro usuario.";
  }
  return mensaje;
}

const callback = (params: Record<string, string>) =>
  `${window.location.origin}/auth/callback?${new URLSearchParams(params).toString()}`;

/** Entrar o crear cuenta con Google. */
export async function entrarConGoogle(next?: string | null) {
  const supabase = getSupabaseBrowser();
  if (!supabase) throw new Error("El acceso no está configurado.");
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callback(next ? { next } : {}),
      queryParams: { prompt: "select_account" },
    },
  });
  if (error) throw new Error(mensajeGoogle(error.message));
}

/**
 * Vincula Google (si aún no lo tiene) y pide permiso para escribir sus citas
 * en Google Calendar. Quien ya entra con Google sólo concede el permiso.
 */
export async function vincularGoogleCalendar(volverA: string) {
  const supabase = getSupabaseBrowser();
  if (!supabase) throw new Error("El acceso no está configurado.");
  const { data } = await supabase.auth.getUser();
  const yaTieneGoogle = (data.user?.identities ?? []).some((i) => i.provider === "google");
  const options = {
    redirectTo: callback({ calendario: "1", next: volverA }),
    scopes: ALCANCE_CALENDARIO,
    queryParams: { access_type: "offline", prompt: "consent" },
  };
  const { error } = yaTieneGoogle
    ? await supabase.auth.signInWithOAuth({ provider: "google", options })
    : await supabase.auth.linkIdentity({ provider: "google", options });
  if (error) throw new Error(mensajeGoogle(error.message));
}

/** Enlace "Agregar a Google Calendar" para quien no vinculó su cuenta. */
export function enlaceGoogleCalendar(cita: { inicio: string; fin: string; titulo: string; lugar?: string; detalle?: string }) {
  const f = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: cita.titulo,
    dates: `${f(cita.inicio)}/${f(cita.fin)}`,
    details: cita.detalle ?? "",
    location: cita.lugar ?? "",
    ctz: "America/Mexico_City",
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}
