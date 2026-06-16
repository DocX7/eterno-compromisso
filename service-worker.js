const CACHE_NAME = 'eterno-compromisso-v19-master-ultra';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './offline.html',
  './404.html',
  './README.md',
  './INSTRUCOES-DE-ATUALIZACAO.txt',
  './icons/icon-192.png',
  './icons/icon-512.png'
];
const BIBLE_ASSETS = ['./biblia-acf.csv'];
const CORE_ASSETS = APP_SHELL.concat(BIBLE_ASSETS);

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_ASSETS).catch(() => undefined))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isNetworkOnly(url){
  return /firebaseio|firestore|googleapis|gstatic\.com\/firebasejs|api\.openai\.com/.test(url.hostname + url.pathname);
}
function isHtmlNavigation(req){
  return req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
}
function sameOrigin(req){
  try { return new URL(req.url).origin === self.location.origin; } catch(e) { return false; }
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (!sameOrigin(req) || url.pathname.endsWith('/firestore.rules') || isNetworkOnly(url)) return;

  if (isHtmlNavigation(req)) {
    event.respondWith(
      fetch(req).then(resp => {
        const copy = resp.clone();
        caches.open(CACHE_NAME).then(cache => cache.put('./index.html', copy)).catch(() => undefined);
        return resp;
      }).catch(() => caches.match('./index.html').then(cached => cached || caches.match('./offline.html')))
    );
    return;
  }

  if (url.pathname.endsWith('/biblia-acf.csv')) {
    event.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(resp => {
        const copy = resp.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(() => undefined);
        return resp;
      }).catch(() => cached || caches.match('./offline.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req).then(resp => {
        if (resp && resp.ok) {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(() => undefined);
        }
        return resp;
      }).catch(() => cached);
      return cached || network;
    })
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({type: 'window', includeUncontrolled: true}).then(clients => {
      for (const client of clients) if ('focus' in client) return client.focus();
      if (self.clients.openWindow) return self.clients.openWindow('./index.html');
    })
  );
});
