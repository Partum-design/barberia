import type { Metadata, Viewport } from "next";
import { Anton, Bebas_Neue, IBM_Plex_Mono, Outfit, Playfair_Display, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import "./tema-cortmart.css";
import "./correcciones-qa.css";
import "./experiencia-movil.css";
import { Marca } from "@/components/shell/Marca";
import { Accesibilidad, SCRIPT_ACCESIBILIDAD } from "@/components/a11y/Accesibilidad";
import { RegistrarApp } from "@/components/app/RegistrarApp";
import { InvitacionApp } from "@/components/app/InvitacionApp";

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

// Rotulación de letrero de CortMart: titulares de portada y panel
const anton = Anton({ subsets: ["latin"], weight: "400", variable: "--font-cm" });

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-plex-mono",
});

const NOMBRE = process.env.NEXT_PUBLIC_NOMBRE_NEGOCIO || "Barbería CortMart";

export const metadata: Metadata = {
  title: NOMBRE,
  description:
    process.env.NEXT_PUBLIC_DESCRIPCION_NEGOCIO ||
    `${NOMBRE}: servicios, equipo, horario y reservas en línea. Suma sellos en tu tarjeta de lealtad con cada visita.`,
  applicationName: NOMBRE,
  appleWebApp: { capable: true, title: "CortMart", statusBarStyle: "black" },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/iconos/icono-32.png", type: "image/png", sizes: "32x32" },
      { url: "/iconos/icono-192.png", type: "image/png", sizes: "192x192" },
    ],
    apple: "/iconos/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0c0806",
  colorScheme: "dark",
  // Para respetar la barra del iPhone (zona segura) en la app instalada.
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`dark ${outfit.variable} ${jakarta.variable} ${playfair.variable} ${bebas.variable} ${plexMono.variable} ${anton.variable}`}
    >
      <head>
        {/* Aplica las opciones de accesibilidad guardadas antes de pintar */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_ACCESIBILIDAD }} />
      </head>
      <body className="antialiased">
        <a href="#contenido" className="skip-link">
          Saltar al contenido
        </a>
        {/* Grano de película: rompe el banding de los degradados oscuros */}
        <div className="grain-layer" aria-hidden />
        <div id="contenido" tabIndex={-1} className="outline-none">
          {children}
        </div>
        <Accesibilidad />
        <RegistrarApp />
        <InvitacionApp />
        <footer className="site-footer">
          <Marca />
          <span>
            Desarrollado por{" "}
            <a href="https://partumdesign.com.mx" target="_blank" rel="noopener noreferrer">
              Partum Design
            </a>
          </span>
        </footer>
      </body>
    </html>
  );
}
