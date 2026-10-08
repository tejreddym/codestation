/* Explicit, bounded offline pack. Never cache requests or tool content. */
let installing=false;
const PREFIX='code-station-offline-v1-';
const PAGES=['/offline','/tools/json-formatter','/tools/text-counter'];
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
async function readyCache(){const names=(await caches.keys()).filter(n=>n.startsWith(PREFIX));for(const name of names){const cache=await caches.open(name);if(await cache.match('/__code-station-offline-ready'))return cache;}return null;}
self.addEventListener('message',event=>{
 if(event.data?.type!=='INSTALL_PACK'||!event.ports[0])return;
 const port=event.ports[0];
 if(installing){port.postMessage({error:'Another offline download is in progress. Wait for it to finish.'});return;}
 installing=true;
 event.waitUntil((async()=>{let name='';try{
  const response=await fetch('/offline-assets.json',{cache:'no-store'});if(!response.ok)throw Error('Offline packs require a production build.');const manifest=await response.json();
  if(!/^[a-f0-9]{16}$/.test(manifest.version)||!Array.isArray(manifest.assets)||manifest.assets.length>1500||manifest.bytes>40*1024*1024||manifest.assets.some(path=>typeof path!=='string'||!path.startsWith('/_next/static/')||path.includes('..')||path.includes('?')||path.includes('#')))throw Error('Invalid offline manifest.');
  name=PREFIX+manifest.version;const cache=await caches.open(name);const paths=[...PAGES,'/app-icon.svg','/manifest.webmanifest',...manifest.assets];let completed=0;
  // Keep an existing ready pack intact when updating the same build.
  if(await cache.match('/__code-station-offline-ready')){port.postMessage({done:true});return;}
  for(const path of paths){const result=await fetch(path,{cache:'reload',credentials:'same-origin'});if(!result.ok||result.redirected)throw Error('A required offline asset could not be downloaded.');await cache.put(path,result);port.postMessage({progress:++completed,total:paths.length});}
  await cache.put('/__code-station-offline-ready',new Response('ready'));
  for(const old of await caches.keys())if(old.startsWith(PREFIX)&&old!==name)await caches.delete(old);
  port.postMessage({done:true});
 }catch(error){if(name){const cache=await caches.open(name);if(!await cache.match('/__code-station-offline-ready'))await caches.delete(name);}port.postMessage({error:error instanceof Error?error.message:'Offline download failed.'});}finally{installing=false;}})());
});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin||url.search||request.headers.has('RSC'))return;
 if(request.mode==='navigate'&&PAGES.includes(url.pathname)){
  event.respondWith(fetch(request).catch(async()=>{const cache=await readyCache();return await cache?.match(url.pathname)||new Response('Offline pack unavailable. Reconnect and download it in Settings.',{status:503,headers:{'Content-Type':'text/plain'}});}));
 }else if(url.pathname.startsWith('/_next/static/')||['/app-icon.svg','/manifest.webmanifest'].includes(url.pathname)){
  event.respondWith((async()=>{const cache=await readyCache();return await cache?.match(url.pathname)||fetch(request);})());
 }
});
