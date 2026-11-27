/* المحبرة: ملفات الواجهة العامة فقط. لا تُخزّن بيانات المعلم أو طلبات Google Apps Script. */
const CACHE='mihbara-public-v20261127d';
const ROOT=new URL('./',self.location.href);
const PUBLIC=['./','./index.html','./manifest.json','./brand.svg','./icon-192.png','./icon-512.png','./identity.css?v=20261127d','./timetable-data.js?v=20261127b','./schedule.js?v=20261127c'];
const URLS=new Set(PUBLIC.map(path=>new URL(path,ROOT).href));
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(PUBLIC)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>(k.startsWith('mihbara-public-')||k==='khalil-app-v2')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET'||!URLS.has(request.url))return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    try{const response=await fetch(request);if(response.ok)await cache.put(request,response.clone());return response}
    catch(error){const cached=await cache.match(request);if(cached)return cached;throw error}
  })());
});
