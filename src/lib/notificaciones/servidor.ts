import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolverRol } from "@/lib/auth/roles";
import type { Cita, Estado, Operacion, Sesion } from "@/lib/datos/modelo";

// ---------------------------------------------------------------------------
// Avisos: se guardan en la bandeja de cada persona (campana del panel) y, si
// activó las notificaciones en su teléfono o computadora, le llegan como push.
// ---------------------------------------------------------------------------

export type Aviso = { titulo: string; cuerpo: string; url: string };

export const pushDisponible = () =>
  Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

let vapidListo = false;
function prepararVapid() {
  if (vapidListo || !pushDisponible()) return pushDisponible();
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_CONTACTO || "avisos@cortmart.mx"}`,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
  vapidListo = true;
  return true;
}

let adminsCache: { ids: string[]; vence: number } | null = null;

/** Ids de todos los administradores (se refresca cada 5 minutos). */
export async function idsDeAdmins(): Promise<string[]> {
  if (adminsCache && adminsCache.vence > Date.now()) return adminsCache.ids;
  const { data } = await createAdminClient().auth.admin.listUsers({ perPage: 1000 });
  const ids = (data?.users ?? []).filter((u) => resolverRol(u) === "admin").map((u) => u.id);
  adminsCache = { ids, vence: Date.now() + 5 * 60_000 };
  return ids;
}

/** Guarda el aviso en la bandeja de cada destinatario y lo manda por push. */
export async function notificar(destinatarios: string[], aviso: Aviso) {
  const ids = [...new Set(destinatarios.filter(Boolean))];
  if (ids.length === 0) return;
  const admin = createAdminClient();
  await admin.from("notificaciones").insert(ids.map((usuario_id) => ({ usuario_id, ...aviso })));

  if (!prepararVapid()) return;
  const { data } = await admin.from("push_suscripciones").select("endpoint, p256dh, auth").in("usuario_id", ids);
  const carga = JSON.stringify(aviso);
  await Promise.all(
    (data ?? []).map(async (s: { endpoint: string; p256dh: string; auth: string }) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, carga, { TTL: 60 * 60 * 12 });
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        // La suscripción ya no existe (permiso retirado o app desinstalada).
        if (status === 404 || status === 410) await admin.from("push_suscripciones").delete().eq("endpoint", s.endpoint);
      }
    })
  );
}

const FECHA = new Intl.DateTimeFormat("es-MX", {
  timeZone: "America/Mexico_City",
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
/** El servidor corre en UTC: la hora se escribe siempre en la de la barbería. */
export const cuando = (iso: string) => FECHA.format(new Date(iso));

/**
 * Decide a quién avisar después de una operación: el barbero se entera de
 * sus citas nuevas o canceladas, el cliente de lo que el personal hace con la
 * suya y los administradores de las reservas en línea.
 */
export async function avisosDeOperacion(op: Operacion, antes: Estado, despues: Estado, s: Sesion) {
  const citaDe = (e: Estado, id: string) => e.citas.find((c) => c.id === id) ?? null;
  const envios: Promise<void>[] = [];
  const avisar = (ids: (string | null | undefined)[], aviso: Aviso) =>
    envios.push(notificar(ids.filter((x): x is string => Boolean(x) && x !== s.id), aviso));
  const servicio = (c: Cita) => c.servicio_nombre || "Cita";

  switch (op.tipo) {
    case "crearCita":
    case "reservarInvitado": {
      const c = citaDe(despues, op.id);
      if (!c) break;
      const admins = await idsDeAdmins();
      const aviso = {
        titulo: "Nueva reserva en línea",
        cuerpo: `${c.cliente_nombre} · ${servicio(c)} con ${c.barbero_nombre}, ${cuando(c.inicio)}`,
      };
      avisar([c.barbero_id], { ...aviso, url: "/dashboard/barbero" });
      avisar(admins, { ...aviso, url: "/dashboard/admin/citas" });
      envios.push(notificar([c.cliente_id], { titulo: "¡Cita confirmada!", cuerpo: `${servicio(c)} con ${c.barbero_nombre}, ${cuando(c.inicio)}. Muestra tu QR al llegar.`, url: "/cuenta" }));
      break;
    }
    case "crearCitaPersonal": {
      const c = citaDe(despues, op.id);
      if (!c) break;
      avisar([c.cliente_id], {
        titulo: "Tienes una cita agendada",
        cuerpo: `${servicio(c)} con ${c.barbero_nombre}, ${cuando(c.inicio)}`,
        url: "/cuenta",
      });
      avisar([c.barbero_id], {
        titulo: "Te agendaron una cita",
        cuerpo: `${c.cliente_nombre} · ${servicio(c)}, ${cuando(c.inicio)}`,
        url: "/dashboard/barbero",
      });
      break;
    }
    case "cancelarCita":
    case "actualizarCita": {
      const a = citaDe(antes, op.id);
      const c = citaDe(despues, op.id);
      if (!a || !c) break;
      if (c.estado === "cancelada" && a.estado !== "cancelada") {
        const aviso = { titulo: "Cita cancelada", cuerpo: `${servicio(c)} de ${c.cliente_nombre} con ${c.barbero_nombre}, ${cuando(c.inicio)}` };
        avisar([c.cliente_id], { ...aviso, url: "/cuenta" });
        avisar([c.barbero_id], { ...aviso, url: "/dashboard/barbero" });
        if (s.rol === "cliente") avisar(await idsDeAdmins(), { ...aviso, url: "/dashboard/admin/citas" });
      } else if (c.estado === "confirmada" && (a.inicio !== c.inicio || a.barbero_id !== c.barbero_id)) {
        avisar([c.cliente_id], {
          titulo: "Tu cita cambió",
          cuerpo: `Ahora es ${cuando(c.inicio)} con ${c.barbero_nombre}.`,
          url: "/cuenta",
        });
        avisar([c.barbero_id, a.barbero_id], {
          titulo: "Cita reprogramada",
          cuerpo: `${c.cliente_nombre} · ${cuando(c.inicio)} con ${c.barbero_nombre}`,
          url: "/dashboard/barbero",
        });
      } else if (c.estado === "asistida" && a.estado !== "asistida") {
        avisar([c.cliente_id], { titulo: "¡Gracias por tu visita!", cuerpo: "Sumamos un sello a tu tarjeta de lealtad.", url: "/cuenta/tarjeta" });
      }
      break;
    }
    case "marcarAsistida": {
      const a = citaDe(antes, op.id);
      const c = citaDe(despues, op.id);
      if (c && a?.estado !== "asistida") {
        avisar([c.cliente_id], { titulo: "¡Gracias por tu visita!", cuerpo: "Sumamos un sello a tu tarjeta de lealtad.", url: "/cuenta/tarjeta" });
      }
      break;
    }
    default:
      break;
  }
  await Promise.all(envios);
}
