import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { readFile } from 'node:fs/promises';

const origin = process.env.HOMEPAGE_VERIFY_ORIGIN || 'http://localhost:3000';
const response = await fetch(origin);
assert.equal(response.status, 200);
const html = await response.text();
assert.match(html, /Less friction/);
const input = html.match(/<input[^>]+id="global-tool-search"[^>]*>/)?.[0];
assert.ok(input, 'Existing search input ID');
assert.ok(!/\stype=/.test(input), 'Keep omitted type attribute (native text default)');
const routes = [...new Set([...html.matchAll(/<a\b[^>]*href="([^"#]+)"/g)].map(match => match[1]).filter(href => href.startsWith('/')))];
const stationRoutes = routes.filter(route => route.startsWith('/stations/'));
assert.equal(stationRoutes.length, 15);
assert.ok(!routes.some(route => route.includes('developer-math')));
const routeResults = [];
for (const route of routes) {
  const res = await fetch(new URL(route.replaceAll('&amp;', '&'), origin));
  const body = await res.text();
  assert.equal(res.status, 200, route);
  assert.match(body, /<h1\b/, route);
  routeResults.push({ route, status: res.status });
}
const graphics = [...html.matchAll(/<svg\b[^>]*viewBox="(?:150 0 700 250|0 0 460 200|0 0 280 200)"[^>]*>[\s\S]*?<\/svg>/g)].map(match => match[0]);
assert.equal(graphics.length, 4);
graphics.forEach(svg => { assert.match(svg, /aria-hidden="true"/); assert.match(svg, /focusable="false"/); });
const svgBytes = Buffer.byteLength(graphics.join(''));
const gzipBytes = gzipSync(graphics.join('')).length;
assert.ok(gzipBytes < 50 * 1024);
const css = await readFile(new URL('../app/Home.module.css', import.meta.url), 'utf8');
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(css, /\.settle, \.connector \{ animation: none; \}/);
assert.ok(!css.includes('infinite'));
function luminance(hex) {
  const parts = hex.match(/[a-f0-9]{2}/gi).map(c => parseInt(c,16)/255).map(c => c <= .04045 ? c/12.92 : ((c+.055)/1.055)**2.4);
  return parts[0]*.2126 + parts[1]*.7152 + parts[2]*.0722;
}
function contrast(a,b) { const [hi,lo]=[luminance(a),luminance(b)].sort((x,y)=>y-x);return (hi+.05)/(lo+.05); }
const pairs = [
 ['light body','#151713','#F6F5F1',4.5], ['light secondary','#596153','#F6F5F1',4.5],
 ['light secondary on raised','#596153','#EEEEE7',4.5], ['light placeholder','#596153','#FFFFFF',4.5],
 ['dark body','#F6F5F1','#151713',4.5], ['dark secondary','#B7BCAF','#151713',4.5],
 ['dark secondary on raised','#B7BCAF','#292F24',4.5], ['dark placeholder','#B7BCAF','#20251D',4.5],
 ['lime fill text','#151713','#D9F975',4.5], ['footer secondary','#384325','#D9F975',4.5],
 ['light search border','#838B7B','#FFFFFF',3], ['light search border outer','#838B7B','#F6F5F1',3],
 ['dark search border','#7D8773','#20251D',3], ['light focus','#476511','#F6F5F1',3], ['dark focus','#D9F975','#151713',3],
];
const contrasts=pairs.map(([name,fg,bg,min])=>{const ratio=contrast(fg,bg);assert.ok(ratio>=min,`${name}: ${ratio}`);return {name,ratio:Number(ratio.toFixed(2)),minimum:min};});
console.log(JSON.stringify({routeResults,graphics:{count:graphics.length,svgBytes,gzipBytes},contrasts,reducedMotion:'CSS rule verified; live OS preference emulation not performed'},null,2));
