// Service worker de PIT WALL: guarda la app para abrirla rápido y sin conexión.
// build.mjs rellena la versión y la ruta del JS en cada despliegue, así cada
// versión estrena su propia caché y la anterior se borra al activarse.
const CACHE = "pitwall-__BUILD__";
// Scripts y fuentes de CDN: sus URLs llevan versión, no cambian nunca, y por
// eso sobreviven a los despliegues.
const CACHE_CDN = "pitwall-cdn";
const SHELL = ["/", "/__APP__", "/manifest.json", "/favicon.svg", "/icon-192.png"];
const CDN = ["unpkg.com", "www.gstatic.com", "fonts.googleapis.com", "fonts.gstatic.com"];
// Con conexión lenta, cuánto se espera a la red antes de mostrar la copia guardada
const ESPERA_MS = 2500;

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(
        ks.filter((k) => k.startsWith("pitwall-") && k !== CACHE && k !== CACHE_CDN)
          .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    // La config de Firebase siempre va a la red
    if (url.pathname.startsWith("/api/")) return;
    if (req.mode === "navigate") {
      if (url.pathname === "/" || url.pathname === "/index.html") e.respondWith(paginaFresca(req));
      return;
    }
    e.respondWith(cachePrimero(req, CACHE));
  } else if (CDN.includes(url.hostname)) {
    e.respondWith(cachePrimero(req, CACHE_CDN));
  }
});

// La página se pide siempre a la red para ver la última versión; la copia
// guardada solo se usa si la red falla o tarda demasiado.
async function paginaFresca(req) {
  const cache = await caches.open(CACHE);
  const guardada = await cache.match("/");
  const red = fetch(req).then((res) => {
    if (res.ok) cache.put("/", res.clone());
    return res;
  });
  if (!guardada) return red;
  const lenta = new Promise((ok) => setTimeout(() => ok(guardada), ESPERA_MS));
  return Promise.race([red.catch(() => guardada), lenta]);
}

async function cachePrimero(req, nombre) {
  const cache = await caches.open(nombre);
  const guardada = await cache.match(req, { ignoreVary: true });
  if (guardada) return guardada;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}
