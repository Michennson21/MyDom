const CACHE='mydom-nalchik-v35-address-form';
const CORE=['./','./index.html','./design.css','./manifest.webmanifest','./icon-192.png','./icon-512.png','./qr.js','./welcome.js','./meters.js','./apartments.js','./address-catalog.js','./address-ui.js','./cloud.js','./vendor/jsQR-1.4.0.js','./vendor/zxing-0.21.3.min.js','./vendor/zxing-wasm-3.1.5.js','./vendor/zxing-wasm-3.1.5.wasm'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)));self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('mydom-nalchik-')&&k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
 event.respondWith(fetch(event.request).then(r=>{if(r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));}return r;}).catch(()=>caches.match(event.request).then(r=>r||(event.request.mode==='navigate'?caches.match('./index.html'):Response.error()))));
});
self.addEventListener('push',event=>{let data={};try{data=event.data?event.data.json():{};}catch(e){data={body:event.data?event.data.text():''};}const title=data.title||'Мой дом — Нальчик';const options={body:data.body||'Новое событие по вашему дому',icon:'./icon-192.png',badge:'./icon-192.png',tag:data.tag||'mydom-event',data:{url:data.url||'./'}};event.waitUntil(self.registration.showNotification(title,options));});
self.addEventListener('notificationclick',event=>{event.notification.close();const url=(event.notification.data&&event.notification.data.url)||'./';event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{for(const c of list){if('focus' in c){c.navigate(url);return c.focus();}}return clients.openWindow?clients.openWindow(url):undefined;}));});

