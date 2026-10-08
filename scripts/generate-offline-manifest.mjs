import {readdir,readFile,writeFile,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
const root='.next/static', assets=[];let bytes=0;
async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const path=join(dir,entry.name);if(entry.isDirectory())await walk(path);else if(!path.endsWith('.map')){assets.push('/_next/static/'+path.slice(root.length+1).split('/').map(encodeURIComponent).join('/'));bytes+=(await stat(path)).size;}}}
await walk(root);assets.sort();const build=await readFile('.next/BUILD_ID','utf8');const version=createHash('sha256').update(build+JSON.stringify(assets)).digest('hex').slice(0,16);
await writeFile('public/offline-assets.json',JSON.stringify({version,bytes,assets}));
console.log(`Offline application code: ${assets.length} assets, ${bytes} bytes. Page HTML is downloaded on demand.`);
