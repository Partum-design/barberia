"use client";

import { useEffect } from "react";
import { prepararAppNativa } from "@/lib/app-nativa";

/** Registra el service worker y escucha el aviso de instalación desde la primera carga. */
export function RegistrarApp() {
  useEffect(() => prepararAppNativa(), []);
  return null;
}
