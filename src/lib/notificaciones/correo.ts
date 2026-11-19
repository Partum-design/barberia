import { createAdminClient } from "@/lib/supabase/admin";
import { nombreDelNegocio, type Cita, type Estado } from "@/lib/datos/modelo";

// ---------------------------------------------------------------------------
// Correo de las citas por Gmail API.
//
// Una sola cuenta remitente (GMAIL_SENDER) autorizada una vez con el alcance
// gmail.send; su refresh token vive en GMAIL_REFRESH_TOKEN (Vercel, nunca en
// el repo). Reutiliza el cliente OAuth de Google Calendar (GOOGLE_CLIENT_ID /
// GOOGLE_CLIENT_SECRET). El nombre visible es siempre CortMart.
//
// Ningún fallo de correo sube: se registra en el servidor y la cita sigue.
// ---------------------------------------------------------------------------

const ZONA = "America/Mexico_City";
const NOMBRE_REMITENTE = "CortMart";

export const correoDisponible = () =>
  Boolean(
    process.env.GMAIL_SENDER &&
      process.env.GMAIL_REFRESH_TOKEN &&
      process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET
  );

const origenApp = () => (process.env.NEXT_PUBLIC_APP_URL || "https://barberia-partum.vercel.app").replace(/\/$/, "");

let acceso: { token: string; vence: number } | null = null;

