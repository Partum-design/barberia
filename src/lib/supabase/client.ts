"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente de Supabase para el navegador.
 *
 * Se crea una sola vez por pestaña (memoizado en módulo): cada instancia abre
 * su propio canal de `onAuthStateChange` y su propio temporizador de refresco,
 * así que crear uno por componente multiplicaría el trabajo en segundo plano
 * sin ganar nada.
 *
 * Devuelve `null` cuando el proyecto no tiene credenciales configuradas, que es
 * la señal que usa el resto de la app para trabajar en modo local en vez
 * de reventar con un error de configuración.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Indica si hay credenciales de Supabase disponibles en el cliente. */
export const authDisponible = Boolean(url && anonKey);

let instancia: SupabaseClient | null = null;

export function getSupabaseBrowser(): SupabaseClient | null {
  if (!authDisponible) return null;
  if (!instancia) {
    instancia = createBrowserClient(url!, anonKey!, {
      auth: {
        // PKCE: el intercambio del código ocurre en el servidor, en
        // /auth/callback, y la sesión vive en cookies HttpOnly.
        flowType: "pkce",
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }
  return instancia;
}
