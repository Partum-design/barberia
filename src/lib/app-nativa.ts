"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

// ---------------------------------------------------------------------------
// App instalable y notificaciones del navegador.
//
// El aviso de instalación (`beforeinstallprompt`) llega una sola vez y muy
// pronto, así que se captura en cuanto carga la página y se guarda aquí para
// que cualquier botón lo use después. iPhone no tiene ese aviso: allí se
// explica cómo agregarla desde «Compartir».
// ---------------------------------------------------------------------------

type AvisoInstalacion = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

let aviso: AvisoInstalacion | null = null;
let instalada = false;
const oyentes = new Set<() => void>();
const avisar = () => oyentes.forEach((f) => f());
let preparado = false;

export function prepararAppNativa() {
  if (preparado || typeof window === "undefined") return;
  preparado = true;
  instalada =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    aviso = e as AvisoInstalacion;
    avisar();
  });
  window.addEventListener("appinstalled", () => {
    aviso = null;
    instalada = true;
    avisar();
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch((err) => console.warn("Service worker:", err));
  }
}

const suscribir = (f: () => void) => {
  oyentes.add(f);
  return () => oyentes.delete(f);
};

export function esIOS() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/** Estado de instalación: si se puede instalar con un clic, si es iPhone o si ya está instalada. */
export function useInstalar() {
  const estado = useSyncExternalStore(
    suscribir,
    () => (instalada ? "instalada" : aviso ? "lista" : "no"),
    () => "no"
  );
  const [ios, setIos] = useState(false);
  useEffect(() => {
    prepararAppNativa();
    setIos(esIOS());
  }, []);

  const instalar = useCallback(async () => {
    if (!aviso) return false;
    await aviso.prompt();
    const { outcome } = await aviso.userChoice;
    aviso = null;
    avisar();
    return outcome === "accepted";
  }, []);

  return {
    instalada: estado === "instalada",
    /** El navegador ofrece instalar con un clic */
    lista: estado === "lista",
    /** iPhone/iPad sin instalar: hay que hacerlo desde «Compartir» */
    ios: ios && estado !== "instalada",
    instalar,
  };
}

// --- Cómo se instala en cada teléfono --------------------------------------

/**
 * Dónde está la persona y, por tanto, qué pasos ver:
 *   · directa   → el navegador ofrece instalar con un toque (Chrome/Edge)
 *   · ios-safari / ios-otro → iPhone o iPad: desde «Compartir»
 *   · android-samsung / android-firefox / android-chrome → menú del navegador
 *   · en-app    → navegador interno de Facebook, Instagram, etc.: ahí no se
 *                 puede instalar, hay que abrir la página en el navegador
 *   · escritorio → computadora sin instalación directa: QR para el teléfono
 */
export type Plataforma =
  | "directa"
  | "ios-safari"
  | "ios-otro"
  | "android-samsung"
  | "android-firefox"
  | "android-chrome"
  | "en-app"
  | "escritorio";

export function plataformaDe(ua: string, lista: boolean, ios: boolean): Plataforma {
  if (/FBAN|FBAV|FB_IAB|Instagram|Line\/|TikTok|musical_ly|WhatsApp|\bwv\b/i.test(ua)) return "en-app";
  if (lista) return "directa";
  if (ios) return /CriOS|FxiOS|EdgiOS|OPiOS|GSA\//i.test(ua) ? "ios-otro" : "ios-safari";
  if (/Android/i.test(ua)) {
    if (/SamsungBrowser/i.test(ua)) return "android-samsung";
    if (/Firefox/i.test(ua)) return "android-firefox";
    return "android-chrome";
  }
  return "escritorio";
}

const EVENTO_ABRIR = "cortmart:instalar-app";

/** Abre la ventana de "Instalar la app" desde cualquier botón. */
export function abrirInstalacion() {
  window.dispatchEvent(new Event(EVENTO_ABRIR));
}

export function alPedirInstalacion(f: () => void) {
  window.addEventListener(EVENTO_ABRIR, f);
  return () => window.removeEventListener(EVENTO_ABRIR, f);
}

// --- Notificaciones push ----------------------------------------------------

const CLAVE_PUBLICA = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function claveABytes(base64: string) {
  const relleno = "=".repeat((4 - (base64.length % 4)) % 4);
  const crudo = atob((base64 + relleno).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(crudo, (c) => c.charCodeAt(0));
}

export type EstadoAvisos = "cargando" | "no-soportado" | "bloqueado" | "apagado" | "activo";

export function useNotificaciones() {
  const [estado, setEstado] = useState<EstadoAvisos>("cargando");
  const [error, setError] = useState<string | null>(null);

  const revisar = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window) || !CLAVE_PUBLICA) {
      setEstado("no-soportado");
      return;
    }
    if (Notification.permission === "denied") {
      setEstado("bloqueado");
      return;
    }
    const registro = await navigator.serviceWorker.getRegistration();
    const sub = await registro?.pushManager.getSubscription();
    setEstado(sub && Notification.permission === "granted" ? "activo" : "apagado");
  }, []);

  useEffect(() => {
    prepararAppNativa();
    void revisar();
  }, [revisar]);

  const activar = useCallback(async () => {
    setError(null);
    try {
      const permiso = await Notification.requestPermission();
      if (permiso !== "granted") {
        setEstado(permiso === "denied" ? "bloqueado" : "apagado");
        return false;
      }
      const registro = await navigator.serviceWorker.ready;
      const sub =
        (await registro.pushManager.getSubscription()) ??
        (await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: claveABytes(CLAVE_PUBLICA) }));
      const res = await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) throw new Error("No se pudo guardar la suscripción.");
      setEstado("activo");
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron activar los avisos.");
      await revisar();
      return false;
    }
  }, [revisar]);

  const desactivar = useCallback(async () => {
    const registro = await navigator.serviceWorker.getRegistration();
    const sub = await registro?.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ endpoint: sub.endpoint }),
      }).catch(() => {});
      await sub.unsubscribe().catch(() => {});
    }
    setEstado("apagado");
  }, []);

  return { estado, error, activar, desactivar };
}
