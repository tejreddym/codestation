import Link from "next/link";
import {
  InformationalPage,
  informationalStyles,
} from "@/components/InformationalPage";
import { metadataForPage } from "@/config/site";
import { operatorMetadata } from "@/lib/legal/operator";

export const metadata = metadataForPage(
  "/terms",
  "Terms of Use",
  "Terms of use and service boundaries for Code Station.",
);

export default function TermsPage() {
  return (
    <InformationalPage
      title="Terms of Use"
      intro="These terms govern access to and use of Code Station browser utilities, local MCP tooling, and Pro licensing."
    >
      {operatorMetadata.hasPendingFields && (
        <p className={informationalStyles.notice}>
          {operatorMetadata.provisionalNotice}
        </p>
      )}
      <h2>Operator &amp; Governing Law</h2>
      <ul>
        <li>
          <strong>Operator:</strong> {operatorMetadata.operatorName} (
          {operatorMetadata.entityType})
        </li>
        <li>
          <strong>Support Contact:</strong>{" "}
          <a href={`mailto:${operatorMetadata.supportEmail}`}>
            {operatorMetadata.supportEmail}
          </a>{" "}
          (see <Link href="/contact">Contact &amp; Support</Link>)
        </li>
        <li>
          <strong>Jurisdiction:</strong> {operatorMetadata.jurisdiction}
        </li>
        <li>
          <strong>Open-Source License:</strong>{" "}
          {operatorMetadata.licenses.repositoryLicenseName}
        </li>
      </ul>
      <h2>Use of the tools</h2>
      <p>
        Use the tools lawfully and review outputs before relying on them. Tools
        may have documented limits, unsupported syntax, or heuristic results. You
        are responsible for the inputs you provide and the decisions made from
        outputs.
      </p>
      <h2>Network-aware features</h2>
      <p>
        Most tools run in the browser. The API Request Tester can send
        user-authored requests to third-party destinations, and Markdown previews
        can request remote images referenced by supplied Markdown. You are
        responsible for destination authorization, data sent to those
        destinations, and applicable terms.
      </p>
      <h2>Hosting, Availability &amp; Retention</h2>
      <p>
        {operatorMetadata.hosting.applicationRetention}{" "}
        {operatorMetadata.hosting.provider}. The application is provided on an
        &ldquo;as-is&rdquo; basis without any uptime, support, accuracy, or
        fitness guarantee. Nothing on this page is legal, security, or
        professional advice.
      </p>
    </InformationalPage>
  );
}
