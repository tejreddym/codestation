import { localDefinition, type LocalDefinition, type LocalField } from "./local-contract";
export const markdownToolIds=["markdown-formatter","markdown-preview","markdown-table-generator","markdown-toc-generator","markdown-to-html","html-to-markdown","csv-to-markdown-table","markdown-to-text","markdown-escape","markdown-link-extractor","markdown-image-extractor","markdown-heading-analyzer","markdown-frontmatter-parser","markdown-task-list-generator","markdown-blockquote-generator","markdown-code-block-generator","markdown-list-generator","markdown-statistics"] as const;
export type MarkdownToolId=typeof markdownToolIds[number];
const md:LocalField={name:"source",label:"Markdown text",control:"textarea"}; const html:LocalField={name:"html",label:"HTML text",control:"textarea"}; const text:LocalField={name:"text",label:"Text",control:"textarea"};
const define=(id:MarkdownToolId,name:string,fields:LocalField[],outputs:string[],defaults:Record<string,unknown>={},action="Process",paired?:MarkdownToolId):LocalDefinition<MarkdownToolId>=>localDefinition(id,name,"Markdown",fields,outputs,defaults,["All processing is local. Preview and generated HTML are sanitized inert text; scripts, event handlers and unsafe URLs are not executed."],action,paired);
export const markdownTools:readonly LocalDefinition<MarkdownToolId>[]=[
 define("markdown-formatter","Markdown Formatter",[md],["Formatted Markdown"],{},"Format"),
 define("markdown-preview","Markdown Preview",[md],["Rendered preview"],{},"Preview"),
 define("markdown-table-generator","Markdown Table Generator",[{name:"columns",label:"Column names",control:"text"},{name:"rows",label:"Rows",control:"textarea"},{name:"alignment",label:"Alignment",control:"text"}],["Markdown table"],{alignment:[]},"Generate"),
 define("markdown-toc-generator","Markdown TOC Generator",[md,{name:"minLevel",label:"Minimum heading level",control:"number",min:1,max:6},{name:"maxLevel",label:"Maximum heading level",control:"number",min:1,max:6}],["Markdown table of contents","Heading hierarchy"],{minLevel:"1",maxLevel:"6"},"Generate"),
 define("markdown-to-html","Markdown to HTML",[md],["Sanitized HTML source"],{},"Convert","html-to-markdown"),
 define("html-to-markdown","HTML to Markdown",[html],["Markdown"],{},"Convert","markdown-to-html"),
 define("csv-to-markdown-table","CSV to Markdown Table",[{name:"csv",label:"CSV text",control:"textarea"}],["Markdown table"],{},"Convert"),
 define("markdown-to-text","Markdown to Plain Text",[md],["Plain text"],{},"Convert"),
 define("markdown-escape","Markdown Escaper",[{name:"source",label:"Plain text",control:"textarea"}],["Markdown-escaped text"],{},"Escape"),
 define("markdown-link-extractor","Markdown Link Extractor",[md],["Link text","URL","Link count"],{},"Extract"),
 define("markdown-image-extractor","Markdown Image Extractor",[md],["Alt text","Image URL","Title","Image count"],{},"Extract"),
 define("markdown-heading-analyzer","Markdown Heading Analyzer",[md],["Heading hierarchy","Heading count","Heading-level warnings"],{},"Analyze"),
 define("markdown-frontmatter-parser","Markdown Frontmatter Parser",[md],["Parsed frontmatter","Markdown body"],{},"Parse"),
 define("markdown-task-list-generator","Markdown Task List Generator",[{name:"items",label:"Task items",control:"textarea"}],["Markdown checklist"],{},"Generate"),
 define("markdown-blockquote-generator","Markdown Blockquote Generator",[text],["Markdown blockquote"],{},"Generate"),
 define("markdown-code-block-generator","Markdown Code Block Generator",[{name:"code",label:"Code",control:"textarea"},{name:"language",label:"Language",control:"text",optional:true}],["Fenced Markdown code block"],{},"Generate"),
 define("markdown-list-generator","Markdown List Generator",[{name:"items",label:"List items",control:"textarea"},{name:"listType",label:"List type",control:"select",options:["Unordered","Ordered"]}],["Markdown list"],{listType:"Unordered"},"Generate"),
 define("markdown-statistics","Markdown Statistics",[md],["Character count","Word count","Line count","Heading count","Link count","Image count","Code block count","List item count"],{},"Analyze")
];
export const getMarkdownDefinition=(id:string)=>markdownTools.find(x=>x.id===id); export const isMarkdownToolId=(id:string):id is MarkdownToolId=>(markdownToolIds as readonly string[]).includes(id);
