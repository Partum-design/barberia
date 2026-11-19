"use client";

import { useEffect, useSyncExternalStore } from "react";

// ---------------------------------------------------------------------------
// Bandeja de avisos compartida por la campana (hay dos en el panel: barra
// lateral y cabecera móvil) y el aviso en pantalla. Una sola fuente de verdad:
// GET /api/notificaciones.
//
// Cuándo se recarga:
//   · al montar, cada 30 s con la pestaña visible y al volver a ella;
//   · al instante cuando llega un push con la app abierta: el service worker
//     no muestra la notificación del sistema y le avisa a la página, que la
//     enseña como aviso en pantalla. Así se ve una sola vez.
//
// No se usa Supabase Realtime: la tabla `notificaciones` sólo la lee el
// servidor (RLS sin políticas) y el usuario_id de los clientes es el id de su
// ficha, no el de Auth, así que no hay una política segura que filtrar.
// ---------------------------------------------------------------------------

export type AvisoBandeja = { id: string; titulo: string; cuerpo: string; url: string; leida: boolean; creado_en: string };

type Estado = { avisos: AvisoBandeja[]; sinLeer: number; enPantalla: AvisoBandeja | null };

let estado: Estado = { avisos: [], sinLeer: 0, enPantalla: null };
const oyentes = new Set<() => void>();
const emitir = (cambio: Partial<Estado>) => {
  estado = { ...estado, ...cambio };
  oyentes.forEach((f) => f());
};

/** Ids ya conocidos: lo que estaba en la bandeja al abrir no sale como aviso nuevo. */
const vistos = new Set<string>();
let primeraCarga = true;
let cargando: Promise<void> | null = null;

async function cargar({ mostrar = true }: { mostrar?: boolean } = {}) {
  if (cargando) return cargando;
  cargando = (async () => {
    try {
      const res = await fetch("/api/notificaciones", { cache: "no-store", credentials: "same-origin" });
      if (!res.ok) return;
      const d = (await res.json()) as { avisos: AvisoBandeja[]; sinLeer: number };
      const nuevos = d.avisos.filter((a) => !a.leida && !vistos.has(a.id));
      d.avisos.forEach((a) => vistos.add(a.id));
      const enPantalla =
        !primeraCarga && mostrar && nuevos.length > 0 && document.visibilityState === "visible" ? nuevos[0] : estado.enPantalla;
      primeraCarga = false;
      emitir({ avisos: d.avisos, sinLeer: d.sinLeer, enPantalla });
    } catch {
      /* sin conexión: se intenta en la siguiente vuelta */
    } finally {
      cargando = null;
    }
  })();
  return cargando;
}

let usuarios = 0;
let detener: (() => void) | null = null;

function arrancar() {
  void cargar();
  const visible = () => document.visibilityState === "visible";
  const t = window.setInterval(() => visible() && void cargar(), 30_000);
  const alVolver = () => visible() && void cargar();
  document.addEventListener("visibilitychange", alVolver);
  // Push recibido con la app abierta (public/sw.js).
  const delServiceWorker = (e: MessageEvent) => {
    const m = e.data as { tipo?: string; mostrada?: boolean } | null;
    if (m?.tipo === "cortmart:aviso") void cargar({ mostrar: !m.mostrada });
  };
  navigator.serviceWorker?.addEventListener("message", delServiceWorker);
  return () => {
    window.clearInterval(t);
    document.removeEventListener("visibilitychange", alVolver);
    navigator.serviceWorker?.removeEventListener("message", delServiceWorker);
  };
}

const suscribir = (f: () => void) => {
  oyentes.add(f);
  return () => oyentes.delete(f);
};
const SERVIDOR: Estado = { avisos: [], sinLeer: 0, enPantalla: null };

/** Marca todo como leído (al abrir la campana o el aviso en pantalla). */
export async function marcarLeidos() {
  if (estado.sinLeer === 0 && !estado.enPantalla) return;
  emitir({ sinLeer: 0, enPantalla: null, avisos: estado.avisos.map((a) => ({ ...a, leida: true })) });
  await fetch("/api/notificaciones", { method: "POST", credentials: "same-origin" }).catch(() => {});
}

export const cerrarAvisoEnPantalla = () => emitir({ enPantalla: null });

export function useAvisos() {
  useEffect(() => {
    usuarios += 1;
    if (usuarios === 1) detener = arrancar();
    return () => {
      usuarios -= 1;
      if (usuarios === 0) {
        detener?.();
        detener = null;
      }
    };
  }, []);
  return useSyncExternalStore(suscribir, () => estado, () => SERVIDOR);
}
