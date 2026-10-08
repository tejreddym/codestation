import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';

const origin = process.argv[2] || 'http://localhost:3001';
const directory = await (await fetch(`${origin}/site-directory`)).text();
const routes = [...new Set([...directory.matchAll(/href="(\/(?:tools|stations|about|privacy|terms|licenses|site-directory)[^"#]*)"/g)].map(m=>m[1].replaceAll('&amp;','&')))];
const results=[];
for(let i=0;i<routes.length;i+=8) {
  results.push(...await Promise.all(routes.slice(i,i+8).map(async route => {
    const response=await fetch(`${origin}${route}`); const html=await response.text();
    const title=html.match(/<title>(.*?)<\/title>/)?.[1];
    const canonical=html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
    return {route,status:response.status,title,canonical};
  })));
}
const station=await (await fetch(`${origin}/stations/json-data`)).text();
const glyph=station.match(/<div class="station-glyph"[^>]*>[\s\S]*?<\/div>/)?.[0] || '';
const svg=glyph.match(/<svg[\s\S]*?<\/svg>/)?.[0] || '';
const baseline=JSON.parse(await readFile('docs/site-redesign/before/source-hashes.json','utf8'));
const changed=[];
for(const [path,hash] of Object.entries(baseline)) if(createHash('sha256').update(await readFile(path)).digest('hex')!==hash) changed.push(path);
const allowedSource=['app/tools/page.tsx','app/tools/[slug]/page.tsx','components/StationLanding.tsx','components/ToolCard.tsx','components/InformationalPage.tsx','components/SiteFooter.tsx'];
const unexpected=changed.filter(path=>!path.endsWith('.css')&&!allowedSource.includes(path));
const rgb=hex=>hex.match(/\w\w/g).map(c=>parseInt(c,16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);
const lum=hex=>rgb(hex).reduce((n,c,i)=>n+c*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
const contrasts=[['Light body','151713','f6f5f1'],['Light secondary','596153','eeeee7'],['Light links','476511','f6f5f1'],['Dark secondary','b7bcaf','292f24'],['Dark links','d9f975','20251d'],['Primary action','151713','d9f975'],['Light input boundary','838b7b','ffffff'],['Dark input boundary','7d8773','20251d']].map(([name,a,b])=>({name,ratio:Number(contrast(a,b).toFixed(2))}));
const report={routes:results,routeCount:results.length,allRoutes200:results.every(r=>r.status===200),allExpectedMetadataPresent:results.every(r=>r.title&&(!(r.route.startsWith('/tools/')||r.route.startsWith('/stations/'))||r.canonical)),pagesWithoutCanonical:results.filter(r=>!r.canonical).map(r=>r.route),graphic:{rawSvgBytes:Buffer.byteLength(svg),gzipSvgBytes:gzipSync(svg).length,decorative: glyph.includes('aria-hidden="true"')&&svg.includes('focusable="false"')},contrasts,changedExistingSource:changed,unexpectedSourceChanges:unexpected};
await writeFile('docs/site-redesign/automated-results.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,routes:undefined},null,2));
if(!report.allRoutes200||!report.allExpectedMetadataPresent||unexpected.length||!svg)process.exitCode=1;
