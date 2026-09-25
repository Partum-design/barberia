// Modo demo: activo cuando no hay proyecto Supabase configurado.
// Permite navegar la plataforma desplegada sin credenciales reales.
export const DEMO_MODE = !process.env.NEXT_PUBLIC_SUPABASE_URL;

const hoy = new Date();
const enHoras = (h: number, m = 0) => {
  const d = new Date(hoy);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};
const enDias = (dias: number, h: number) => {
  const d = new Date(hoy.getTime() + dias * 86_400_000);
  d.setHours(h, 0, 0, 0);
  return d.toISOString();
};

export const DEMO_CITAS = [
  {
    id: "demo-1",
    inicio: enHoras(9, 0),
    fin: enHoras(9, 30),
    modalidad: "presencial" as const,
    estado: "confirmada" as const,
    precio: 250,
    direccion_domicilio: null,
    cliente: { nombre: "Mariana", apellidos: "Gutiérrez", avatar_url: null },
  },
  {
    id: "demo-2",
    inicio: enHoras(10, 30),
    fin: enHoras(11, 0),
    modalidad: "domicilio" as const,
    estado: "confirmada" as const,
    precio: 400,
    direccion_domicilio: "Av. Insurgentes Sur 1421, CDMX",
    cliente: { nombre: "Carlos", apellidos: "Reyna", avatar_url: null },
  },
  {
    id: "demo-3",
    inicio: enHoras(12, 0),
    fin: enHoras(12, 30),
    modalidad: "presencial" as const,
    estado: "confirmada" as const,
    precio: 250,
    direccion_domicilio: null,
    cliente: { nombre: "Lucía", apellidos: "Mendoza", avatar_url: null },
  },
  {
    id: "demo-4",
    inicio: enDias(1, 9),
    fin: enDias(1, 10),
    modalidad: "domicilio" as const,
    estado: "confirmada" as const,
    precio: 400,
    direccion_domicilio: "Calle Amsterdam 88, CDMX",
    cliente: { nombre: "Jorge", apellidos: "Palacios", avatar_url: null },
  },
  {
    id: "demo-5",
    inicio: enDias(2, 11),
    fin: enDias(2, 12),
    modalidad: "presencial" as const,
    estado: "confirmada" as const,
    precio: 250,
    direccion_domicilio: null,
    cliente: { nombre: "Ana", apellidos: "Sosa", avatar_url: null },
  },
];

export const DEMO_BARBEROS = [
  {
    id: "bar-1",
    nombre: "Iván Rosales",
    especialidad: "Fades y diseño de barba",
    precio_servicio: 250,
    duracion_cita_min: 30,
    acepta_domicilio: true,
    biografia: "12 años de experiencia. Especialista en fades y degradados de precisión.",
  },
  {
    id: "bar-2",
    nombre: "Andrés Lira",
    especialidad: "Cortes infantiles",
    precio_servicio: 200,
    duracion_cita_min: 30,
    acepta_domicilio: true,
    biografia: "Especialista en cortes para niños y primeras visitas.",
  },
  {
    id: "bar-3",
    nombre: "Sofía Cantú",
    especialidad: "Afeitado clásico y barbería tradicional",
    precio_servicio: 300,
    duracion_cita_min: 45,
    acepta_domicilio: false,
    biografia: "Enfoque en rituales de afeitado con navaja y toalla caliente.",
  },
];

export const DEMO_ADMIN_STATS = {
  ingresosMes: 148_650,
  citasMes: 212,
  tasaAsistencia: 0.91,
  clientesActivos: 486,
  recompensasCanjeadas: 34,
  barberos: [
    { nombre: "Iván Rosales", especialidad: "Fades y diseño de barba", citas: 74, ingresos: 62_900, activo: true },
    { nombre: "Andrés Lira", especialidad: "Cortes infantiles", citas: 68, ingresos: 47_600, activo: true },
    { nombre: "Sofía Cantú", especialidad: "Afeitado clásico", citas: 43, ingresos: 38_150, activo: true },
    { nombre: "Raúl Peña", especialidad: "Color y textura", citas: 0, ingresos: 0, activo: false },
  ],
};
