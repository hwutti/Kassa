/* POS-Kasse Service Worker
 * Strategie:
 *  - App-Shell / statische Assets: cache-first (schneller Start, offline lesbar).
 *  - Navigationen: network-first mit Offline-Fallback.
 *  - API-Aufrufe (/api/*): NETWORK-ONLY, niemals cachen. So können weder Preise
 *    noch die Produktliste unbemerkt veraltet ausgeliefert werden.
 *  - Update: skipWaiting nur nach ausdrücklicher Nachricht vom Client, damit eine
 *    laufende Bestellung nicht durch ein Auto-Update zerstört wird.
 */

const CACHE_VERSION = "pos-kasse-v1";
const STATIC_CACHE = `${CACHE_VERSION}-static`;

// Minimaler App-Shell-Kern. Weitere Assets werden zur Laufzeit ergänzt.
const PRECACHE_URLS = ["/kasse", "/manifest.webmanifest", "/offline.html"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS).catch(() => undefined))
      // NICHT automatisch skipWaiting – erst auf Nutzerbestätigung (Message).
      .then(() => undefined),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("pos-kasse-") && !k.startsWith(CACHE_VERSION))
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

// Client kann ein Update bewusst aktivieren (nach Abschluss/Verwerfen der Bestellung).
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

function istApi(url) {
  return url.pathname.startsWith("/api/");
}

function istStatischesAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest" ||
    /\.(?:css|js|woff2?|png|jpg|jpeg|svg|webp|ico)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // nur GET wird behandelt

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // fremde Origins nicht anfassen

  // 1) API: immer Netzwerk, nie Cache. Fehler wird an den Client durchgereicht.
  if (istApi(url)) {
    event.respondWith(fetch(req));
    return;
  }

  // 2) Navigationen: network-first, Fallback auf gecachte Seite oder Offline-Seite.
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const netz = await fetch(req);
          const cache = await caches.open(STATIC_CACHE);
          cache.put(req, netz.clone()).catch(() => undefined);
          return netz;
        } catch {
          const cache = await caches.open(STATIC_CACHE);
          return (
            (await cache.match(req)) ||
            (await cache.match("/kasse")) ||
            (await cache.match("/offline.html")) ||
            new Response("Offline", { status: 503, statusText: "Offline" })
          );
        }
      })(),
    );
    return;
  }

  // 3) Statische Assets: cache-first mit Hintergrund-Aktualisierung.
  if (istStatischesAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC_CACHE);
        const cached = await cache.match(req);
        const netzPromise = fetch(req)
          .then((res) => {
            if (res && res.ok) cache.put(req, res.clone()).catch(() => undefined);
            return res;
          })
          .catch(() => undefined);
        return cached || (await netzPromise) || new Response("", { status: 504 });
      })(),
    );
    return;
  }

  // 4) Alles andere: Netzwerk, mit Cache als Rückfall.
  event.respondWith(fetch(req).catch(() => caches.match(req)));
});
