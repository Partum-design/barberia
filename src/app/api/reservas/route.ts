import { after, NextResponse, type NextRequest } from "next/server";
import { SISTEMA } from "@/lib/auth/cuentas";
import { ejecutarYComparar, leerEstado, sesionDePeticion } from "@/lib/datos/servidor";
import { ErrorOperacion, normalizarTelefono, nuevoId, numeroDeTarjeta, type Operacion } from "@/lib/datos/modelo";
import { avisosDeOperacion } from "@/lib/notificaciones/servidor";
import { sincronizarCitas } from "@/lib/integrations/google-calendar";
import { dentroDelLimite, ESPERA, ipDe } from "@/lib/limites";

export const dynamic = "force-dynamic";

type Peticion = {
  nombre?: string;
  telefono?: string;
  barbero_id?: string;
  servicio_id?: string | null;
  inicio?: string;
  modalidad?: "presencial" | "domicilio";
  direccion_domicilio?: string;
};

const responder = (cuerpo: Record<string, unknown>, status = 200) => NextResponse.json(cuerpo, { status });

/**
 * POST /api/reservas — reservar sin cuenta, sólo con nombre y celular.
 *
 * Todo pasa en una sola escritura (operación `reservarInvitado`): si el número
 * es nuevo se crean su ficha (cuenta sin contraseña), su tarjeta de lealtad y
 * la cita; si algo falla no se guarda nada. La escritura es condicional a la
 * versión leída, así que dos reservas al mismo hueco no pueden entrar las dos.
 *
 * Si el número ya es cliente, la cita se agenda en su ficha pero la respuesta
 * no incluye nada privado (ni sus citas ni su tarjeta).
 *
 * Límites: 6 reservas por hora por IP, 4 por hora por número y máximo 2
 * citas por venir por cliente (ver MAX_CITAS_FUTURAS).
 */
export async function POST(req: NextRequest) {
  const sesion = await sesionDePeticion();
  if (sesion) return responder({ error: "Ya iniciaste sesión: confirma tu cita desde tu cuenta." }, 409);

  const body = ((await req.json().catch(() => null)) ?? {}) as Peticion;
  const nombre = String(body.nombre ?? "").trim().replace(/\s+/g, " ");
  const telefono = normalizarTelefono(String(body.telefono ?? ""));
  if (nombre.length < 2) return responder({ error: "Escribe tu nombre.", campo: "nombre" }, 400);
  if (telefono.length !== 10) return responder({ error: "Escribe un celular de 10 dígitos.", campo: "telefono" }, 400);
  if (!body.barbero_id || !body.inicio) return responder({ error: "Elige barbero y horario." }, 400);

  if (!(await dentroDelLimite(`reservar:ip:${ipDe(req)}`, 6, 3600))) {
    return responder({ error: `Hiciste muchas reservas seguidas. ${ESPERA}` }, 429);
  }
  if (!(await dentroDelLimite(`reservar:tel:${telefono}`, 4, 3600))) {
    return responder({ error: `Ese número hizo muchas reservas seguidas. ${ESPERA}` }, 429);
  }

  const { estado } = await leerEstado();
  const op: Operacion = {
    tipo: "reservarInvitado",
    id: nuevoId("c"),
    nombre,
    telefono,
    barbero_id: body.barbero_id,
    servicio_id: body.servicio_id ?? null,
    inicio: body.inicio,
    modalidad: body.modalidad === "domicilio" ? "domicilio" : "presencial",
    direccion_domicilio: String(body.direccion_domicilio ?? "").slice(0, 300),
    clienteId: nuevoId("cli"),
    tarjetaId: nuevoId("tlc"),
    numeroTarjeta: numeroDeTarjeta(new Set(estado.tarjetas.map((t) => t.numero))),
  };

  try {
    const { antes, despues } = await ejecutarYComparar(op, SISTEMA);
    const cita = despues.citas.find((c) => c.id === op.id);
    if (!cita) throw new Error("La cita no quedó guardada.");
    const yaEraCliente = antes.clientes.some((c) => normalizarTelefono(c.telefono) === telefono);
    const tarjeta = yaEraCliente ? null : despues.tarjetas.find((t) => t.cliente_id === cita.cliente_id);

    const origen = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;
    after(async () => {
      await Promise.allSettled([
        avisosDeOperacion(op, antes, despues, SISTEMA),
        sincronizarCitas([{ antes: null, despues: cita }], despues, origen),
      ]);
    });

    return responder(
      {
        cita: {
          id: cita.id,
          inicio: cita.inicio,
          fin: cita.fin,
          barbero: cita.barbero_nombre,
          servicio: cita.servicio_nombre ?? "",
          precio: cita.precio,
          modalidad: cita.modalidad,
        },
        yaEraCliente,
        // Para el ya registrado sólo su primer nombre, como saludo.
        nombre: (yaEraCliente ? cita.cliente_nombre : nombre).split(" ")[0],
        tarjeta: tarjeta?.numero ?? null,
        telefono,
      },
      201
    );
  } catch (err) {
    if (err instanceof ErrorOperacion) return responder({ error: err.message }, err.status);
    console.error("Reserva sin cuenta:", err);
    return responder({ error: "No pudimos guardar tu cita. Intenta de nuevo o llama a la barbería." }, 500);
  }
}
