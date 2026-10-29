import type { Metadata } from "next";
import { TiendaPagina } from "@/components/landing/TiendaPagina";
import { PERFIL } from "@/lib/negocio/perfil";

export const metadata: Metadata = {
  title: `Tienda · ${PERFIL.nombre}`,
  description: `Ceras, aceites, pomadas y productos de afeitado que usamos en ${PERFIL.nombre}. Apártalos por WhatsApp y recógelos en la barbería.`,
  openGraph: { title: `Tienda · ${PERFIL.nombre}`, images: [PERFIL.fotos.interior] },
};

export default function PaginaProductos() {
  return <TiendaPagina />;
}
