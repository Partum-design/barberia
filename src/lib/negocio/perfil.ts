import type { HorarioSemanal, Servicio } from "@/lib/datos/modelo";

// ============================================================================
// Ficha pública de Barbería CortMart, tomada de su perfil de Google Maps
// (octubre 2026). La portada la usa como respaldo: lo que el administrador
// capture en el panel siempre tiene prioridad sobre estos datos.
// ============================================================================

type ServicioMenu = Pick<Servicio, "nombre" | "categoria" | "precio" | "duracion_min"> &
  Pick<Servicio, "descripcion" | "desde">;

// Las duraciones no vienen en el menú: son un punto de partida para la agenda
// y se ajustan en Panel → Servicios.
const MENU: readonly ServicioMenu[] = [
  { categoria: "Corte", nombre: "Corte de adulto", precio: 200, duracion_min: 40 },
  { categoria: "Corte", nombre: "Corte Junior", precio: 180, duracion_min: 30 },
  { categoria: "Corte", nombre: "Diseño de grecas", precio: 60, duracion_min: 15 },
  { categoria: "Afeitado", nombre: "Afeitado Clásico", precio: 200, duracion_min: 30 },
  { categoria: "Afeitado", nombre: "Afeitado CortMart", precio: 300, duracion_min: 45 },
  { categoria: "Afeitado", nombre: "Bigote", precio: 60, duracion_min: 15 },
  { categoria: "Rostro", nombre: "Facial", precio: 200, duracion_min: 30 },
  { categoria: "Rostro", nombre: "Ceja (Delineado)", precio: 50, duracion_min: 10 },
  { categoria: "Rostro", nombre: "Ceja (Planchado)", precio: 150, duracion_min: 30 },
  { categoria: "Rostro", nombre: "Mascarilla Negra", precio: 100, duracion_min: 20 },
  { categoria: "Paquete", nombre: "Paquete Facial", descripcion: "Corte y facial", precio: 300, duracion_min: 70 },
  { categoria: "Paquete", nombre: "Paquete Clásico", descripcion: "Corte y afeitado clásico", precio: 300, duracion_min: 70 },
  { categoria: "Paquete", nombre: "Paquete CortMart", descripcion: "Corte y afeitado CortMart", precio: 400, duracion_min: 85 },
  { categoria: "Paquete", nombre: "Paquete Premium", descripcion: "Corte, afeitado CortMart y facial", precio: 500, duracion_min: 115 },
  { categoria: "Especial", nombre: "Crioterapia", precio: 250, desde: true, duracion_min: 40 },
  { categoria: "Especial", nombre: "Box Braids", precio: 200, desde: true, duracion_min: 90 },
];

export const PERFIL = {
  nombre: "Barbería CortMart",
  marca: "CortMart",
  eslogan: "Estilo que habla por ti",
  anio_fundacion: "2001",
  descripcion:
    "Somos la barbería de la colonia Industrial, en Gustavo A. Madero. Ladrillo, luz cálida y sillas listas para que salgas con el corte justo como lo quieres: con tiempo, con detalle y sin prisas.",
  direccion: "Av. Euzkaro 152, Industrial, Gustavo A. Madero, 07800 Ciudad de México, CDMX",
  zona: "Industrial · GAM · CDMX",
  referencia: "A pasos del Metrobús L7 Avenida Talismán",
  telefono: "56 4338 8834",
  /** El mismo número atiende WhatsApp */
  whatsapp: "56 4338 8834",
  instagram: "barberiacortmart",
  tiktok: "barberiacortmart",
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
  /** Menú impreso de la barbería (octubre 2026) */
  menu: MENU,
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
