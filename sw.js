// ===== Service Worker：离线缓存，装到手机后没网也能玩 =====
const VERSION = 'brain-gym-v4';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/core.js',
  './js/gen.js',
  './js/boot.js',
  './js/games/schulte.js',
  './js/games/eagle.js',
  './js/games/memory.js',
  './js/games/slide.js',
  './js/games/maze.js',
  './js/games/sudoku.js',
  './js/games/nonogram.js',
  './js/games/flow.js',
  './js/games/queens.js',
  './js/games/snake.js',
  './js/games/racer.js',
  './js/games/shooter.js',
  './js/games/jump.js',
  './js/games/fruit.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 缓存优先、后台更新：秒开 + 有网时自动拿最新版
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(
    caches.open(VERSION).then(cache =>
      cache.match(e.request).then(cached => {
        const fresh = fetch(e.request)
          .then(res => {
            if (res && res.ok) cache.put(e.request, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || fresh;
      })
    )
  );
});
