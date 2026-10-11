const CACHE='mydom-nalchik-v54-all-meter-readings';
const CORE=['./','./index.html','./billing.js','./meter-values.js','./backup-schema.js','./safe-storage.js','./bootstrap.js','./design.css','./home-design.js','./manifest.webmanifest','./icon-192.png','./icon-512.png','./qr.js','./welcome.js','./meters.js','./meter-registry.js','./apartments.js','./address-catalog.js','./address-ui.js','./management-data.js','./management.js','./management-ui.js','./issues.js','./issue-guide.js','./cloud.js','./outage-matcher.js','./outage-ui.js','./vendor/jsQR-1.4.0.js','./vendor/zxing-0.21.3.min.js','./vendor/zxing-wasm-3.1.5.js','./vendor/zxing-wasm-3.1.5.wasm'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE.map(path=>new Request(path,{cache:'reload'})))));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('mydom-nalchik-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
// Keep the installed application shell together. A new worker waits until old tabs close.
const corePaths=new Set(CORE.map(path=>new URL(path,self.registration.scope).pathname));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin||/\/api(?:\/|$)/.test(url.pathname))return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  if(corePaths.has(url.pathname)){
   const cached=await cache.match(url.origin+url.pathname);
   if(cached)return cached;
  }
  try{return await fetch(event.request);}catch(error){
   if(event.request.mode==='navigate')return await cache.match(new URL('./index.html',self.registration.scope).href)||Response.error();
   return Response.error();
  }
 })());
});
self.addEventListener('push',event=>{let data={};try{data=event.data?event.data.json():{};}catch(e){data={body:event.data?event.data.text():''};}const title=data.title||'Мой дом — Нальчик';const options={body:data.body||'Новое событие по вашему дому',icon:'./icon-192.png',badge:'./icon-192.png',tag:data.tag||'mydom-event',data:{url:data.url||'./'}};event.waitUntil(self.registration.showNotification(title,options));});
self.addEventListener('notificationclick',event=>{event.notification.close();const url=(event.notification.data&&event.notification.data.url)||'./';event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{for(const c of list){if('focus' in c){c.navigate(url);return c.focus();}}return clients.openWindow?clients.openWindow(url):undefined;}));});


