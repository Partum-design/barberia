/* Service worker de CortMart: avisos push y apertura de la app. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let datos = {};
  try {
    datos = event.data ? event.data.json() : {};
  } catch {
    datos = { titulo: "CortMart", cuerpo: event.data ? event.data.text() : "" };
  }
  const titulo = datos.titulo || "CortMart";
  event.waitUntil(
    (async () => {
      const ventanas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // Con la app abierta y al frente, el aviso sale dentro de la página y no
      // como notificación del sistema: se ve una sola vez. Safari (iPhone)
      // exige mostrar siempre la notificación; ahí la página sólo actualiza la
      // campana sin repetir el aviso.
      const alFrente = ventanas.some((v) => v.visibilityState === "visible" && v.focused);
      const exigeNotificacion = /iPhone|iPad|Macintosh/.test(self.navigator.userAgent) && !/Chrome|Android/.test(self.navigator.userAgent);
      const mostrar = !alFrente || exigeNotificacion;
      ventanas.forEach((v) => v.postMessage({ tipo: "cortmart:aviso", mostrada: mostrar }));
      if (!mostrar) return;
      await self.registration.showNotification(titulo, {
        body: datos.cuerpo || "",
        icon: "/iconos/icono-192-v2.png",
        badge: "/iconos/insignia-96-v2.png",
        data: { url: datos.url || "/" },
        tag: datos.url || undefined,
        renotify: true,
        vibrate: [80, 40, 120],
      });
    })()
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
