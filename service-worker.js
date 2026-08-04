const CACHE_NAME="attribute-shogi-v60";
const ASSETS=[
  "./",
  "./index.html",
  "./styles.css?v=70",
  "./game-core.js?v=17",
  "./app.js?v=54",
  "./attributes.json",
  "./fire-realistic-v1.png",
  "./water-realistic-v1.png",
  "./wind-realistic-v1.png",
  "./manifest.webmanifest",
  "./app-icon.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./RULES.md",
  "./RULES_EN.md",
  "./BETA_TEST_GUIDE.md",
  "./BETA_TEST_GUIDE_EN.md",
  "./PRIVACY.md",
  "./PRIVACY_EN.md"
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
  if(event.request.mode==="navigate"){
    event.respondWith(fetch(event.request).then(response=>response.ok?response:Promise.reject(Error("navigation failed"))).catch(()=>caches.match("./index.html")));
    return;
  }
  event.respondWith(fetch(event.request).then(response=>{
    if(response.ok&&new URL(event.request.url).origin===self.location.origin)caches.open(CACHE_NAME).then(cache=>cache.put(event.request,response.clone()));
    return response;
  }).catch(()=>caches.match(event.request).then(response=>response||Response.error())));
});
