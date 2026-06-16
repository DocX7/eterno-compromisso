const CACHE='ec-v24-essencial-final';
const ASSETS=[
  './',
  'index.html',
  'css/app.css',
  'js/app.js',
  'data/reading-plan-365.json',
  'data/devotional-seeds.json',
  'manifest.json',
  'offline.html',
  '404.html',
  'icons/icon-192.png',
  'icons/icon-512.png'
];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()))
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  )
});

self.addEventListener('message',event=>{
  if(event.data && event.data.type==='SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==location.origin) return;

  if(event.request.mode==='navigate'){
    event.respondWith(
      fetch(event.request)
        .then(response=>{
          const copy=response.clone();
          caches.open(CACHE).then(cache=>cache.put('index.html',copy)).catch(()=>{});
          return response;
        })
        .catch(()=>caches.match('index.html').then(response=>response||caches.match('offline.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached=>{
      const network=fetch(event.request).then(response=>{
        if(response && response.status===200){
          const copy=response.clone();
          caches.open(CACHE).then(cache=>cache.put(event.request,copy)).catch(()=>{});
        }
        return response;
      }).catch(()=>cached||caches.match('offline.html'));
      return cached || network;
    })
  );
});
