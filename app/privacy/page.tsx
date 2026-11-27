import Link from "next/link";
import {
  InformationalPage,
  informationalStyles,
} from "@/components/InformationalPage";
import { metadataForPage } from "@/config/site";
import { operatorMetadata } from "@/lib/legal/operator";

export const metadata = metadataForPage(
  "/privacy",
  "Privacy Notice",
  "Privacy notice, client-side processing guarantees, and hosting/retention disclosures for Code Station.",
);

export default function PrivacyPage() {
  return (
    <InformationalPage
      title="Privacy Notice"
      intro="This notice describes data handling across Code Station tools, local preferences, and supporting server endpoints."
    >
      {operatorMetadata.hasPendingFields && (
        <p className={informationalStyles.notice}>
          {operatorMetadata.provisionalNotice}
        </p>
      )}
      <h2>Browser-local processing</h2>
      <p>
        {operatorMetadata.hosting.applicationRetention} Tool inputs and results
        stay in your browser tab. This does not restrict what an external
        hosting provider, browser, network, or third-party destination may log.
      </p>
      <h2>Hosting &amp; data retention disclosures</h2>
      <ul>
        <li>
          <strong>Hosting Provider:</strong> {operatorMetadata.hosting.provider}
        </li>
        <li>
          <strong>Pro License Storage:</strong>{" "}
          {operatorMetadata.hosting.proLicenseStorage}
        </li>
        <li>
          <strong>Checkout Processing:</strong>{" "}
          {operatorMetadata.hosting.paymentProcessor}
        </li>
        <li>
          <strong>Governing Jurisdiction:</strong>{" "}
          {operatorMetadata.jurisdiction}
        </li>
      </ul>
      <h2>Outbound requests</h2>
      <ul>
        <li>
          The API Request Tester performs an outbound request only after the
          user explicitly chooses Send Request. It uses the browser request
          path, omits ambient credentials, and is subject to the destination’s
          CORS policy.
        </li>
        <li>
          Markdown SafePreview may render an image URL from supplied Markdown. A
          remote image can therefore cause a browser request; the preview is not
          a guarantee that remote resources stay local.
        </li>
      </ul>
      <h2>Local preference</h2>
      <p>
        The illustrated theme toggle stores the selected light/dark preference
        in browser <code>localStorage</code> under{" "}
        <code>code-station-theme</code>. Tool content is not persisted on any
        server by the app. Browser history, downloads, caches, extensions,
        hosting logs, and outbound destinations are separate systems.
      </p>
      <h2>Workbench and clipboard</h2>
      <p>
        Favorites, recent tool IDs and detection preferences are stored in
        browser localStorage under <code>code-station-workbench-v1</code>. Smart
        Detection inspects clipboard text in browser memory, after browser
        permission or a manual paste. Automatic focus checks are optional. Tool
        input and results are not included in saved preferences or shared recipe
        links.
      </p>
      <h2>Offline files</h2>
      <p>
        The optional offline pack stores application code and supported page
        shells in the browser Cache API. It does not cache tool inputs, outputs,
        API requests or arbitrary browsing. Remove the pack in Settings or clear
        site data in your browser.
      </p>
      <h2>Local Engine Diagnostics</h2>
      <p>
        If a tool engine encounters an unexpected runtime or rendering crash, Code
        Station records anonymized diagnostic metadata locally in browser{" "}
        <code>localStorage</code> under{" "}
        <code>codestation-engine-diagnostics-v1</code> (capped at the last 20
        events). Entries capture only the tool slug, engine stage, sanitized
        error name/message, timestamp, and app version—redacting URLs, tokens,
        emails, file paths, and quoted payload snippets. Tool inputs and outputs
        are never recorded, and nothing is sent off-device unless you explicitly
        copy and share a bug report from the error fallback view or{" "}
        <Link href="/settings#diagnostics">Settings</Link>.
      </p>
      <h2>Analytics</h2>
      <p>
        When explicitly enabled on production deployments via{" "}
        <code>NEXT_PUBLIC_CF_WEB_ANALYTICS_TOKEN</code>, Code Station loads
        cookie-free Cloudflare Web Analytics to count aggregate pageviews and
        Web Vitals. It sets no cookies, builds no cross-site user profiles, and
        never inspects tool inputs or client URL hash fragments (
        <code>#state=</code>).
      </p>
      <h2>Feedback &amp; Privacy Inquiries</h2>
      <p>
        Operated by <strong>{operatorMetadata.operatorName}</strong> (
        {operatorMetadata.entityType}). Feedback and privacy inquiries can be
        sent to{" "}
        <a href={`mailto:${operatorMetadata.privacyEmail}`}>
          {operatorMetadata.privacyEmail}
        </a>{" "}
        or started via <Link href="/contact">Contact &amp; Support</Link>.
        Nothing is sent from feedback drafts until you submit the message in
        your mail client.
      </p>
    </InformationalPage>
  );
}
