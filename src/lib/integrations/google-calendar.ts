import { createAdminClient } from "@/lib/supabase/admin";
import { citaActiva, nombreDelNegocio, type Cita, type Estado } from "@/lib/datos/modelo";

// ---------------------------------------------------------------------------
// Citas → Google Calendar de quien vinculó su cuenta.
//
// Al vincular Google (con el permiso de calendario) Supabase entrega un
// refresh token que se guarda en `google_calendario`. Con él y las
// credenciales del cliente OAuth (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET, las
// mismas que usa el proveedor Google de Supabase) se escribe cada cita en el
// calendario principal del cliente y del barbero.
//
// El id del evento se deriva del id de la cita, así que crear, mover o
// cancelar es siempre la misma llamada idempotente: no hay que guardar ids.
// ---------------------------------------------------------------------------

export const ALCANCE_CALENDARIO = "https://www.googleapis.com/auth/calendar.events";
const API = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const ZONA = "America/Mexico_City";

export const calendarioDisponible = () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

/** Ids de evento: sólo admiten base32hex (0-9, a-v). El hex de la cita cabe. */
const idDeEvento = (citaId: string) => `cm${Buffer.from(citaId).toString("hex")}`;

const tokens = new Map<string, { token: string; vence: number }>();

async function tokenDeAcceso(usuarioId: string, refresh: string): Promise<string | null> {
  const cache = tokens.get(usuarioId);
  if (cache && cache.vence > Date.now() + 60_000) return cache.token;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refresh,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    // Revocado desde la cuenta de Google: se olvida el vínculo.
    if (res.status === 400 || res.status === 401) {
      await createAdminClient().from("google_calendario").delete().eq("usuario_id", usuarioId);
    }
    return null;
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  tokens.set(usuarioId, { token: data.access_token, vence: Date.now() + data.expires_in * 1000 });
  return data.access_token;
}

export async function guardarVinculo(usuarioId: string, refreshToken: string, email: string | null) {
  await createAdminClient()
    .from("google_calendario")
    .upsert({ usuario_id: usuarioId, refresh_token: refreshToken, email, actualizado_en: new Date().toISOString() });
}

export async function quitarVinculo(usuarioId: string) {
  await createAdminClient().from("google_calendario").delete().eq("usuario_id", usuarioId);
}

export async function tieneVinculo(usuarioId: string) {
  const { data } = await createAdminClient().from("google_calendario").select("email").eq("usuario_id", usuarioId).maybeSingle();
  return data ? { email: (data.email as string | null) ?? null } : null;
}

function evento(cita: Cita, estado: Estado, para: "cliente" | "barbero", origen: string) {
  const negocio = nombreDelNegocio(estado.barberia);
  const servicio = cita.servicio_nombre || "Cita";
  const lugar =
    cita.modalidad === "domicilio" && cita.direccion_domicilio ? cita.direccion_domicilio : estado.barberia.direccion || negocio;
  return {
    id: idDeEvento(cita.id),
    summary: para === "cliente" ? `${servicio} · ${negocio}` : `${servicio} · ${cita.cliente_nombre || "Cliente"}`,
    location: lugar,
    description:
      para === "cliente"
        ? `Con ${cita.barbero_nombre}. Muestra tu QR al llegar: ${origen}/cuenta`
        : `Cliente: ${cita.cliente_nombre}. ${cita.notas ?? ""}`.trim(),
    start: { dateTime: cita.inicio, timeZone: ZONA },
    end: { dateTime: cita.fin, timeZone: ZONA },
    status: citaActiva(cita) ? "confirmed" : "cancelled",
    reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 60 }] },
  };
}

async function escribir(token: string, cuerpo: ReturnType<typeof evento>) {
  const cabeceras = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const put = await fetch(`${API}/${cuerpo.id}`, { method: "PUT", headers: cabeceras, body: JSON.stringify(cuerpo) });
  if (put.status !== 404) return;
  if (cuerpo.status === "cancelled") return; // nunca existió: nada que cancelar
  await fetch(API, { method: "POST", headers: cabeceras, body: JSON.stringify(cuerpo) });
}

/**
 * Lleva una o varias citas al calendario de su cliente y su barbero (si
 * vincularon Google). `null` en `despues` significa que la cita se borró.
 */
export async function sincronizarCitas(
  cambios: { antes: Cita | null; despues: Cita | null }[],
  estado: Estado,
  origen: string
) {
  if (!calendarioDisponible() || cambios.length === 0) return;
  const ids = new Set<string>();
  for (const { antes, despues } of cambios) {
    for (const c of [antes, despues]) if (c) [c.cliente_id, c.barbero_id].filter(Boolean).forEach((x) => ids.add(x));
  }
  if (ids.size === 0) return;
  const { data } = await createAdminClient()
    .from("google_calendario")
    .select("usuario_id, refresh_token")
    .in("usuario_id", [...ids]);
  if (!data?.length) return;

  for (const fila of data as { usuario_id: string; refresh_token: string }[]) {
    const token = await tokenDeAcceso(fila.usuario_id, fila.refresh_token);
    if (!token) continue;
    for (const { antes, despues } of cambios) {
      try {
        const cita = despues ?? antes;
        if (!cita) continue;
        const para = cita.cliente_id === fila.usuario_id ? "cliente" : cita.barbero_id === fila.usuario_id ? "barbero" : null;
        // Si le quitaron la cita (otro barbero), se cancela en su calendario.
        const eraSuya = antes && (antes.cliente_id === fila.usuario_id || antes.barbero_id === fila.usuario_id);
        if (!para) {
          if (eraSuya && antes) await escribir(token, { ...evento(antes, estado, "barbero", origen), status: "cancelled" });
          continue;
        }
        if (!despues) {
          await fetch(`${API}/${idDeEvento(cita.id)}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
          continue;
        }
        await escribir(token, evento(despues, estado, para, origen));
      } catch (err) {
        console.error("Google Calendar:", err);
      }
    }
  }
}

/** Al vincular: sube de una vez sus próximas citas. */
export async function sincronizarProximas(usuarioId: string, estado: Estado, origen: string) {
  const ahora = Date.now();
  const proximas = estado.citas
    .filter(
      (c) =>
        (c.cliente_id === usuarioId || c.barbero_id === usuarioId) &&
        c.estado === "confirmada" &&
        new Date(c.fin).getTime() > ahora
    )
    .slice(0, 50);
  await sincronizarCitas(
    proximas.map((c) => ({ antes: c, despues: c })),
    estado,
    origen
  );
}
