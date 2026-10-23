"use client";

import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { normalizarTelefono } from "@/lib/datos/modelo";

// Campos de formulario con ayuda visible y errores en español debajo de cada
// uno. Los formularios usan `noValidate`: los mensajes del navegador salen en
// el idioma del sistema y desaparecen solos, así que validamos nosotros.

export type Errores = Record<string, string | undefined>;

export type AriaCampo = {
  id: string;
  name: string;
  "aria-invalid": true | undefined;
  "aria-describedby": string | undefined;
};

export function Campo({
  id,
  label,
  ayuda,
  error,
  children,
}: {
  id: string;
  label: ReactNode;
  ayuda?: ReactNode;
  error?: string;
  children: (aria: AriaCampo) => ReactNode;
}) {
  const ids = [ayuda ? `${id}-ayuda` : null, error ? `${id}-error` : null].filter(Boolean).join(" ");
  return (
    <div className={`login-field ${error ? "has-error" : ""}`}>
      <label htmlFor={id}>{label}</label>
      <div className="login-input-wrap">
        {children({ id, name: id, "aria-invalid": error ? true : undefined, "aria-describedby": ids || undefined })}
      </div>
      {ayuda && (
        <p id={`${id}-ayuda`} className="campo-ayuda">
          {ayuda}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="campo-error">
          <AlertCircle aria-hidden /> {error}
        </p>
      )}
    </div>
  );
}

/** Lleva el foco al primer campo con error, en el orden en que aparecen. */
export function enfocarPrimerError(errores: Errores, orden: string[]) {
  const primero = orden.find((id) => errores[id]);
  if (primero) document.getElementById(primero)?.focus();
  return Boolean(primero);
}

export const hayErrores = (errores: Errores) => Object.values(errores).some(Boolean);

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Celular a 10 dígitos o correo. Devuelve el mensaje de error o undefined. */
export function errorDeIdentificador(valor: string): string | undefined {
  const v = valor.trim();
  if (!v) return "Escribe tu celular o correo.";
  if (v.includes("@")) return EMAIL.test(v) ? undefined : "Escribe un celular de 10 dígitos o un correo válido.";
  return /^[\d\s+()-]+$/.test(v) && normalizarTelefono(v).length === 10
    ? undefined
    : "Escribe un celular de 10 dígitos o un correo válido.";
}

export function errorDeTelefono(valor: string): string | undefined {
  const v = valor.trim();
  if (!v) return "Escribe tu celular.";
  return normalizarTelefono(v).length === 10 && /^[\d\s+()-]+$/.test(v) ? undefined : "Escribe un celular de 10 dígitos.";
}

export const errorDeNombre = (valor: string) => (valor.trim().length < 2 ? "Escribe tu nombre." : undefined);

export const errorDeClaveNueva = (valor: string) =>
  !valor ? "Escribe tu contraseña." : valor.length < 8 ? "La contraseña debe tener al menos 8 caracteres." : undefined;

export const errorDeRepetir = (clave: string, repetida: string) =>
  !repetida ? "Repite tu contraseña." : clave !== repetida ? "Las contraseñas no coinciden." : undefined;
