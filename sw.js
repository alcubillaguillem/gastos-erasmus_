// Service worker: permite abrir la app sin conexión (los datos necesitan internet en modo Supabase).
const CACHE = "gastos-erasmus-v27";
const ASSETS = [
  "./", "index.html", "styles.css?v=27", "compartidos.js?v=27", "app.js?v=27", "charts.js?v=27", "config.js?v=27", "manifest.webmanifest",
  "vendor/supabase-js-2.117.3.js", "vendor/fonts/inter-latin.woff2", "vendor/fonts/space-grotesk-latin.woff2",
  "icons/icon.svg?v=27", "icons/icon-192.png?v=27", "icons/icon-512.png?v=27", "icons/apple-touch-icon.png?v=27",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Red primero (para recibir siempre la última versión), caché si no hay conexión.
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // Solo los archivos de la propia app; las llamadas a Supabase nunca se guardan en caché.
  const cacheable = e.request.method === "GET" && url.origin === location.origin;
  if (!cacheable) return;
  e.respondWith(
    // "no-cache": siempre pregunta al servidor si hay versión nueva (evita mezclar
    // archivos viejos y nuevos que el navegador tuviera guardados).
    fetch(e.request, { cache: "no-cache" })
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});

// Avisos de la app (Web Push): «Gasto apuntado» al guardar un gasto desde el atajo.
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { cuerpo: e.data?.text() }; }
  e.waitUntil(self.registration.showNotification(d.titulo || "Gastos", {
    body: d.cuerpo || "",
    icon: "icons/icon-192.png?v=27",
    badge: "icons/icon-192.png?v=27",
    tag: d.tag,
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil((async () => {
    const ventanas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const w of ventanas) if ("focus" in w) return w.focus();
    return self.clients.openWindow("./");
  })());
});
