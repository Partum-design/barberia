import { NextResponse, type NextRequest } from "next/server";
import { ErrorOperacion, vistaPara, type Operacion } from "@/lib/datos/modelo";
import { ejecutarOperacion, leerEstado, sesionDePeticion } from "@/lib/datos/servidor";

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

/** POST /api/datos — aplica una operación con los permisos de la sesión. */
export async function POST(req: NextRequest) {
  const sesion = await sesionDePeticion();
  if (!sesion) return NextResponse.json({ error: "Inicia sesión para continuar." }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { op?: Operacion } | null;
  if (!body?.op || typeof body.op.tipo !== "string") {
    return NextResponse.json({ error: "Petición inválida." }, { status: 400 });
  }

  try {
    const estado = await ejecutarOperacion(body.op, sesion);
    return NextResponse.json({ estado: vistaPara(estado, sesion) });
  } catch (err) {
    if (err instanceof ErrorOperacion) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error(err);
    return NextResponse.json({ error: "No se pudo guardar el cambio." }, { status: 500 });
  }
}
