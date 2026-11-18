// Offline support: serve from cache, refresh the cache in the background.
const CACHE = 'dino-dig-v40';
const SCENES = [];
for (let w = 1; w <= 5; w++) {
  SCENES.push(`assets/map-${w}.svg`, `assets/boss-${w}.svg`, `assets/rex-${w}.svg`);
  for (let l = 1; l <= 5; l++) SCENES.push(`assets/s${w}-${l}.svg`);
}
const SHELL = [
  './', 'index.html', 'style.css', 'outfits.js', 'game.js', 'manifest.webmanifest',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'assets/title-bg.svg', 'assets/wardrobe-bg.svg',
  'assets/pip.svg', 'assets/stegi.svg', 'assets/petra.svg', 'assets/anki.svg', 'assets/rafi.svg',
  'assets/magma-rex.svg', 'assets/buzzer.svg', 'assets/lava-blob.svg', 'assets/egg.svg',
  'assets/dirt-1.svg', 'assets/dirt-2.svg', 'assets/dirt-3.svg', 'assets/dirt-4.svg', 'assets/dirt-5.svg',
  'assets/power-bone.svg', 'assets/power-shield.svg', 'assets/power-ice.svg', 'assets/power-amber.svg',
  ...SCENES,
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(e.request, { ignoreSearch: true });
      const network = fetch(e.request)
        .then((res) => { if (res && (res.ok || res.type === 'opaque')) cache.put(e.request, res.clone()); return res; })
        .catch(() => cached);
      return cached || network;
    })
  );
});
