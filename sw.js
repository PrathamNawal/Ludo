// Offline-capable service worker with NETWORK-FIRST loading: when online you always get the
// newest files (revalidated, bypassing the browser's 10-minute HTTP cache); when offline or on a
// very slow connection (3 s) you get the cached copy. An old cache-first worker is what left
// phones stuck on stale builds, so freshness is the priority and the cache is the safety net.
importScripts('js/version.js');
const VERSION = 'ludo-adda-' + self.LUDO_BUILD;
const ASSETS = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css', 'js/version.js',
  'js/app.js', 'js/rules.js', 'js/dice.js', 'js/bots.js', 'js/puzzle.js', 'js/family.js',
  'js/i18n.js', 'js/store.js', 'js/audio.js', 'js/voice-rank.js', 'js/board.js', 'js/board3d.js', 'js/view.js', 'js/ui.js',
  'vendor/three.min.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
];
self.addEventListener('install', e => {
  // cache:'reload' skips the HTTP cache so a new build never precaches stale files
  e.waitUntil(caches.open(VERSION).then(c => Promise.all(ASSETS.map(a => c.add(new Request(a, { cache: 'reload' }))))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(networkFirst(req));
});
async function networkFirst(req) {
  const cache = await caches.open(VERSION);
  const fresh = fetch(req.url, { cache: 'no-cache' }).then(res => { if (res.ok) cache.put(req, res.clone()); return res; });
  fresh.catch(() => {});
  try {
    return await Promise.race([fresh, new Promise((_, rej) => setTimeout(() => rej(new Error('slow')), 3000))]);
  } catch {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try { return await fresh; } catch { return (req.mode === 'navigate' && (await cache.match('index.html'))) || Response.error(); }
  }
}
