import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Fotos de la portada en AVIF/WebP según lo que acepte el navegador.
  images: { formats: ["image/avif", "image/webp"] },
};

export default nextConfig;
