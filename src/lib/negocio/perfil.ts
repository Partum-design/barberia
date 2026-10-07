import type { HorarioSemanal } from "@/lib/datos/modelo";

// ============================================================================
// Ficha pública de Barbería CortMart, tomada de su perfil de Google Maps
// (octubre 2026). La portada la usa como respaldo: lo que el administrador
// capture en el panel siempre tiene prioridad sobre estos datos.
// ============================================================================

export const PERFIL = {
  nombre: "Barbería CortMart",
  marca: "CortMart",
  eslogan: "Cortes con detalle, atención de lujo",
  descripcion:
    "Somos la barbería de la colonia Industrial, en Gustavo A. Madero. Ladrillo, luz cálida y sillas listas para que salgas con el corte justo como lo quieres: con tiempo, con detalle y sin prisas.",
  direccion: "Av. Euzkaro 152, Industrial, Gustavo A. Madero, 07800 Ciudad de México, CDMX",
  zona: "Industrial · GAM · CDMX",
  referencia: "A pasos del Metrobús L7 Avenida Talismán",
  telefono: "56 4338 8834",
  mapa_url: "https://maps.app.goo.gl/kxM54X3zWtwRYZC89",
  mapa_embed: "https://www.google.com/maps?q=19.4801165,-99.125262&z=17&hl=es&output=embed",
  calificacion: 5.0,
  total_resenas: 13,
  horario: {
    lun: { activo: true, inicio: "12:00", fin: "20:00" },
    mar: { activo: true, inicio: "12:00", fin: "20:00" },
    mie: { activo: true, inicio: "12:00", fin: "20:00" },
    jue: { activo: true, inicio: "12:00", fin: "20:00" },
    vie: { activo: true, inicio: "12:00", fin: "20:00" },
    sab: { activo: true, inicio: "10:00", fin: "18:00" },
    dom: { activo: true, inicio: "10:00", fin: "18:00" },
  } satisfies HorarioSemanal,
  fotos: {
    interior: "/negocio/cortmart-interior.jpg",
    letrero: "/negocio/cortmart-letrero.jpg",
    sillas: "/negocio/cortmart-sillas.jpg",
    sala: "/negocio/cortmart-sala.jpg",
  },
  /** Barberos que los clientes mencionan en sus reseñas */
  equipo: [
    { nombre: "Christian", rol: "Barbero", nota: "“El mejor de la zona”, según sus clientes." },
    { nombre: "Lupita", rol: "Barbera", nota: "Te deja el corte justo como lo quieres." },
  ],
  /** Reseñas públicas de Google Maps, tal como las escribieron */
  resenas: [
    {
      autor: "Guillermo Pizzarro",
      texto:
        "Excelente servicio y atención en la barbería, siempre quedo más que satisfecho. Gracias a mi barber Christian por su profesionalismo y el detalle que pone en cada corte. Sin duda, el mejor de la zona 👌",
    },
    {
      autor: "Omar Castellanos",
      texto:
        "Excelente servicio, Lupita es muy profesional y siempre te deja con el corte justo como lo quieres 💈✂️. ¡Súper recomendable 💯",
    },
    {
      autor: "Christian",
      texto:
        "De lujo la atención y el servicio! Todas las veces que he ido termino satisfecho con el corte de cabello ✋🏻",
    },
    { autor: "Donovan González", texto: "Excelente servicio. Con Chris muy buen corte y buena atención ⭐⭐⭐⭐⭐" },
    { autor: "Eduardo López López", texto: "Está muy bien. Se toma el tiempo para cortarlo." },
  ],
} as const;
