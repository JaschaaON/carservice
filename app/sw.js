/* Hält die App offline verfügbar. Die Daten selbst laufen immer übers
   Netz — veraltete Kilometerstände wären schlimmer als eine Fehlermeldung. */
const CACHE = "carservice-v3";
const SHELL = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener("activate", e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
    .then(()=>self.clients.claim()));
});
self.addEventListener("fetch", e=>{
  const url = new URL(e.request.url);

  /* Bilder liegen unter derselben ID unveraendert — die duerfen aus dem
     Cache kommen. Damit steht die Fotoübersicht auch ohne Empfang. */
  if(url.pathname.startsWith("/api/photos/")){
    e.respondWith(caches.match(e.request).then(treffer=>
      treffer || fetch(e.request).then(r=>{
        if(r.ok){ const kopie=r.clone(); caches.open(CACHE).then(c=>c.put(e.request,kopie)); }
        return r;
      })));
    return;
  }
  if(url.pathname.startsWith("/api/")) return;          // Daten nie aus dem Cache
  if(e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request)
      .then(r=>{ const copy=r.clone(); caches.open(CACHE).then(c=>c.put(e.request,copy)); return r; })
      .catch(()=>caches.match(e.request).then(r=>r||caches.match("./index.html")))
  );
});
