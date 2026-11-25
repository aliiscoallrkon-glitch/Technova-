/* Service Worker - تكنوفا Technova */
const VERSION = 'v1'; // غيّر الرقم (v2, v3...) عند تحديث الموقع ليصل التحديث للجميع
const CORE = 'technova-core-' + VERSION;
const EXTRA = 'technova-extra-' + VERSION;
const PAGE = './index.html';
const CORE_FILES = [PAGE, './manifest.json', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CORE)
      .then(c => Promise.allSettled(CORE_FILES.map(f => c.add(f))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys
        .filter(k => k.startsWith('technova-') && k !== CORE && k !== EXTRA)
        .map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const trim = async (name, max) => {
  const c = await caches.open(name), keys = await c.keys();
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);
};

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || !url.protocol.startsWith('http')) return;

  // الصفحة: تفتح فورًا من الذاكرة (وتعمل بدون إنترنت) وتتحدّث في الخلفية
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const cache = await caches.open(CORE);
      const cached = await cache.match(PAGE);
      const refresh = fetch(PAGE, { cache: 'no-cache' })
        .then(async r => { if (r.ok) await cache.put(PAGE, r.clone()); return r; })
        .catch(() => null);
      if (cached) { e.waitUntil(refresh); return cached; }
      return (await refresh) || Response.error();
    })());
    return;
  }

  // الخطوط والملفات الخارجية: من الذاكرة ثم تحديث في الخلفية
  if (url.origin !== location.origin) {
    if (!['style', 'font', 'image', 'script'].includes(req.destination)) return;
    e.respondWith(caches.open(EXTRA).then(async cache => {
      const hit = await cache.match(req);
      const net = fetch(req).then(r => {
        if (r.ok || r.type === 'opaque') cache.put(req, r.clone()).then(() => trim(EXTRA, 40)).catch(() => {});
        return r;
      }).catch(() => hit);
      return hit || net;
    }));
    return;
  }

  // ملفات الموقع نفسه: من الذاكرة أولًا
  e.respondWith(caches.match(req).then(hit => hit || fetch(req)));
});
