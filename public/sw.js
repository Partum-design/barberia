/* Service worker de CortMart: avisos push y apertura de la app. */

// Cambia este número en cada cambio del archivo: los teléfonos detectan la
// versión nueva y la activan sin que nadie tenga que reinstalar la app.
const VERSION = "2026-11-17";

self.addEventListener("install", () => self.skipWaiting());

// Al activarse borra cualquier caché que haya dejado una versión anterior: la
// app nunca sirve páginas ni datos guardados, siempre los pide al servidor.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((claves) => Promise.all(claves.map((c) => caches.delete(c))))
      .catch(() => {})
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "version" && event.source) event.source.postMessage({ version: VERSION });
});

self.addEventListener("push", (event) => {
  let datos = {};
  try {
    datos = event.data ? event.data.json() : {};
  } catch {
    datos = { titulo: "CortMart", cuerpo: event.data ? event.data.text() : "" };
  }
  const titulo = datos.titulo || "CortMart";
  event.waitUntil(
    self.registration.showNotification(titulo, {
      body: datos.cuerpo || "",
      icon: "/iconos/icono-192.png",
      badge: "/iconos/insignia-96.png",
      data: { url: datos.url || "/" },
      tag: datos.url || undefined,
      renotify: true,
      vibrate: [80, 40, 120],
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destino = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((ventanas) => {
      for (const v of ventanas) {
        if (v.url.startsWith(self.location.origin) && "focus" in v) {
          v.navigate(destino);
          return v.focus();
        }
      }
      return self.clients.openWindow(destino);
    })
  );
});
