"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";

const MINIMO_MS = 700; // que el logotipo alcance a verse
const MAXIMO_MS = 3000; // nunca tapa la página más que esto

/**
 * Pantalla de carga con el monograma CM. Sale en el HTML del servidor (se ve
 * desde el primer cuadro) y se va al terminar de cargar la página. Si el
 * JavaScript fallara, la hoja de estilos la oculta sola a los 4 s.
 */
export function Precarga() {
  const [fase, setFase] = useState<"visible" | "saliendo" | "fuera">("visible");

  useEffect(() => {
    let hecho = false;
    const salir = () => {
      if (hecho) return;
      hecho = true;
      const espera = Math.max(0, MINIMO_MS - performance.now());
      window.setTimeout(() => setFase("saliendo"), espera);
    };
    if (document.readyState === "complete") salir();
    else window.addEventListener("load", salir, { once: true });
    const tope = window.setTimeout(salir, MAXIMO_MS);
    return () => {
      window.removeEventListener("load", salir);
      window.clearTimeout(tope);
    };
  }, []);

  useEffect(() => {
    if (fase !== "saliendo") return;
    const t = window.setTimeout(() => setFase("fuera"), 500);
    return () => window.clearTimeout(t);
  }, [fase]);

  if (fase === "fuera") return null;

  return (
    <div className={`precarga ${fase === "saliendo" ? "is-saliendo" : ""}`} aria-hidden>
      <div className="precarga-marca">
        <img src="/marca/logo-cm-blanco-recorte.png" alt="" width={162} height={200} />
        <span className="precarga-barra" />
      </div>
    </div>
  );
}
