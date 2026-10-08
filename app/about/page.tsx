import { InformationalPage } from "@/components/InformationalPage";
import { metadataForPage } from "@/config/site";

export const metadata = metadataForPage("/about", "About Code Station", "About Code Station and its browser-first developer tools.");

export default function AboutPage() {
  return <InformationalPage title="About Code Station" intro="A browser-first toolbox for everyday developer work."><p>Code Station provides focused utilities for formatting, converting, inspecting, generating, and testing technical data. The published tool contracts describe each tool’s supported inputs, outputs, and limits.</p><h2>How processing works</h2><p>Most tools process input in the browser. The API Request Tester is different: it sends a request only when its Send Request action is used, directly from the browser, subject to browser networking and CORS rules. Markdown SafePreview can render remote image URLs supplied in Markdown, so a browser may request those images while showing a preview.</p><h2>Project status</h2><p>Features and public notices are maintained as the product evolves. See the <a href="/site-directory">site directory</a>, <a href="/privacy">privacy notice</a>, and <a href="/licenses">licenses</a>.</p></InformationalPage>;
}
