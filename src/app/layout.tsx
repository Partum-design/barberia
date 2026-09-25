import type { Metadata, Viewport } from "next";
import { Bebas_Neue, IBM_Plex_Mono, Outfit, Playfair_Display, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Marca } from "@/components/shell/Marca";

// Display grotesk para titulares de producto
const outfit = Outfit({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-outfit",
});

// Cuerpo — sans humanista, legible sobre superficies oscuras
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex",
});

// Serif editorial de alto contraste: logotipo y titulares de la portada.
// Sustituye a Cormorant — más peso en el trazo, mejor a tamaños de letrero.
const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-serif",
});

// Rotulación condensada de letrero de barbería: eyebrows, etiquetas y versalitas
const bebas = Bebas_Neue({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-bebas",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-plex-mono",
});

const NOMBRE = process.env.NEXT_PUBLIC_NOMBRE_NEGOCIO || "Barbería";

export const metadata: Metadata = {
  title: NOMBRE,
  description:
    process.env.NEXT_PUBLIC_DESCRIPCION_NEGOCIO ||
    `${NOMBRE}: servicios, equipo, horario y reservas en línea. Suma sellos en tu tarjeta de lealtad con cada visita.`,
};

export const viewport: Viewport = {
  themeColor: "#0a0806",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`dark ${outfit.variable} ${jakarta.variable} ${playfair.variable} ${bebas.variable} ${plexMono.variable}`}
    >
      <body className="antialiased">
        {/* Grano de película: rompe el banding de los degradados oscuros */}
        <div className="grain-layer" aria-hidden />
        {children}
        <footer className="site-footer">
          <Marca />
          <span>Sitio y sistema por Partum Design</span>
        </footer>
      </body>
    </html>
  );
}
