import { NextResponse, type NextRequest } from "next/server";
import { leerEstado } from "@/lib/datos/servidor";
import { cuando, notificar } from "@/lib/notificaciones/servidor";

export const dynamic = "force-dynamic";

const DIA = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" });
const HORA = new Intl.DateTimeFormat("es-MX", { timeZone: "America/Mexico_City", hour: "2-digit", minute: "2-digit", hour12: false });

/**
 * GET /api/cron/recordatorios — lo llama Vercel Cron cada mañana (vercel.json).
 * A cada cliente le recuerda su cita del día y a cada barbero le resume su agenda.
 */
export async function GET(req: NextRequest) {
  const secreto = process.env.CRON_SECRET;
  if (secreto && req.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const { estado } = await leerEstado();
  const hoy = DIA.format(new Date());
  const deHoy = estado.citas
    .filter((c) => c.estado === "confirmada" && DIA.format(new Date(c.inicio)) === hoy)
    .sort((a, b) => a.inicio.localeCompare(b.inicio));

  const envios: Promise<void>[] = [];
  for (const c of deHoy) {
    if (!c.cliente_id) continue;
    envios.push(
      notificar([c.cliente_id], {
        titulo: "Hoy tienes cita ✂️",
        cuerpo: `${c.servicio_nombre || "Tu cita"} con ${c.barbero_nombre} a las ${HORA.format(new Date(c.inicio))}. Muestra tu QR al llegar.`,
        url: "/cuenta",
      })
    );
  }
  const porBarbero = new Map<string, typeof deHoy>();
  for (const c of deHoy) porBarbero.set(c.barbero_id, [...(porBarbero.get(c.barbero_id) ?? []), c]);
  for (const [barberoId, citas] of porBarbero) {
    envios.push(
      notificar([barberoId], {
        titulo: `Hoy tienes ${citas.length} cita${citas.length === 1 ? "" : "s"}`,
        cuerpo: `La primera: ${citas[0].cliente_nombre}, ${cuando(citas[0].inicio)}.`,
        url: "/dashboard/barbero",
      })
    );
  }
  await Promise.allSettled(envios);
  return NextResponse.json({ ok: true, citas: deHoy.length });
}
