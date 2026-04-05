importScripts("./app-meta.js");

const CACHE_NAME = self.PARABREACH_META?.cacheName || "parabreach-shell-dev";
const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./app-meta.js",
  "./style.css",
  "./game.js",
  "./manifest.json",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/fonts/PressStart2P-Regular.ttf",
  "./assets/sounds/ChopperExplosion.wav",
  "./assets/sounds/FinalExplosion.wav",
  "./assets/sounds/MissileExplosion.wav",
  "./assets/sounds/MissileLaunch.wav",
  "./assets/sounds/TrooperAlert.wav",
  "./assets/sounds/TrooperGroundHit.wav",
  "./assets/sounds/TrooperHit.wav",
  "./assets/sounds/TurretShoot.wav"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(FILES_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  const isSameOrigin = requestUrl.origin === self.location.origin;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("./index.html"))
    );
    return;
  }

  if (!isSameOrigin) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      const networkFetch = fetch(event.request)
        .then(networkResponse => {
          if (networkResponse && networkResponse.ok) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || networkFetch;
    })
  );
});