async function tokenDeAcceso(): Promise<string | null> {
  if (acceso && acceso.vence > Date.now() + 60_000) return acceso.token;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: process.env.GMAIL_REFRESH_TOKEN!,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    console.error("Gmail: no se pudo renovar el token", res.status, await res.text().catch(() => ""));
    return null;
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  acceso = { token: data.access_token, vence: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

/** Encabezado con acentos (RFC 2047). */
const encabezado = (texto: string) => `=?UTF-8?B?${Buffer.from(texto, "utf8").toString("base64")}?=`;

const limpiarCabecera = (v: string) => v.replace(/[\r\n]+/g, " ").trim();

/** Manda un correo HTML. Devuelve false si no se pudo (sin lanzar). */
export async function enviarCorreo(para: string, asunto: string, html: string, texto: string): Promise<boolean> {
  if (!correoDisponible()) return false;
  const destino = limpiarCabecera(para);
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(destino)) return false;
  try {
    const token = await tokenDeAcceso();
    if (!token) return false;
    const limite = `cm_${Math.random().toString(36).slice(2)}`;
    const mensaje = [
      `From: ${encabezado(NOMBRE_REMITENTE)} <${limpiarCabecera(process.env.GMAIL_SENDER!)}>`,
      `To: ${destino}`,
      `Subject: ${encabezado(limpiarCabecera(asunto))}`,
      "MIME-Version: 1.0",
      `Content-Type: multipart/alternative; boundary="${limite}"`,
      "",
      `--${limite}`,
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      Buffer.from(texto, "utf8").toString("base64"),
      `--${limite}`,
      "Content-Type: text/html; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      Buffer.from(html, "utf8").toString("base64"),
      `--${limite}--`,
    ].join("\r\n");
    const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ raw: Buffer.from(mensaje, "utf8").toString("base64url") }),
    });
    if (!res.ok) {
      console.error("Gmail: envío rechazado", res.status, await res.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (err) {
    console.error("Gmail:", err);
    return false;
  }
}

// --- Destinatarios ----------------------------------------------------------

const correosAuth = new Map<string, { email: string | null; vence: number }>();

async function correoDeUsuarioAuth(id: string): Promise<string | null> {
  const cache = correosAuth.get(id);
  if (cache && cache.vence > Date.now()) return cache.email;
  try {
    const { data } = await createAdminClient().auth.admin.getUserById(id);
    const email = data?.user?.email ?? null;
    correosAuth.set(id, { email, vence: Date.now() + 10 * 60_000 });
    return email;
  } catch {
    return null;
  }
}

/** Correo del cliente: el de su ficha; si no tiene, el de su cuenta de acceso. */
export async function correoDelCliente(estado: Estado, clienteId: string): Promise<string | null> {
  const ficha = estado.clientes.find((c) => c.id === clienteId);
  if (ficha?.email?.trim()) return ficha.email.trim();
  if (ficha?.cuenta_id) return correoDeUsuarioAuth(ficha.cuenta_id);
  return null;
}

/** El barbero es usuario de Auth (mismo id). */
export const correoDelBarbero = (barberoId: string) => correoDeUsuarioAuth(barberoId);

async function vinculoCalendario(usuarioId: string) {
  try {
    const { data } = await createAdminClient().from("google_calendario").select("usuario_id").eq("usuario_id", usuarioId).maybeSingle();
    return Boolean(data);
  } catch {
    return false;
  }
}

// --- Contenido ----------------------------------------------------------------

export type TipoCorreo = "nueva" | "agendada" | "cambio" | "cancelada" | "recordatorio";

const FECHA = new Intl.DateTimeFormat("es-MX", { timeZone: ZONA, weekday: "long", day: "numeric", month: "long", year: "numeric" });
const HORA = new Intl.DateTimeFormat("es-MX", { timeZone: ZONA, hour: "2-digit", minute: "2-digit", hour12: false });

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

/** "Agregar a Google Calendar" (mismo formato que enlaceGoogleCalendar del navegador). */
function enlaceCalendario(cita: { inicio: string; fin: string; titulo: string; lugar?: string; detalle?: string }) {
  const f = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: cita.titulo,
    dates: `${f(cita.inicio)}/${f(cita.fin)}`,
    details: cita.detalle ?? "",
    location: cita.lugar ?? "",
    ctz: ZONA,
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

const ENCABEZADOS: Record<TipoCorreo, { cliente: string; barbero: string }> = {
  nueva: { cliente: "Tu cita está confirmada", barbero: "Tienes una reserva nueva" },
  agendada: { cliente: "Te agendamos una cita", barbero: "Te agendaron una cita" },
  cambio: { cliente: "Tu cita cambió", barbero: "Una cita se reprogramó" },
  cancelada: { cliente: "Tu cita se canceló", barbero: "Se canceló una cita" },
  recordatorio: { cliente: "Hoy tienes cita", barbero: "Tu agenda de hoy" },
};

function plantilla(opts: {
  titulo: string;
  intro: string;
  filas: [string, string][];
  boton: { texto: string; url: string };
  notas: string[];
  extra?: { texto: string; url: string } | null;
  negocio: string;
}) {
  const origen = origenApp();
  const filas = opts.filas
    .map(
      ([k, v]) =>
        `<tr><td style="padding:10px 0;border-bottom:1px solid #e5e5e5;color:#555;font-size:13px;text-transform:uppercase;letter-spacing:.08em;width:38%">${esc(k)}</td><td style="padding:10px 0;border-bottom:1px solid #e5e5e5;color:#000;font-size:15px;font-weight:700">${esc(v)}</td></tr>`
    )
    .join("");
  const notas = opts.notas.map((n) => `<p style="margin:0 0 10px;color:#222;font-size:14px;line-height:1.5">${esc(n)}</p>`).join("");
  const extra = opts.extra
    ? `<p style="margin:16px 0 0"><a href="${esc(opts.extra.url)}" style="color:#000;font-weight:700;text-decoration:underline">${esc(opts.extra.texto)}</a></p>`
    : "";
  return `<!doctype html><html lang="es"><body style="margin:0;padding:0;background:#ffffff">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;border:2px solid #000;font-family:Arial,Helvetica,sans-serif">
<tr><td align="center" style="padding:28px 24px 16px;border-bottom:2px solid #000;background:#ffffff">
<img src="${origen}/marca/logo-cm-negro.png" width="96" height="96" alt="CortMart" style="display:block;border:0">
<p style="margin:10px 0 0;font-size:12px;letter-spacing:.3em;text-transform:uppercase;color:#000;font-weight:700">${esc(opts.negocio)}</p>
</td></tr>
<tr><td style="padding:28px 24px">
<h1 style="margin:0 0 12px;font-size:26px;line-height:1.1;text-transform:uppercase;letter-spacing:-.01em;color:#000">${esc(opts.titulo)}</h1>
<p style="margin:0 0 18px;color:#222;font-size:15px;line-height:1.5">${esc(opts.intro)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${filas}</table>
<div style="margin:22px 0 18px">${notas}</div>
<a href="${esc(opts.boton.url)}" style="display:inline-block;background:#000;color:#fff;text-decoration:none;font-weight:700;text-transform:uppercase;letter-spacing:.08em;font-size:14px;padding:14px 22px">${esc(opts.boton.texto)}</a>
${extra}
</td></tr>
<tr><td style="padding:14px 24px;border-top:2px solid #000;color:#555;font-size:12px">Mensaje automático de ${esc(opts.negocio)}. No respondas a este correo.</td></tr>
</table></td></tr></table></body></html>`;
}

/** Arma y manda el correo de una cita a su cliente o a su barbero. */
async function correoDeCita(tipo: TipoCorreo, cita: Cita, estado: Estado, para: "cliente" | "barbero") {
  const email = para === "cliente" ? await correoDelCliente(estado, cita.cliente_id) : await correoDelBarbero(cita.barbero_id);
  if (!email) return; // sin correo: sólo push y campana
  const origen = origenApp();
  const negocio = nombreDelNegocio(estado.barberia);
  const servicio = cita.servicio_nombre || "Cita";
  const fecha = FECHA.format(new Date(cita.inicio));
  const hora = HORA.format(new Date(cita.inicio));
  const domicilio = cita.modalidad === "domicilio";
  const lugar = domicilio && cita.direccion_domicilio ? cita.direccion_domicilio : estado.barberia.direccion || negocio;
  const url = para === "cliente" ? `${origen}/cuenta` : `${origen}/dashboard/barbero`;
  const titulo = ENCABEZADOS[tipo][para];
  const usuarioCalendario = para === "cliente" ? cita.cliente_id : cita.barbero_id;
  const vinculado = await vinculoCalendario(usuarioCalendario);

  const intro =
    para === "cliente"
      ? tipo === "cancelada"
        ? `Cancelamos tu cita de ${servicio} con ${cita.barbero_nombre}. Si quieres otra fecha, agenda cuando gustes.`
        : `${servicio} con ${cita.barbero_nombre}, el ${fecha} a las ${hora}.`
      : `${cita.cliente_nombre || "Cliente"} · ${servicio}, el ${fecha} a las ${hora}.`;

  const filas: [string, string][] = [
    ["Servicio", servicio],
    [para === "cliente" ? "Barbero" : "Cliente", para === "cliente" ? cita.barbero_nombre : cita.cliente_nombre || "Cliente"],
    ["Fecha", fecha],
    ["Hora", `${hora} (hora del centro de México)`],
    ["Modalidad", domicilio ? "A domicilio" : "En la barbería"],
    ["Dirección", lugar],
  ];

  const notas: string[] = [];
  let extra: { texto: string; url: string } | null = null;
  if (tipo !== "cancelada") {
    if (para === "cliente") notas.push("Muestra tu código QR al llegar: lo encuentras en tu cuenta.");
    if (vinculado) {
      notas.push("El evento ya está en tu Google Calendar.");
    } else {
      extra = {
        texto: "Agregar a Google Calendar",
        url: enlaceCalendario({
          inicio: cita.inicio,
          fin: cita.fin,
          titulo: para === "cliente" ? `${servicio} · ${negocio}` : `${servicio} · ${cita.cliente_nombre || "Cliente"}`,
          lugar,
          detalle: para === "cliente" ? `Con ${cita.barbero_nombre}. Muestra tu QR al llegar: ${origen}/cuenta` : `Cliente: ${cita.cliente_nombre}`,
        }),
      };
    }
  } else if (vinculado) {
    notas.push("También la quitamos de tu Google Calendar.");
  }

  const boton = { texto: para === "cliente" ? "Ver mi cuenta" : "Abrir mi agenda", url };
  const html = plantilla({ titulo, intro, filas, boton, notas, extra, negocio });
  const texto = [
    titulo,
    "",
    intro,
    "",
    ...filas.map(([k, v]) => `${k}: ${v}`),
    "",
    ...notas,
    extra ? `${extra.texto}: ${extra.url}` : "",
    `${boton.texto}: ${url}`,
  ]
    .filter((l, i, a) => l !== "" || a[i - 1] !== "")
    .join("\n");
  await enviarCorreo(email, `${titulo} · ${negocio}`, html, texto);
}

/**
 * Manda el correo de la cita a cada destinatario en paralelo. Nunca lanza: un
 * fallo de Gmail no debe tocar la cita ni el push.
 */
export async function correosDeCita(tipo: TipoCorreo, cita: Cita, estado: Estado, para: ("cliente" | "barbero")[]) {
  if (!correoDisponible() || para.length === 0) return;
  const res = await Promise.allSettled([...new Set(para)].map((p) => correoDeCita(tipo, cita, estado, p)));
  for (const r of res) if (r.status === "rejected") console.error("Correo de cita:", r.reason);
}

/** Resumen del día para el barbero (recordatorio de la mañana). */
export async function correoAgendaDelDia(barberoId: string, citas: Cita[], estado: Estado) {
  if (!correoDisponible() || citas.length === 0) return;
  try {
    const email = await correoDelBarbero(barberoId);
    if (!email) return;
    const negocio = nombreDelNegocio(estado.barberia);
    const origen = origenApp();
    const titulo = `Hoy tienes ${citas.length} cita${citas.length === 1 ? "" : "s"}`;
    const filas: [string, string][] = citas.map((c) => [
      HORA.format(new Date(c.inicio)),
      `${c.cliente_nombre || "Cliente"} · ${c.servicio_nombre || "Cita"}${c.modalidad === "domicilio" ? " (a domicilio)" : ""}`,
    ]);
    const boton = { texto: "Abrir mi agenda", url: `${origen}/dashboard/barbero` };
    const intro = `Tu agenda del ${FECHA.format(new Date(citas[0].inicio))}.`;
    const html = plantilla({ titulo, intro, filas, boton, notas: [], negocio });
    const texto = [titulo, "", intro, "", ...filas.map(([k, v]) => `${k}  ${v}`), "", `${boton.texto}: ${boton.url}`].join("\n");
    await enviarCorreo(email, `${titulo} · ${negocio}`, html, texto);
  } catch (err) {
    console.error("Correo de agenda:", err);
  }
}
