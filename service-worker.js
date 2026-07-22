const CACHE_NAME="attribute-shogi-v2";
const ASSETS=[
  "./",
  "./index.html",
  "./styles.css?v=28",
  "./game-core.js?v=7",
  "./app.js?v=27",
  "./attributes.json",
  "./tornado.svg?v=2",
  "./manifest.webmanifest",
  "./RULES.md"
];

self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate",event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  event.respondWith(fetch(event.request).then(response=>{
    const copy=response.clone();
    caches.open(CACHE_NAME).then(cache=>cache.put(event.request,copy));
    return response;
  }).catch(()=>caches.match(event.request).then(response=>response||caches.match("./index.html"))));
});
