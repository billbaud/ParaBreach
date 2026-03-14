const CACHE_NAME = "parabreach-v2";
const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./style.css",
  "./game.js",
  "./manifest.json",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
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
});

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});
