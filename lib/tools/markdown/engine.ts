import { parse as parseYaml } from "yaml";
import { MarkdownError, type MarkdownResult, type MarkdownValues } from "./types";

const LIMIT = 200_000;
const text = (v: unknown, field: string): string => { if (typeof v !== "string") throw new MarkdownError(`Enter ${field}.`, field); if (v.length > LIMIT) throw new MarkdownError("Input exceeds the 200,000-character limit.", field); return v; };
const esc = (v: string) => v.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const url = (v: string) => /^(?:https?:|mailto:|#|\/)/i.test(v) && !/^(?:javascript|data|vbscript):/i.test(v) ? v : "#";
function inline(source: string): string {
  const stash: string[] = []; const hold = (s: string) => { stash.push(s); return `\u0000${stash.length-1}\u0000`; };
  let s = esc(source);
  s = s.replace(/!\[([^\]]*)\]\((\S+?)(?:\s+["']([^"']*)["'])?\)/g, (_, a, u, t) => hold(`<img alt="${a}" src="${esc(url(u))}"${t ? ` title="${esc(t)}"` : ""}>`));
  s = s.replace(/\[([^\]]+)\]\((\S+?)(?:\s+["']([^"']*)["'])?\)/g, (_, a, u, t) => hold(`<a href="${esc(url(u))}"${t ? ` title="${esc(t)}"` : ""}>${a}</a>`));
  s = s.replace(/&lt;(https?:\/\/[^&]+)&gt;/g, (_, u) => hold(`<a href="${esc(url(u))}">${esc(u)}</a>`));
  s = s.replace(/`([^`\n]+)`/g, (_, x) => hold(`<code>${x}</code>`));
  s = s.replace(/\*\*([^*]+)\*\*/g,"<strong>$1</strong>").replace(/__([^_]+)__/g,"<strong>$1</strong>").replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g,"<em>$1</em>").replace(/(?<!_)_([^_\n]+)_(?!_)/g,"<em>$1</em>");
  return s.replace(/\u0000(\d+)\u0000/g, (_, n) => stash[Number(n)]);
}
function markdownHtml(md: string): string {
  const lines = md.replace(/\r\n?/g,"\n").split("\n"), out: string[] = []; let i=0, list:"ul"|"ol"|null=null;
  const close = () => { if (list) { out.push(`</${list}>`); list=null; } };
  while (i < lines.length) { const line=lines[i]; if (!line.trim()) { close(); i++; continue; }
    if (/^```/.test(line.trim())) { close(); const lang=line.trim().slice(3).trim(); const body:string[]=[]; i++; while(i<lines.length&&!/^```/.test(lines[i].trim())) body.push(lines[i++]); if(i<lines.length)i++; out.push(`<pre><code${lang?` class="language-${esc(lang)}`:""}>${esc(body.join("\n"))}</code></pre>`); continue; }
    const h=/^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line); if(h){close(); const n=h[1].length; out.push(`<h${n}>${inline(h[2])}</h${n}>`);i++;continue;}
    const li=/^\s*([-+*]|\d+\.)\s+(.*)$/.exec(line); if(li){const next=li[1].endsWith(".")?"ol":"ul"; if(list!==next){close();out.push(`<${next}>`);list=next;} const checked=li[2].startsWith("[x] ")||li[2].startsWith("[X] "); const item=li[2].replace(/^\[[ xX]\]\s*/,""); out.push(`<li>${checked?"☑ ":""}${inline(item)}</li>`);i++;continue;}
    if(/^>\s?/.test(line)){close(); const q:string[]=[]; while(i<lines.length&&/^>\s?/.test(lines[i]))q.push(lines[i++].replace(/^>\s?/,""));out.push(`<blockquote><p>${inline(q.join("\n"))}</p></blockquote>`);continue;}
    if(/^\|/.test(line)&&i+1<lines.length&&/^\s*\|?\s*:?-{3,}/.test(lines[i+1])){close(); const row=(x:string)=>x.trim().replace(/^\||\|$/g,"").split("|").map(c=>c.trim()); const heads=row(line); i+=2; const body:string[][]=[]; while(i<lines.length&&/^\|/.test(lines[i]))body.push(row(lines[i++])); out.push(`<table><thead><tr>${heads.map(x=>`<th>${inline(x)}</th>`).join("")}</tr></thead><tbody>${body.map(r=>`<tr>${heads.map((_,j)=>`<td>${inline(r[j]??"")}</td>`).join("")}</tr>`).join("")}</tbody></table>`);continue;}
    close(); const para=[line]; i++; while(i<lines.length&&lines[i].trim()&&!/^(#{1,6})\s|^```|^\s*[-+*]\s|^\s*\d+\.\s|^>|^\|/.test(lines[i]))para.push(lines[i++]); out.push(`<p>${inline(para.join("\n"))}</p>`);
  } close(); return out.join("\n");
}
const sanitize = (html: string) => html.replace(/<\/?(?:script|style|iframe|object|embed|template|form|base)[^>]*>/gi,"").replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,"").replace(/\s+(href|src)\s*=\s*("|')\s*(?:javascript|data|vbscript):[^"']*\2/gi," $1=\"#\"");
const stripUnsafeRaw = (source: string) => source.replace(/<(script|style|iframe|object|embed|template|form|base)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "").replace(/<\/?(?:script|style|iframe|object|embed|template|form|base)\b[^>]*>/gi, "").replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
function slug(s:string){return s.toLowerCase().trim().replace(/<[^>]*>/g,"").replace(/[^\p{L}\p{N}\s-]/gu,"").replace(/\s+/g,"-")||"section";}
function rows(source:string){return source.replace(/\r\n?/g,"\n").split("\n").filter(Boolean).map(x=>x.split(",").map(v=>v.trim().replace(/^"|"$/g,"")));}
function table(values:MarkdownValues){const columns=text(values.columns,"column names").split(",").map(x=>x.trim()), data=rows(text(values.rows,"rows")), aligns=Array.isArray(values.alignment)?values.alignment as string[]:[]; const cell=(x:string)=>x.replace(/\|/g,"\\|").replace(/\n/g,"<br>"); const rule=columns.map((_,i)=>aligns[i]==="Center"?":---:":aligns[i]==="Right"?"---:":"---").join(" | "); return `| ${columns.map(cell).join(" | ")} |\n| ${rule} |\n${data.map(r=>`| ${columns.map((_,i)=>cell(r[i]??"")).join(" | ")} |`).join("\n")}`;}
export async function runMarkdown(id:string, values:MarkdownValues):Promise<MarkdownResult>{
  let source="";
  if(id==="markdown-table-generator") return {text:table(values),data:{}};
  if(id==="markdown-task-list-generator"){const items=rows(text(values.items,"task items"));return {text:items.map(r=>`- [${r[1]==="true"||r[1]==="x"?"x":" "}] ${r[0]??""}`).join("\n"),data:{}};}
  if(id==="markdown-blockquote-generator")return {text:text(values.text,"text").split(/\r?\n/).map(x=>`> ${x}`).join("\n"),data:{}};
  if(id==="markdown-code-block-generator"){const code=text(values.code,"code"),lang=typeof values.language==="string"?values.language.trim():""; const max=Math.max(3,...(code.match(/`+/g)||[]).map(x=>x.length+1));return {text:`${"`".repeat(max)}${lang}\n${code}\n${"`".repeat(max)}`,data:{}};}
  if(id==="markdown-list-generator"){const items=rows(text(values.items,"list items")).map(x=>x[0]??"");return {text:items.map((x,i)=>`${values.listType==="Ordered"?`${i+1}.`:"-"} ${x}`).join("\n"),data:{}};}
  source=text(values.source ?? values.markdown ?? values.html ?? values.csv,"source");
  if(id==="markdown-formatter"){const out=source.replace(/\r\n?/g,"\n").split("\n").map(x=>x.trimEnd()).join("\n").replace(/\n{3,}/g,"\n\n").trim();return {text:out,data:{}};}
  if(id==="markdown-preview"||id==="markdown-to-html"){const safeSource=stripUnsafeRaw(source),html=sanitize(markdownHtml(safeSource));return {text:html,data:{html}};}
  if(id==="html-to-markdown"){const clean=sanitize(source).replace(/<br\s*\/?>(\n)?/gi,"\n").replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi,(_,n,x)=>`${"#".repeat(Number(n))} ${x.replace(/<[^>]*>/g,"")}\n\n`).replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi,"**$1**").replace(/<em[^>]*>([\s\S]*?)<\/em>/gi,"*$1*").replace(/<p[^>]*>([\s\S]*?)<\/p>/gi,"$1\n\n").replace(/<li[^>]*>([\s\S]*?)<\/li>/gi,"- $1\n").replace(/<[^>]*>/g,"");return {text:clean.trim(),data:{}};}
  if(id==="csv-to-markdown-table")return {text:table({columns:rows(source)[0]?.join(",")??"",rows:rows(source).slice(1).map(r=>r.join(",")).join("\n")}),data:{}};
  if(id==="markdown-to-text"){return {text:source.replace(/```[\w-]*\n?/g,"").replace(/!\[([^\]]*)\]\([^)]*\)/g,"$1").replace(/\[([^\]]+)\]\([^)]*\)/g,"$1").replace(/^#{1,6}\s+/gm,"").replace(/[>*_`~]/g,"").replace(/^\s*[-+]\s+/gm,"• "),data:{}};}
  if(id==="markdown-escape")return {text:source.replace(/[\\`*_[\]{}<>#+.!|()-]/g,"\\$&"),data:{}};
  if(id==="markdown-link-extractor"||id==="markdown-image-extractor"){const image=id.includes("image"), re=image?/!\[([^\]]*)\]\((\S+?)(?:\s+["']([^"']*)["'])?\)/g:/\[([^\]]+)\]\((\S+?)(?:\s+["']([^"']*)["'])?\)|<(https?:\/\/[^>]+)>/g;const result:string[][]=[];let m:RegExpExecArray|null;while((m=re.exec(source)))result.push(image?[m[1],m[2],m[3]??""]:[m[1]??m[4],m[2]??m[4],m[3]??""]);return {text:result.map(r=>r.join("\t")).join("\n"),data:{links:result,count:result.length}};}
  if(id==="markdown-heading-analyzer"||id==="markdown-toc-generator"){const hs=[...source.matchAll(/^(#{1,6})\s+(.+)$/gm)].map(m=>({level:m[1].length,text:m[2].trim().replace(/\s+#*$/,""),slug:slug(m[2])}));if(id.endsWith("analyzer")){const warnings:string[]=[];if(hs.filter(x=>x.level===1).length>1)warnings.push("Multiple H1 headings are informational guidance, not invalid Markdown.");for(let i=1;i<hs.length;i++)if(hs[i].level>hs[i-1].level+1)warnings.push(`Heading level skips from H${hs[i-1].level} to H${hs[i].level}.`);return {text:JSON.stringify(hs,null,2),data:{headings:hs,count:hs.length,warnings}};}const min=Number(values.minLevel??1),max=Number(values.maxLevel??6),used=new Map<string,number>();const out=hs.filter(x=>x.level>=min&&x.level<=max).map(x=>{const n=(used.get(x.slug)||0)+1;used.set(x.slug,n);return `${"  ".repeat(Math.max(0,x.level-min))}- [${x.text}](#${x.slug}${n>1?`-${n}`:""})`;});return {text:out.join("\n"),data:{headings:hs}};}
  if(id==="markdown-frontmatter-parser"){if(!/^---\s*\n/.test(source))return {text:"",data:{frontmatter:null,body:source}};const end=source.indexOf("\n---",4);if(end<0)throw new MarkdownError("Frontmatter is not closed.","source");let front:unknown;try{front=parseYaml(source.slice(4,end))}catch{throw new MarkdownError("Frontmatter YAML is malformed.","source");}return {text:JSON.stringify({frontmatter:front,body:source.slice(end+4).replace(/^\n/,"")},null,2),data:{frontmatter:front,body:source.slice(end+4).replace(/^\n/,"")}};}
  if(id==="markdown-statistics"){const html=markdownHtml(source);return {text:JSON.stringify({characterCount:source.length,wordCount:(source.match(/[\p{L}\p{N}]+/gu)||[]).length,lineCount:source?source.split(/\r\n?|\n/).length:0,headingCount:(source.match(/^#{1,6}\s/gm)||[]).length,linkCount:(source.match(/\[[^\]]+\]\([^)]*\)/g)||[]).length,imageCount:(source.match(/!\[[^\]]*\]\([^)]*\)/g)||[]).length,codeBlockCount:(source.match(/^```/gm)||[]).length/2,listItemCount:(source.match(/^\s*(?:[-+*]|\d+\.)\s/gm)||[]).length},null,2),data:{}};}
  throw new MarkdownError("Unsupported Markdown tool.");
}
