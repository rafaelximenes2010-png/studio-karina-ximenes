// Service worker — offline e cache versionado. BUILD é gerado pelo conteúdo (scripts/gen_sw.py): cada publicação troca o cache inteiro.
const VERSION = '2.1.1';
const BUILD = '17858e8ca6';
const CACHE = 'studio-karina-' + VERSION + '-' + BUILD;
const CORE = [
 "./",
 "./assets/brand/favicon-32.png",
 "./assets/brand/favicon-48.png",
 "./assets/brand/icon-180.png",
 "./assets/brand/icon-192.png",
 "./assets/brand/icon-512.png",
 "./assets/brand/icon-maskable-192.png",
 "./assets/brand/icon-maskable-512.png",
 "./assets/brand/logo-original.jpg",
 "./assets/brand/og-image.jpg",
 "./assets/brand/og-square.png",
 "./assets/fonts/cormorant-garamond-latin-400-italic.woff2",
 "./assets/fonts/cormorant-garamond-latin-400-normal.woff2",
 "./assets/fonts/cormorant-garamond-latin-600-normal.woff2",
 "./assets/fonts/inter-latin-400-normal.woff2",
 "./assets/fonts/inter-latin-500-normal.woff2",
 "./assets/fonts/inter-latin-600-normal.woff2",
 "./assets/fonts/inter-latin-700-normal.woff2",
 "./assets/photos/caderno.jpg",
 "./assets/photos/cha.jpg",
 "./assets/photos/eucalipto.jpg",
 "./assets/photos/mar.jpg",
 "./assets/photos/montanhas.jpg",
 "./assets/photos/trilha.jpg",
 "./assets/tutorial/kxs-tutorial-capa.jpg",
 "./css/app.css",
 "./index.html",
 "./instalar.html",
 "./js/app.js",
 "./js/install.js",
 "./js/lib/cite.js",
 "./js/lib/compare.js",
 "./js/lib/compose.js",
 "./js/lib/content.js",
 "./js/lib/docx.js",
 "./js/lib/freeweek.js",
 "./js/lib/i18n-dict.js",
 "./js/lib/i18n.js",
 "./js/lib/ics.js",
 "./js/lib/navigation.js",
 "./js/lib/pdf.js",
 "./js/lib/plan.js",
 "./js/lib/render.js",
 "./js/lib/store.js",
 "./js/lib/templates.js",
 "./js/lib/util.js",
 "./js/lib/zip.js",
 "./js/modules/agenda.js",
 "./js/modules/ai.js",
 "./js/modules/create.js",
 "./js/modules/docs.js",
 "./js/modules/editor.js",
 "./js/modules/home.js",
 "./js/modules/library.js",
 "./js/modules/lock.js",
 "./js/modules/media.js",
 "./js/modules/photos.js",
 "./js/modules/profile.js",
 "./js/modules/quick.js",
 "./js/modules/science.js",
 "./js/modules/shared.js",
 "./js/modules/themeweek.js",
 "./js/modules/tour.js",
 "./js/ui.js",
 "./manifest.webmanifest"
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.allSettled(CORE.map((u) => c.add(new Request(u, { cache: 'reload' }))))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => { for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k); await self.clients.claim(); })());
});
self.addEventListener('fetch', (e) => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // APIs externas: sempre rede
  // HTML: rede primeiro (pega versões novas), cache como reserva offline
  if (req.mode === 'navigate' || req.destination === 'document') {
    e.respondWith(fetch(req).then((r) => { const c = r.clone(); caches.open(CACHE).then((x) => x.put('./index.html', c)); return r; }).catch(() => caches.match('./index.html')));
    return;
  }
  // Demais arquivos: cache da versão atual (nunca mistura versões); o que não estiver no cache vem da rede
  e.respondWith(caches.open(CACHE).then((c) => c.match(req, { ignoreSearch: true })).then((hit) => hit || fetch(req).then((r) => {
    if (r.ok && CORE.includes(url.pathname.replace(new URL(self.registration.scope).pathname, './'))) { const c = r.clone(); caches.open(CACHE).then((x) => x.put(req, c)); }
    return r;
  })));
});
