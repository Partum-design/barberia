"use client";

import { useEffect, useState } from "react";
import {
  BARBERIA_VACIA,
  leerDatosNegocio,
  nombreDelNegocio,
  type BarberiaConfig,
} from "@/lib/store";

/** Datos del negocio con suscripción a cambios hechos en Configuración. */
export function useDatosNegocio() {
  const [datos, setDatos] = useState<BarberiaConfig>(BARBERIA_VACIA);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    const leer = () => setDatos(leerDatosNegocio());
    leer();
    setListo(true);
    window.addEventListener("barberia:datos", leer);
    window.addEventListener("storage", leer);
    return () => {
      window.removeEventListener("barberia:datos", leer);
      window.removeEventListener("storage", leer);
    };
  }, []);

  return { datos, listo, nombre: nombreDelNegocio(datos) };
}

/** Nombre comercial tal y como lo escribió el administrador. */
export function Marca({ className, style }: { className?: string; style?: React.CSSProperties }) {
  const { nombre } = useDatosNegocio();
  return (
    <span className={className} style={{ fontFamily: "var(--font-serif)", ...style }}>
      {nombre}
    </span>
  );
}
