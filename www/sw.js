// Xoriguer Compactador — funcionament sense connexió i recepció de fitxers compartits (share_target).
const CACHE = 'xoriguer-compactador-v1-icones';
const FITXERS = ['./', 'index.html', 'style.css', 'i18n.js', 'traduccions.js', 'app.js', 'motor.js', 'manifest.webmanifest',
  'vendor/7zz.es6.js', 'vendor/7zz.wasm', 'fonts/Montserrat-ExtraBold.ttf',
  'icons/simbol.png', 'icons/favicon.png', 'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FITXERS)).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE && k !== 'xc-compartits').map((k) => caches.delete(k)))).then(() => self.clients.claim())));

async function rebCompartits(req) {
  try {
    const fd = await req.formData();
    const c = await caches.open('xc-compartits');
    let i = 0;
    for (const f of fd.getAll('fitxers')) {
      if (!(f instanceof File)) continue;
      await c.put(new Request('./compartit/' + Date.now() + '-' + (i++)), new Response(f, { headers: { 'X-Nom': encodeURIComponent(f.name) } }));
    }
  } catch (e) { /* res */ }
  return Response.redirect('./?compartit=1', 303);
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method === 'POST' && url.pathname.endsWith('/compartit')) { e.respondWith(rebCompartits(e.request)); return; }
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // primer la xarxa (versió al dia); sense connexió, la memòria cau
  e.respondWith(fetch(e.request).then((resp) => {
    if (resp.ok && resp.type === 'basic') { const cp = resp.clone(); caches.open(CACHE).then((c) => c.put(e.request, cp)); }
    return resp;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html'))));
});
