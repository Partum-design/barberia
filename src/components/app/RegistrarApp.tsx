"use client";

import { useEffect } from "react";
import { prepararAppNativa } from "@/lib/app-nativa";
import { vigilarVersionVieja } from "@/lib/reparar-app";

/**
 * Registra el service worker, escucha el aviso de instalación desde la primera
 * carga y, si la pestaña quedó con una versión vieja tras una actualización,
 * recarga sola con los archivos nuevos.
 */
export function RegistrarApp() {
  useEffect(() => {
    prepararAppNativa();
    return vigilarVersionVieja();
  }, []);
  return null;
}
