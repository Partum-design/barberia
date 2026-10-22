import type { MetadataRoute } from "next";

const NOMBRE = process.env.NEXT_PUBLIC_NOMBRE_NEGOCIO || "Barbería CortMart";

/** Manifiesto de la app instalable (Android, iPhone, Windows y Mac). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: NOMBRE,
    short_name: "CortMart",
    description: "Reserva tu corte, muestra tu QR al llegar y junta sellos en tu tarjeta de lealtad.",
    start_url: "/?app=1",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0c0806",
    theme_color: "#0c0806",
    lang: "es-MX",
    categories: ["lifestyle", "business"],
    icons: [
      { src: "/pwa/icono?t=192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa/icono?t=512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa/icono?t=512&m=1", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Agendar cita", url: "/reservar", icons: [{ src: "/pwa/icono?t=192", sizes: "192x192" }] },
      { name: "Mi cuenta", url: "/cuenta", icons: [{ src: "/pwa/icono?t=192", sizes: "192x192" }] },
    ],
  };
}
