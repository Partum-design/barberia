import type { Metadata } from "next";
import { SitioNegocio } from "@/components/landing/SitioNegocio";
import { PERFIL } from "@/lib/negocio/perfil";

export const metadata: Metadata = {
  title: `${PERFIL.nombre} · ${PERFIL.zona}`,
  description: `${PERFIL.nombre} en ${PERFIL.direccion}. Cortes, degradados y barba. ${PERFIL.calificacion.toFixed(1)} estrellas en Google. Reserva en línea.`,
  openGraph: {
    title: PERFIL.nombre,
    description: PERFIL.eslogan,
    images: [PERFIL.fotos.interior],
  },
};

// Portada pública de Barbería CortMart. Lo que el administrador captura en
// el panel tiene prioridad; la ficha de Google Maps (PERFIL) rellena huecos.
export default function PaginaInicio() {
  return <SitioNegocio />;
}
