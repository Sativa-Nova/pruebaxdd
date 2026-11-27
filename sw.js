
const CACHE_NAME = "ruta-local-v1";

const APP_FILES = [
  "./",
  "./index.html",
  "./styles.css",
  "./offline.html"
];

// 1. Instalar el Service Worker y guardar archivos
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_FILES);
    })
  );

  self.skipWaiting();
});

// 2. Activar el Service Worker
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) =>
            name.startsWith("ruta-local-") &&
            name !== CACHE_NAME
          )
          .map((name) => caches.delete(name))
      );
    })
  );

  self.clients.claim();
});

// 3. Interceptar las solicitudes del sitio
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Solo manejar solicitudes GET del mismo origen
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin
  ) {
    return;
  }

  // Para las páginas HTML: intentar primero la red
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();

            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, copy);
            });
          }

          return response;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);

          return (
            await cache.match(request)
          ) || (
            await cache.match("./index.html")
          ) || (
            await cache.match("./offline.html")
          );
        })
    );

    return;
  }

  // Para CSS, imágenes y demás recursos:
  // primero consultar la caché
  event.respondWith(
    caches.match(request).then(async (cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      try {
        const response = await fetch(request);

        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(request, response.clone());
        }

        return response;
      } catch {
        return new Response("Recurso no disponible sin conexión", {
          status: 503,
          headers: {
            "Content-Type": "text/plain; charset=utf-8"
          }
        });
      }
    })
  );
});
