import { after, NextResponse, type NextRequest } from "next/server";
import { ErrorOperacion, vistaPara, type Estado, type Operacion } from "@/lib/datos/modelo";
import { ejecutarYComparar, leerEstado, sesionDePeticion } from "@/lib/datos/servidor";
import { avisosDeOperacion } from "@/lib/notificaciones/servidor";
import { sincronizarCitas } from "@/lib/integrations/google-calendar";

export const dynamic = "force-dynamic";

/** GET /api/datos — el estado de la barbería, recortado a lo que puede ver quien pregunta. */
export async function GET() {
  try {
    const [sesion, { estado }] = await Promise.all([sesionDePeticion(), leerEstado()]);
    return NextResponse.json(
      { estado: vistaPara(estado, sesion) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "No se pudieron cargar los datos." }, { status: 500 });
  }
}

/** Citas que cambiaron entre dos estados (creadas, editadas o borradas). */
function citasCambiadas(antes: Estado, despues: Estado) {
  const previas = new Map(antes.citas.map((c) => [c.id, c]));
  const cambios = [];
  for (const c of despues.citas) {
    const a = previas.get(c.id) ?? null;
    if (!a || JSON.stringify(a) !== JSON.stringify(c)) cambios.push({ antes: a, despues: c });
    previas.delete(c.id);
  }
  for (const a of previas.values()) cambios.push({ antes: a, despues: null });
  // Un borrado masivo no se replica uno por uno en los calendarios.
  return cambios.length > 60 ? [] : cambios;
}

/** POST /api/datos — aplica una operación con los permisos de la sesión. */
export async function POST(req: NextRequest) {
  const sesion = await sesionDePeticion();
  if (!sesion) return NextResponse.json({ error: "Inicia sesión para continuar." }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { op?: Operacion } | null;
  if (!body?.op || typeof body.op.tipo !== "string") {
    return NextResponse.json({ error: "Petición inválida." }, { status: 400 });
  }

  try {
    const op = body.op;
    const { antes, despues } = await ejecutarYComparar(op, sesion);
    const origen = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;
    // Avisos y calendario después de responder: la pantalla no los espera.
    after(async () => {
      await Promise.allSettled([
        avisosDeOperacion(op, antes, despues, sesion),
        sincronizarCitas(citasCambiadas(antes, despues), despues, origen),
      ]);
    });
    return NextResponse.json({ estado: vistaPara(despues, sesion) });
  } catch (err) {
    if (err instanceof ErrorOperacion) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error(err);
    return NextResponse.json({ error: "No se pudo guardar el cambio." }, { status: 500 });
  }
}
