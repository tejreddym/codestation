/** Rebuild the Code Station brand kit from local outlined artwork. No font/network access. */
import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import sharp from 'sharp';
import { zipSync } from 'fflate';

const project = join(dirname(fileURLToPath(import.meta.url)), '..');
const root = join(project, 'public/brand');
const outlines = JSON.parse(await readFile(join(root, 'source/wordmark-outlines.json'), 'utf8'));
const variants = {
  dark: { ink: '#151713', bg: '#F6F5F1', dots: ['#B45309', '#147D64', '#476511'], accent: '#476511' },
  light: { ink: '#F6F5F1', bg: '#151713', dots: ['#FBBF24', '#6EE7B7', '#D9F975'], accent: '#D9F975' },
};
const assets = [];
const fmt = n => Number(n.toFixed(4));
const title = name => name.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
function svg(w, h, label, body, extra = '') {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="title desc"><title id="title">Code Station — ${label}</title><desc id="desc">${extra || 'Official site brace mark and outlined Code Station lettering. Transparent canvas.'}</desc>${body}</svg>\n`;
}
function textPath(word, x, y, width, height, ink, center = false) {
  const data = outlines.words[word];
  const scale = Math.min(width / data.width, height / data.height);
  const tx = center ? x + (width - data.width * scale) / 2 : x;
  const ty = y + (height - data.height * scale) / 2;
  return `<path fill="${ink}" transform="translate(${fmt(tx)} ${fmt(ty)}) scale(${fmt(scale)})" d="${data.path}"/>`;
}
function mark(palette, { small = false, mono = false } = {}) {
  if (small) {
    return `<g fill="none" stroke="${palette.ink}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="2.5" width="26" height="25" rx="5"/><path d="M12 8.5c-3 0-3 1.8-3 3.3v1.1c0 1.4-.6 2.1-2 2.1 1.4 0 2 .7 2 2.1v1.1c0 1.5 0 3.3 3 3.3m8-13c3 0 3 1.8 3 3.3v1.1c0 1.4.6 2.1 2 2.1-1.4 0-2 .7-2 2.1v1.1c0 1.5 0 3.3-3 3.3"/></g>${[10,16,22].map((x,i)=>`<circle cx="${x}" cy="30" r="1.5" fill="${mono ? palette.ink : palette.dots[i]}"/>`).join('')}`;
  }
  const frame = 'M28 10H69Q84 10 84 25V64Q84 83 65 83H29Q12 83 12 66V28Q12 10 28 10Z';
  const b = outlines.braces, scale = Math.min(43 / b.width, 31 / b.height);
  return `<g transform="rotate(-2 48 46)">${!mono ? `<path d="${frame}" transform="translate(4 4)" fill="none" stroke="${palette.accent}" stroke-opacity=".3" stroke-width="5"/>` : ''}<path d="${frame}" fill="none" stroke="${palette.ink}" stroke-width="5"/><path fill="${palette.ink}" transform="translate(${fmt(48-b.width*scale/2)} ${fmt(46-b.height*scale/2)}) scale(${fmt(scale)})" d="${b.path}"/>${[31,47,63].map((x,i)=>`<circle cx="${x}" cy="91" r="4.6" fill="${mono ? palette.ink : palette.dots[i]}"/>`).join('')}</g>`;
}
function placedMark(palette,x,y,size,options={}) {
  return `<g transform="translate(${x} ${y}) scale(${fmt(size/(options.small?32:104))})">${mark(palette,options)}</g>`;
}
function horizontal(p) {
  return placedMark(p,8,8,112) + textPath('Code Station',140,38,328,52,p.ink);
}
function stacked(p) {
  const s = Math.min(185/outlines.words.Station.width,46/outlines.words.Station.height);
  const word = (name,y)=>`<path fill="${p.ink}" transform="translate(164 ${y}) scale(${fmt(s)})" d="${outlines.words[name].path}"/>`;
  return placedMark(p,8,26,144)+word('Code',48)+word('Station',108);
}
function stackedWords(p,x,y,width,capHeight,gap,center=false) {
  const reference=outlines.words.Station;
  const scale=Math.min(width/reference.width,capHeight/reference.height);
  return ['Code','Station'].map((name,index)=>{
    const data=outlines.words[name];
    const tx=center?x+(width-data.width*scale)/2:x;
    return `<path fill="${p.ink}" transform="translate(${fmt(tx)} ${fmt(y+index*(reference.height*scale+gap))}) scale(${fmt(scale)})" d="${data.path}"/>`;
  }).join('');
}
function vertical(p) {
  return placedMark(p,80,16,160)+stackedWords(p,40,208,240,62,18,true);
}
async function save(relative, contents, meta) {
  const path=join(root,relative);await mkdir(dirname(path),{recursive:true});await writeFile(path,contents);
  assets.push({file:relative,...meta,bytes:Buffer.byteLength(contents)});
}
async function vector(relative,w,h,label,body,meta={},extra='') {
  const value=svg(w,h,label,body,extra);await save(relative,value,{format:'svg',width:w,height:h,...meta,gzipBytes:gzipSync(value).length});return value;
}
async function png(relative,source,width,height,meta={}) {
  const intrinsicWidth=Number(source.match(/<svg[^>]*\bwidth="(\d+)"/)[1]);
  let pipeline=sharp(Buffer.from(source),{density:Math.max(96,Math.min(2400,Math.ceil(width/intrinsicWidth*72)))}).resize(width,height,{fit:'fill'});
  if(meta.transparent===false) pipeline=pipeline.flatten({background:meta.theme ? variants[meta.theme].bg : '#E8E9E1'});
  const image=await pipeline.png({compressionLevel:9}).toBuffer();
  await save(relative,image,{format:'png',width,height,...meta});
}
const masters = {};
for (const [theme,p] of Object.entries(variants)) {
  const definitions = [
    ['icon',104,104,mark(p)],
    ['icon-small',32,32,mark(p,{small:true})],
    ['logo-horizontal',480,128,horizontal(p)],
    ['logo-stacked',360,200,stacked(p)],
    ['logo-vertical',320,384,vertical(p)],
    ['wordmark',540,100,textPath('Code Station',16,14,508,72,p.ink)],
    ['wordmark-stacked',320,220,stackedWords(p,24,28,272,72,28)],
    ['icon-monochrome',104,104,mark(p,{mono:true})],
  ];
  for (const [name,w,h,body] of definitions) {
    masters[`${name}-${theme}`]=await vector(`svg/${name}-${theme}.svg`,w,h,`${title(name)} / ${theme} artwork`,body,{theme,transparent:true,use:name});
  }
  const app=`<rect width="512" height="512" fill="${p.bg}"/>${placedMark(p,64,64,384)}`;
  const mask=`<rect width="512" height="512" fill="${p.bg}"/>${placedMark(p,112,112,288)}`;
  masters[`app-icon-${theme}`]=await vector(`svg/app-icon-${theme}.svg`,512,512,`App icon / ${theme} artwork`,app,{theme,transparent:false,use:'app icon'},'Opaque platform tile. The brace mark matches the site logo.');
  masters[`maskable-icon-${theme}`]=await vector(`svg/maskable-icon-${theme}.svg`,512,512,`Maskable icon / ${theme} artwork`,mask,{theme,transparent:false,use:'maskable icon'},'Full-bleed tile. Entire foreground is inside the central 80 percent safe circle.');
  const socialDefs=[['social-landscape',1200,630,`<g transform="translate(168 200) scale(1.8)">${horizontal(p)}</g>`],['social-square',1080,1080,`<g transform="translate(172 98) scale(2.3)">${vertical(p)}</g>`],['social-header',1500,500,`<g transform="translate(270 122) scale(2)">${horizontal(p)}</g>`]];
  for(const [name,w,h,body] of socialDefs){
    const source=await vector(`svg/${name}-${theme}.svg`,w,h,`${title(name)} / ${theme} artwork`,`<rect width="${w}" height="${h}" fill="${p.bg}"/>${body}`,{theme,transparent:false,use:name},'Presentation canvas with the Code Station logo only.');
    await png(`social/${name}-${theme}-${w}x${h}.png`,source,w,h,{theme,transparent:false,use:name});
  }
  for(const size of [16,20,24,32,40,48,64,96,128,144,152,180,192,256,384,512,1024]){
    const source=masters[`${size<=48?'icon-small':'icon'}-${theme}`];
    await png(`icons/icon-${theme}-${size}.png`,source,size,size,{theme,transparent:true,use:size<=48?'favicon / small UI':'icon / avatar'});
  }
  for(const size of [120,152,167,180])await png(`platform/apple-touch-icon-${theme}-${size}.png`,masters[`app-icon-${theme}`],size,size,{theme,transparent:false,use:'Apple touch icon'});
  for(const size of [192,512]){
    await png(`platform/android-chrome-${theme}-${size}.png`,masters[`app-icon-${theme}`],size,size,{theme,transparent:false,use:'PWA any'});
    await png(`platform/maskable-icon-${theme}-${size}.png`,masters[`maskable-icon-${theme}`],size,size,{theme,transparent:false,use:'PWA maskable'});
  }
  for(const name of ['logo-horizontal','logo-stacked','logo-vertical','wordmark','wordmark-stacked']){
    const item=assets.find(a=>a.file===`svg/${name}-${theme}.svg`);
    for(const multiplier of [1,2,3])await png(`png/${name}-${theme}@${multiplier}x.png`,masters[`${name}-${theme}`],item.width*multiplier,item.height*multiplier,{theme,transparent:true,use:'presentations / email / documents'});
  }
  // ICO container: transparent PNG frames, supported by current Windows/browser consumers.
  const sizes=[16,32,48], buffers=await Promise.all(sizes.map(size=>readFile(join(root,`icons/icon-${theme}-${size}.png`))));
  const header=Buffer.alloc(6+16*sizes.length);header.writeUInt16LE(1,2);header.writeUInt16LE(sizes.length,4);let offset=header.length;
  buffers.forEach((buffer,i)=>{const pos=6+i*16;header[pos]=sizes[i];header[pos+1]=sizes[i];header.writeUInt16LE(1,pos+4);header.writeUInt16LE(32,pos+6);header.writeUInt32LE(buffer.length,pos+8);header.writeUInt32LE(offset,pos+12);offset+=buffer.length;});
  await save(`favicon/favicon-${theme}.ico`,Buffer.concat([header,...buffers]),{format:'ico',theme,sizes,transparent:true,use:'favicon fallback'});
}
const adaptive={ink:'var(--ink)',dots:['var(--dot1)','var(--dot2)','var(--dot3)']};
const adaptiveStyle='<style>:root{--ink:#151713;--dot1:#B45309;--dot2:#147D64;--dot3:#476511}@media(prefers-color-scheme:dark){:root{--ink:#F6F5F1;--dot1:#FBBF24;--dot2:#6EE7B7;--dot3:#D9F975}}</style>';
await vector('favicon/favicon-adaptive.svg',32,32,'Adaptive favicon',adaptiveStyle+mark(adaptive,{small:true}),{theme:'adaptive',transparent:true,use:'automatic browser theme'},'Transparent icon that changes artwork color with the browser color-scheme preference.');
await vector('favicon/safari-pinned-tab.svg',32,32,'Monochrome pinned-tab icon',mark({ink:'#000000',dots:[]},{small:true,mono:true}),{theme:'monochrome',transparent:true,use:'Safari mask icon'});
const previews = [
 ['icon','Icon / favicon',104,104],['logo-horizontal','One-line lockup',480,128],['logo-stacked','Two-line lockup',360,200],['wordmark','Text only',540,100],['logo-vertical','Vertical lockup',320,384],['wordmark-stacked','Stacked text',320,220]
];
let board='<rect width="1440" height="1640" fill="#E8E9E1"/><g font-family="Arial,sans-serif"><text x="56" y="60" fill="#151713" font-size="28" font-weight="700">Code Station · Brand assets</text><text x="56" y="92" fill="#596153" font-size="16">Transparent master artwork. Preview surfaces are not part of the logos.</text></g>';
previews.forEach(([name,label,w,h],row)=>{
 for(const [column,theme] of ['dark','light'].entries()){
  const p=variants[theme],x=40+column*700,y=120+row*248;
  const scale=Math.min(560/w,154/h),px=x+320-w*scale/2,py=y+74+(154-h*scale)/2;
  const source=masters[`${name}-${theme}`].replace(/^.*?<desc[^>]*>.*?<\/desc>/s,'').replace(/<\/svg>\s*$/,'');
  board+=`<rect x="${x}" y="${y}" width="660" height="230" rx="12" fill="${p.bg}"/><text x="${x+24}" y="${y+34}" fill="${p.ink}" font-family="Arial,sans-serif" font-size="15">${label} · ${theme} artwork</text><g transform="translate(${fmt(px)} ${fmt(py)}) scale(${fmt(scale)})">${source}</g>`;
 }
});
const boardSvg=svg(1440,1640,'Brand overview',board, 'Contact sheet of dark and light artwork; colored panels are preview surfaces only.');
await save('brand-overview.svg',boardSvg,{format:'svg',width:1440,height:1640,use:'contact sheet',transparent:false});
await png('brand-overview.png',boardSvg,1440,1640,{use:'contact sheet',transparent:false});
const manifest={version:1,brand:'Code Station',naming:'dark = charcoal artwork for light backgrounds; light = ivory artwork for dark backgrounds',themes:variants,assets};
await writeFile(join(root,'asset-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
const readme=`# Code Station brand kit\n\nDark means charcoal artwork for a light background. Light means ivory artwork for a dark background. The primary SVGs and transparent PNGs have no background, including inside the icon frame.\n\n## Requested SVG masters\n\n- svg/icon-{dark,light}.svg: icon only, 104×104 viewBox.\n- svg/icon-small-{dark,light}.svg: optically simplified 32×32 icon for 16–48px use.\n- svg/logo-horizontal-{dark,light}.svg: logo + Code Station on one line, 480×128.\n- svg/logo-stacked-{dark,light}.svg: logo beside Code / Station on two lines, 360×200.\n- svg/wordmark-{dark,light}.svg: text only, 540×100.\n\nAdditional SVGs: centered vertical lockup, stacked text, monochrome icon, opaque app tile, maskable tile and three social canvases. All lettering is path artwork; no fonts, external images or scripts are required. SVGs scale to any size. Preserve aspect ratio and do not stretch.\n\n## Raster and platform sizes\n\n- Transparent PNG icons: 16, 20, 24, 32, 40, 48, 64, 96, 128, 144, 152, 180, 192, 256, 384, 512 and 1024px.\n- PNG wordmarks/lockups: native SVG size at 1×, 2× and 3×. Use these for email and systems that do not support SVG.\n- ICO fallback: 16/32/48px frames, one file per color variant.\n- Adaptive SVG favicon follows browser light/dark preference. Safari pinned-tab icon is monochrome.\n- Apple touch icons: opaque 120/152/167/180px.\n- PWA/Android: opaque 192/512px and separate maskable 192/512px. Maskable foreground fits within the central 80% safe circle.\n- Social: landscape 1200×630, square 1080×1080, header 1500×500. Their backgrounds are intentional; unlike the core logo assets, these canvases are opaque.\n\nUse the appropriate variant for background contrast. Keep at least one brace-width of clear space outside the supplied artwork. Use the compact icon below 48px; use the horizontal lockup at 180px wide or larger. Monochrome artwork is available for stamps, engraving and single-ink applications. SVG is vector artwork for print; final CMYK, bleed and substrate requirements belong to your printer. No one finite icon set guarantees every platform specification.\n\n## Integration example\n\nThe kit is available at /brand/. This task creates assets; it does not replace the existing header, favicon configuration or web app manifest.\n\n\u0060\u0060\u0060html\n<link rel="icon" type="image/svg+xml" href="/brand/favicon/favicon-adaptive.svg">\n<link rel="icon" sizes="32x32" type="image/png" href="/brand/icons/icon-dark-32.png">\n<link rel="apple-touch-icon" sizes="180x180" href="/brand/platform/apple-touch-icon-light-180.png">\n<link rel="mask-icon" href="/brand/favicon/safari-pinned-tab.svg" color="#151713">\n\u0060\u0060\u0060\n\nThe SVG uses fixed colors, not theme-dependent page CSS. For an image over a dark page choose a -light filename. For Android/PWA use purpose:any with android-chrome files and purpose:maskable only with maskable files. Avoid transparent touch icons on platforms requiring an opaque background.\n\n## Source and reproduction\n\nThe rounded brace frame, slight tilt and three indicator dots are derived from components/StationMark.tsx and app/globals.css. Palette variants follow the actual site tokens. Wordmark outlines preserve the site's Arial Bold lettering and -0.035em tracking; braces preserve its monospace treatment. The compact icon reduces optical detail but retains frame/braces/three dots.\n\nFixed phrase outlines are stored in source/wordmark-outlines.json; no font software is distributed. Run node scripts/generate-brand-assets.mjs from the project to reproduce all assets and the ZIP using the already installed sharp and fflate packages. This needs no network, font installation or new runtime dependency. The generation script is also included as source/generate-brand-assets.mjs in this download; use it from the project scripts directory.\n\nSee asset-manifest.json for exact names, dimensions, transparency and measured byte counts. Open index.html for a downloadable visual catalogue.\n`;
await writeFile(join(root,'README.md'),readme);
const cards=previews.map(([name,label])=>`<section><h2>${label}</h2><div class="pair">${Object.entries(variants).map(([theme])=>`<figure class="${theme}"><div><img src="svg/${name}-${theme}.svg" alt="Code Station ${label}, ${theme} artwork"></div><figcaption><a download href="svg/${name}-${theme}.svg">Download ${theme} SVG ↓</a></figcaption></figure>`).join('')}</div></section>`).join('');
const smallPreview=`<section><h2>Small-size icon checks</h2><div class="pair">${Object.keys(variants).map(theme=>`<figure class="${theme}"><div style="display:flex;gap:24px;align-items:center;justify-content:center">${[16,24,32,48].map(size=>`<img width="${size}" height="${size}" src="icons/icon-${theme}-${size}.png" alt="${size}px ${theme} icon">`).join('')}</div><figcaption>16 / 24 / 32 / 48px · ${theme} artwork</figcaption></figure>`).join('')}</div></section>`;
const table=assets.filter(a=>a.file!=='brand-overview.png'&&a.file!=='brand-overview.svg').map(a=>`<tr><td><a download href="${a.file}">${a.file}</a></td><td>${a.width?`${a.width} × ${a.height}`:a.sizes?.join(' / ')}</td><td>${a.transparent?'Transparent':'Opaque'}</td><td>${a.bytes.toLocaleString()} B</td></tr>`).join('');
await writeFile(join(root,'index.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Code Station — Brand kit</title><style>*{box-sizing:border-box}body{font:16px Arial,Helvetica,sans-serif;margin:0;background:#F6F5F1;color:#151713}main{max-width:1180px;margin:auto;padding:48px 24px}h1{font-size:clamp(36px,6vw,64px);letter-spacing:-.045em;margin:20px 0}h2{font-size:24px;letter-spacing:-.025em;margin:40px 0 16px}p{max-width:760px;line-height:1.6}a{color:inherit;text-underline-offset:4px}.download{display:inline-block;background:#D9F975;color:#151713;padding:15px 22px;border-radius:8px;font-weight:bold;margin:12px 12px 12px 0}.pair{display:grid;grid-template-columns:1fr 1fr;gap:20px}figure{margin:0;border:1px solid #b7bcaf;border-radius:12px;overflow:hidden}figure.dark{background:#fff;color:#151713}figure.light{background:#151713;color:#F6F5F1}figure>div{height:210px;display:grid;place-items:center;padding:32px;background-image:linear-gradient(45deg,#8881 25%,transparent 25%),linear-gradient(-45deg,#8881 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#8881 75%),linear-gradient(-45deg,transparent 75%,#8881 75%);background-size:16px 16px;background-position:0 0,0 8px,8px -8px,-8px 0}img{max-width:100%;max-height:155px;display:block}figcaption{padding:16px 20px;border-top:1px solid #b7bcaf44}.table{overflow:auto}table{border-collapse:collapse;width:100%;font-size:13px}td,th{padding:12px 8px;border-bottom:1px solid #d3d6ca;text-align:left}small{color:#596153}@media(max-width:640px){.pair{grid-template-columns:1fr}main{padding:24px 16px}figure>div{height:190px}}</style><main><small>[ CODE STATION / BRAND KIT ]</small><h1>One identity.<br>Every placement.</h1><p>Dark artwork for light surfaces. Light artwork for dark surfaces. All core SVGs and PNG lockups have transparent backgrounds and outlined lettering. The checkerboard is only a preview surface.</p><a class="download" download href="code-station-brand-kit.zip">Download the complete kit ↓</a><a href="README.md">Usage guide</a>${cards}${smallPreview}<section><h2>Favicons, app icons and social sizes</h2><p>The full kit includes compact icons, transparent PNGs, ICO files, an adaptive favicon, Safari mask icon, opaque Apple/PWA icons, maskable icons and social canvases.</p><div class="table"><table><thead><tr><th>Download</th><th>Size</th><th>Canvas</th><th>Bytes</th></tr></thead><tbody>${table}</tbody></table></div></section></main></html>`);
await writeFile(join(root,'source/generate-brand-assets.mjs'),await readFile(fileURLToPath(import.meta.url)));
const archive={};
async function collect(dir,prefix='') {for(const item of await readdir(dir,{withFileTypes:true})){const rel=prefix+item.name;if(item.isDirectory())await collect(join(dir,item.name),rel+'/');else if(!rel.endsWith('.zip'))archive[`code-station-brand-kit/${rel}`]=new Uint8Array(await readFile(join(dir,item.name)));}}
await collect(root);await writeFile(join(root,'code-station-brand-kit.zip'),zipSync(archive,{level:9}));
console.log(JSON.stringify({assets:assets.length,svg:assets.filter(a=>a.format==='svg').length,png:assets.filter(a=>a.format==='png').length,ico:assets.filter(a=>a.format==='ico').length,zipBytes:(await stat(join(root,'code-station-brand-kit.zip'))).size,masterSvgGzip:assets.filter(a=>a.file.startsWith('svg/')).reduce((sum,a)=>sum+(a.gzipBytes??0),0)},null,2));
