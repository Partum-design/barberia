"use client";

import {
  calcularLealtad,
  nombreDelNegocio,
  type BarberiaConfig,
  type Cita,
  type RecompensasConfig,
  type TarjetaLealtad,
} from "@/lib/store";
import type { DatosPase } from "@/lib/integrations/google-wallet";

/** Estado completo de una tarjeta: sellos, recompensas y datos del pase. */
export function estadoTarjeta({
  tarjeta,
  titular,
  citas,
  config,
  canjes,
  negocio,
}: {
  tarjeta: TarjetaLealtad;
  titular: string;
  citas: Cita[];
  config: RecompensasConfig;
  canjes: Record<string, number>;
  negocio: BarberiaConfig;
}) {
  const lealtad = calcularLealtad(citas, tarjeta.cliente_id, config.citas_requeridas, tarjeta.sellos_extra);
  const canjeadas = canjes[tarjeta.cliente_id] ?? 0;
  const disponibles = Math.max(0, lealtad.recompensasGanadas - canjeadas);

  const pase: DatosPase = {
    numero: tarjeta.numero,
    titular,
    sellos: lealtad.puntos,
    progreso: lealtad.progreso,
    requerido: lealtad.requerido,
    recompensasDisponibles: disponibles,
    descuento: config.valor_descuento,
    estado: tarjeta.estado,
    negocio: {
      nombre: nombreDelNegocio(negocio),
      direccion: negocio.direccion || undefined,
      telefono: negocio.telefono || undefined,
    },
  };

  return { lealtad, canjeadas, disponibles, pase };
}

export type RespuestaWallet = {
  configurado: boolean;
  url?: string;
  actualizado?: boolean;
  faltan?: string[];
  error?: string;
  aviso?: string;
};

/** Pide al servidor el enlace de Google Wallet (y refresca el pase guardado). */
export async function solicitarPase(pase: DatosPase, soloActualizar = false): Promise<RespuestaWallet> {
  try {
    const res = await fetch("/api/wallet/lealtad", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...pase, soloActualizar }),
    });
    return (await res.json()) as RespuestaWallet;
  } catch {
    return { configurado: true, error: "No hay conexión con el servidor." };
  }
}
