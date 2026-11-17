"use client";

// ---------------------------------------------------------------------------
// Limpieza de la app instalada.
//
// Una app instalada en el teléfono puede quedarse abierta días. Cuando se
// publica una versión nueva, la vieja pide archivos que ya no existen y la
// pantalla queda en blanco. Aquí se limpia todo lo que el navegador guarda de
// la app (cachés, copias en el almacenamiento local y el service worker
// desactualizado) sin cerrar la sesión ni apagar los avisos.
// ---------------------------------------------------------------------------

const MARCA_RECARGA = "cortmart:recarga-automatica";

/** Borra cachés y copias locales de la app y recarga la página con todo fresco. */
export async function repararApp(destino?: string) {
  try {
    if ("caches" in window) {
      const claves = await caches.keys();
      await Promise.all(claves.map((c) => caches.delete(c)));
    }
  } catch {
    /* sin Cache Storage */
  }
  try {
    // Sólo las copias de datos de la app; la sesión (sb-*) se conserva.
    Object.keys(window.localStorage)
      .filter((k) => k.startsWith("barberia-"))
      .forEach((k) => window.localStorage.removeItem(k));
  } catch {
    /* sin almacenamiento */
  }
  try {
    // Actualiza (no borra) el service worker: borrarlo apagaría los avisos push.
    const registros = (await navigator.serviceWorker?.getRegistrations()) ?? [];
    await Promise.all(registros.map((r) => r.update().catch(() => {})));
  } catch {
    /* sin service worker */
  }
  const url = new URL(destino ?? window.location.href, window.location.origin);
  url.searchParams.set("v", Date.now().toString(36));
  window.location.replace(url.toString());
}

/**
 * Recarga una sola vez por minuto: evita bucles si el problema no se arregla
 * recargando. Devuelve false si ya se intentó hace poco.
 */
export function recargarUnaVez(): boolean {
  try {
    const ultima = Number(window.sessionStorage.getItem(MARCA_RECARGA) ?? 0);
    if (Date.now() - ultima < 60_000) return false;
    window.sessionStorage.setItem(MARCA_RECARGA, String(Date.now()));
  } catch {
    /* sin sessionStorage: se recarga igual */
  }
  void repararApp();
  return true;
}

/** Errores que significan «esta pestaña tiene una versión vieja de la app». */
export function esErrorDeVersion(motivo: unknown): boolean {
  const texto =
    motivo instanceof Error ? `${motivo.name} ${motivo.message}` : typeof motivo === "string" ? motivo : "";
  return /ChunkLoadError|Loading chunk|Loading CSS chunk|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(
    texto
  );
}

/** Escucha errores de versión vieja en toda la app y recarga con archivos nuevos. */
export function vigilarVersionVieja() {
  const revisar = (motivo: unknown) => {
    if (esErrorDeVersion(motivo)) recargarUnaVez();
  };
  const alError = (e: ErrorEvent) => revisar(e.error ?? e.message);
  const alRechazo = (e: PromiseRejectionEvent) => revisar(e.reason);
  window.addEventListener("error", alError);
  window.addEventListener("unhandledrejection", alRechazo);
  return () => {
    window.removeEventListener("error", alError);
    window.removeEventListener("unhandledrejection", alRechazo);
  };
}
