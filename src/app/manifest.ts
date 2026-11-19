import type { MetadataRoute } from "next";

const NOMBRE = process.env.NEXT_PUBLIC_NOMBRE_NEGOCIO || "Barbería CortMart";

/** Manifiesto de la app instalable (Android, iPhone, Windows y Mac). */
// Los iconos llevan «-v2» en el nombre: al cambiar la URL, Android y
// Chrome detectan el icono nuevo (monograma CM) en las apps ya instaladas.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/?app=1",
    name: NOMBRE,
    short_name: "CortMart",
    description: "Reserva tu corte, muestra tu QR al llegar y junta sellos en tu tarjeta de lealtad.",
    start_url: "/?app=1",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#000000",
    theme_color: "#000000",
    lang: "es-MX",
    categories: ["lifestyle", "business"],
    icons: [
      { src: "/iconos/icono-192-v2.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/iconos/icono-512-v2.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/iconos/icono-maskable-512-v2.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Agendar cita", url: "/reservar", icons: [{ src: "/iconos/icono-192-v2.png", sizes: "192x192" }] },
      { name: "Mi cuenta", url: "/cuenta", icons: [{ src: "/iconos/icono-192-v2.png", sizes: "192x192" }] },
    ],
  };
}
