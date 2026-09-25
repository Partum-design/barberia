import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Cliente service_role: bypass de RLS. SOLO para Route Handlers de servidor
// (webhooks de Stripe, sincronización de calendarios). Nunca importar desde
// componentes de cliente.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase service_role no configurado");
  }
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
