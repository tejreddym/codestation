import { FavoriteButton } from "@/components/PersonalTools";
import ToolHelp from "@/components/ToolHelp";
import StationMark from "@/components/StationMark";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTool, tools } from "@/config/tools";
import { getJsonDataDefinition } from "@/config/json-data-tools";
import ToolWorkspace from "@/components/ToolWorkspace";
import { getImageDefinition } from "@/config/image-tools";
import { getStationByName } from "@/config/stations";
import { metadataForRoute } from "@/config/site";
import { JsonLd } from "@/components/StructuredData";
import BannerAd from "@/components/BannerAd";
import { ProGate } from "@/components/ProGate";

export function generateStaticParams() { return tools.map((tool) => ({ slug: tool.slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tool = getTool(slug);
  if (!tool) return {};
  const title = tool.localContract || tool.securityContract || tool.regexContract || tool.dateTimeContract || tool.textContract || tool.cronContract || tool.sqlContract || tool.webContract || tool.apiContract ? tool.seo?.title ?? tool.name : tool.name;
  return metadataForRoute(`/tools/${tool.slug}`, title, tool.description);
}

export default async function ToolPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tool = getTool(slug);
  if (!tool) notFound();
  const local = tool.localContract ?? getImageDefinition(tool.id)?.localContract;
  return <main className="shell">
    <JsonLd schema={{
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: tool.name,
      description: tool.description,
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Any",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" }
    } as any} />
    <section className="tool-page workspace-page">
    <nav className="crumb" aria-label="Breadcrumb"><Link href="/">Home</Link><span aria-hidden="true"> / </span><Link href="/tools">Tools</Link><span aria-hidden="true"> / </span><Link href={tool.localContract ? getStationByName(tool.category)!.route : tool.apiContract ? "/stations/api" : tool.webContract ? "/stations/web" : `/tools?category=${encodeURIComponent(tool.category)}`}>{tool.category}</Link><span aria-hidden="true"> / </span><Link href={`/tools/${tool.slug}`} aria-current="page">{tool.name}</Link></nav>
    <div className="workspace-heading"><div><div className="eyebrow"><span className="bracket-label">{tool.category}</span></div>
    <h1>{tool.name}</h1><p className="lead">{tool.description}</p></div><span className="workspace-symbol" aria-hidden="true"><StationMark large label={tool.category} /></span></div>
    <div className="tool-utility-bar"><FavoriteButton slug={tool.slug} /><span>Keep this tool in your workbench</span><Link href={`/feedback?tool=${tool.slug}`}>Report a problem</Link></div>
    <ProGate toolId={tool.id} toolName={tool.name}>
      <ToolWorkspace toolId={tool.id} />
    </ProGate>
    <div style={{ display: "flex", flexWrap: "wrap", gap: "32px", alignItems: "flex-start", marginTop: "32px" }}>
      <div style={{ flex: "1 1 0%", minWidth: "min(100%, 600px)" }}>
        <ToolHelp tool={tool} />
        {local ? <div className="content"><p><Link href={getStationByName(tool.category)?.route ?? "/stations/image"}>Browse the {tool.category} station →</Link>{tool.id === "favicon-generator" && <> · <Link href="/stations/image">Browse the Image station →</Link></>}</p><h2>What does this tool do?</h2><p>{local.purpose} Inputs: {local.fields.map(field => field.label).join(", ")}. Outputs: {local.outputs.join(", ")}.</p><h2>How to use it?</h2><p>{local.usage}</p><p>{tool.category === "Markdown" ? "Browser-local processing; preview image URLs may be requested by the browser. Generated markup is sanitized inert text and inputs are not persisted or logged." : "Browser-local processing. No uploads, content logging, persistence or remote resource loading. Generated markup is inert text; files are treated as untrusted data."}</p>{local.notices.map(notice => <p key={notice}>{notice}</p>)}<nav aria-label="Related tools"><h2>Related tools</h2><ul>{(tool.relatedTools ?? []).map(getTool).filter(tool => !!tool).map(tool => <li key={tool.id}><Link href={`/tools/${tool.slug}`}>{tool.name}</Link></li>)}</ul></nav></div> : tool.apiContract ? <div className="content">
          <p><Link href="/stations/api">Browse the API station →</Link></p>
          <h2>What does this tool do?</h2><p>{tool.apiContract.purpose} Inputs: {tool.apiContract.fields.map(field => field.label).join(", ")}. Outputs: {tool.apiContract.outputs.join(", ")}.</p>
          <h2>How to use it?</h2><p>{tool.apiContract.usage}</p>
          <p>{tool.apiContract.sendsRequest ? "This tool sends a request only on Send Request, directly from your browser. It cannot bypass CORS or browser security; response content is displayed as text. No request or response data is saved or sent to analytics." : "All processing is local. This tool does not send network requests, execute cURL, evaluate JavaScript or run GraphQL operations. Generated code and response markup are inert text. Inputs are not logged, saved or added to the route."}</p>
          {tool.apiContract.notices.map(notice => <p key={notice}>{notice}</p>)}
          <nav aria-label="Related tools"><h2>Related tools</h2><ul>{(tool.relatedTools ?? []).map(slug => getTool(slug)).filter(related => Boolean(related)).map(related => <li key={related!.slug}><Link href={`/tools/${related!.slug}`}>{related!.name}</Link></li>)}</ul></nav>
        </div> : tool.webContract ? <div className="content">
          <p><Link href="/stations/web">Browse the Web station →</Link></p>
          <h2>What does this tool do?</h2>
          <p>{tool.webContract.purpose} Inputs: {tool.webContract.fields.map(field => field.label).join(", ")}. Outputs: {tool.webContract.outputs.join(", ")}.</p>
          <h2>How to use it?</h2><p>{tool.webContract.usage}</p>
          <p>Processing is local. Entered URLs are data: they are not visited, uploaded, logged or placed in the route. Generated markup is inert text. Reference lookups use bundled data, and previews are illustrative rather than guaranteed platform output.</p>
          {tool.webContract.notices.map(notice => <p key={notice}>{notice}</p>)}
          <nav aria-label="Related tools"><h2>Related tools</h2><ul>{(tool.relatedTools ?? []).map(slug => getTool(slug)).filter(related => Boolean(related)).map(related => <li key={related!.slug}><Link href={`/tools/${related!.slug}`}>{related!.name}</Link></li>)}</ul></nav>
        </div> : tool.sqlContract ? <div className="content">
          <p><Link href="/stations/sql-database">Browse the SQL &amp; Database station →</Link></p>
          <h2>What does this tool do?</h2>
          <p>{tool.sqlContract.purpose} Inputs: {tool.sqlContract.fields.map(field => field.label).join(", ")}. Outputs: {tool.sqlContract.outputs.join(", ")}.</p>
          <h2>How to use it</h2>
          <p>{tool.sqlContract.usage}</p>
          <p>All processing is local and never executes SQL or connects to a database. Dialect-aware tools support documented subsets of PostgreSQL, MySQL, SQLite and SQL Server. INSERT extraction accepts explicit-column literal VALUES only, not arbitrary queries. Connection tools support PostgreSQL/MySQL URIs and SQL Server ADO.NET strings without testing credentials. Prefer parameterized queries or prepared statements when executing SQL in an application.</p>
          <nav aria-label="Related tools"><h2>Related tools</h2><ul>{(tool.relatedTools ?? []).map(slug => getTool(slug)).filter(related => Boolean(related)).map(related => <li key={related!.slug}><Link href={`/tools/${related!.slug}`}>{related!.name}</Link></li>)}</ul></nav>
        </div> : tool.cronContract ? <div className="content">
          <p><Link href="/stations/cron">Browse the Cron station →</Link></p>
          <h2>What does this tool do?</h2>
          <p>{tool.cronContract.purpose} Inputs: {tool.cronContract.fields.map(field => field.label).join(", ")}. Outputs: {tool.cronContract.outputs.join(", ")}.</p>
          <h2>How to use it?</h2>
          <p>{tool.cronContract.usage}</p>
          <p>Supported syntax: five-field Unix cron or the explicitly entered six-field seconds-first extension. Not a Quartz, Jenkins, AWS EventBridge or Kubernetes configuration converter. Parsing and calculation never execute jobs. Human descriptions use only the listed deterministic phrases. Next Run is bounded to eight years within 1970–2099 and uses the browser’s IANA data, skipping missing wall times and considering both repeated instants.</p>
          <nav aria-label="Related tools"><h2>Related tools</h2><ul>{(tool.relatedTools ?? []).map(slug => getTool(slug)).filter(related => Boolean(related)).map(related => <li key={related!.slug}><Link href={`/tools/${related!.slug}`}>{related!.name}</Link></li>)}</ul></nav>
        </div> : tool.textContract ? <div className="content">
          <h2>What does this tool do?</h2>
          <p>{tool.textContract.purpose} Inputs: {tool.textContract.fields.map(field => field.label).join(", ")}. Outputs: {tool.textContract.outputs.join(", ")}.</p>
          <h2>How to use it?</h2>
          <p>{tool.textContract.usage}</p>
          <nav aria-label="Related tools"><h2>Related tools</h2><ul>{(tool.relatedTools ?? []).map(slug => getTool(slug)).filter(related => Boolean(related)).map(related => <li key={related!.slug}><Link href={`/tools/${related!.slug}`}>{related!.name}</Link></li>)}</ul></nav>
        </div> : tool.dateTimeContract ? <div className="content">
          <h2>What does this tool do?</h2>
          <p>{tool.dateTimeContract.purpose} Inputs: {tool.dateTimeContract.fields.filter(field => !field.when).map(field => field.label).join(", ")}. Outputs: {tool.dateTimeContract.outputs.join(", ")}.</p>
          <h2>How to use it?</h2>
          <p>{tool.dateTimeContract.usage}</p>
          <nav aria-label="Related tools"><h2>Related tools</h2><ul>{(tool.relatedTools ?? []).map(slug => getTool(slug)).filter(related => Boolean(related)).map(related => <li key={related!.slug}><Link href={`/tools/${related!.slug}`}>{related!.name}</Link></li>)}</ul></nav>
        </div> : tool.regexContract ? <div className="content">
          <h2>What does this tool do?</h2>
          <p>{tool.regexContract.purpose} Code Station Regex tools use the JavaScript regular expression engine. Inputs: {tool.regexContract.fields.map(field => field.label).join(", ")}. Outputs: {tool.regexContract.outputs.join(", ")}.</p>
          <h2>How to use it?</h2>
          <p>{tool.regexContract.usage}</p>
          <nav aria-label="Related tools"><h2>Related tools</h2><ul>{(tool.relatedTools ?? []).map(slug => getTool(slug)).filter(related => Boolean(related)).map(related => <li key={related!.slug}><Link href={`/tools/${related!.slug}`}>{related!.name}</Link></li>)}</ul></nav>
        </div> : tool.securityContract ? <div className="content">
          <h2>What does this tool do?</h2>
          <p>{tool.securityContract.purpose} Inputs: {tool.securityContract.fields.length ? tool.securityContract.fields.map(field => field.label).join(", ") : "none"}. Outputs: {tool.securityContract.outputs.join(", ")}.</p>
          <h2>How to use it</h2>
          <p>{tool.securityContract.usage}</p>
          <nav aria-label="Related tools"><h2>Related tools</h2><ul>{(tool.relatedTools ?? []).map(slug => getTool(slug)).filter(related => Boolean(related)).map(related => <li key={related!.slug}><Link href={`/tools/${related!.slug}`}>{related!.name}</Link></li>)}</ul></nav>
        </div> : tool.encodingContract ? <div className="content">
          <h2>What does this tool do?</h2>
          <p>{tool.description} Input: {tool.encodingContract.fields.map(field => field.label).join(" and ")}. Output: {tool.encodingContract.outputLabel} ({tool.encodingContract.outputFormat}).</p>
          <h2>How to use it</h2>
          <p>Enter {tool.encodingContract.fields.map(field => field.label.toLowerCase()).join(" and ")}, then choose “{tool.encodingContract.action}”. Review the result and use Copy to copy the displayed text. Clear removes all fields and the result.</p>
          <nav aria-label="Related tools"><h2>Related tools</h2><ul>{(tool.relatedTools ?? []).map(slug => getTool(slug)).filter(related => Boolean(related)).map(related => <li key={related!.slug}><Link href={`/tools/${related!.slug}`}>{related!.name}</Link></li>)}</ul></nav>
        </div> : tool.dataContract ? <div className="content">
          <h2>What does this tool do?</h2>
          <p>{tool.description} Accepted input: {tool.dataContract.fields.map(field => field.label).join(", ")}. Output: {tool.dataContract.output.label} ({tool.outputFormat}).</p>
          <h2>How to use it</h2>
          <p>Enter {tool.dataContract.fields.map(field => field.label.toLowerCase()).join(", ")}, then choose “{tool.dataContract.action}”. Review {tool.dataContract.output.label.toLowerCase()} and use Copy{tool.dataContract.output.extension ? ` or Download .${tool.dataContract.output.extension}` : ""} if needed. Clear removes this page’s inputs and result.</p>
          <nav aria-label="Related tools"><h2>Related tools</h2><ul>{[...new Set([...(tool.pairedTool ? [getJsonDataDefinition(tool.pairedTool)?.slug] : []), ...(tool.relatedTools ?? [])])].filter((related): related is string => Boolean(related) && related !== tool.slug).map(slug => getTool(slug)).filter(related => Boolean(related)).map(related => <li key={related!.slug}><Link href={`/tools/${related!.slug}`}>{related!.name}</Link></li>)}</ul></nav>
        </div> : <div className="content"><h2>How to use {tool.name}</h2>
          <p>Choose your inputs and options, run the action, then copy or download the result where available. Code Station processes this tool in your browser; your input is not uploaded.</p>
          <h2>Privacy note</h2><p>This tool is local-first. Avoid putting secrets into URLs or sharing generated output publicly.</p>
        </div>}
      </div>
      <div style={{ flex: "none", width: "300px", position: "sticky", top: "80px" }}>
        <BannerAd size="rectangle" />
      </div>
    </div>
  </section></main>;
}
