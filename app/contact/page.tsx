import Link from "next/link";
import {
  InformationalPage,
  informationalStyles,
} from "@/components/InformationalPage";
import { metadataForPage } from "@/config/site";
import { operatorMetadata } from "@/lib/legal/operator";

export const metadata = metadataForPage(
  "/contact",
  "Contact & Support",
  "Support channels, bug reports, tool requests, and private security disclosure for Code Station.",
);

export default function ContactPage() {
  return (
    <InformationalPage
      title="Contact & Support"
      intro="Reach the Code Station maintainers for support, bug reports, new tool proposals, or private vulnerability disclosure."
    >
      {operatorMetadata.hasPendingFields && (
        <p className={informationalStyles.notice}>
          {operatorMetadata.provisionalNotice}
        </p>
      )}

      <h2>General Support &amp; Pro Licensing</h2>
      <p>
        For questions, general feedback, or Code Station Pro license key
        recovery (please include your Razorpay Payment ID or order receipt),
        contact{" "}
        <a href={`mailto:${operatorMetadata.supportEmail}`}>
          {operatorMetadata.supportEmail}
        </a>{" "}
        or compose a local diagnostic draft on our{" "}
        <Link href="/feedback">Feedback page</Link>.
      </p>

      <h2>Bug Reports &amp; Tool Requests</h2>
      <ul>
        <li>
          <strong>Report a Bug:</strong> Open a structured report on GitHub via
          the{" "}
          <a
            href={operatorMetadata.github.bugReportUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Bug Report template
          </a>
          . Please avoid pasting sensitive credentials or private files into
          public issues.
        </li>
        <li>
          <strong>Propose a New Tool:</strong> Request a new browser-local
          utility via the{" "}
          <a
            href={operatorMetadata.github.toolRequestUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Tool Request template
          </a>
          .
        </li>
      </ul>

      <h2>Security Vulnerability Disclosure</h2>
      <p>
        <strong>
          Do not open public GitHub issues for security vulnerabilities.
        </strong>{" "}
        Report suspected vulnerabilities privately via{" "}
        <a
          href={operatorMetadata.github.securityAdvisoryUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub Security Advisories
        </a>{" "}
        or email{" "}
        <a href={`mailto:${operatorMetadata.securityEmail}`}>
          {operatorMetadata.securityEmail}
        </a>
        .
      </p>

      <h2>Operator Details</h2>
      <ul>
        <li>
          <strong>Operator:</strong> {operatorMetadata.operatorName}
        </li>
        <li>
          <strong>Entity Type:</strong> {operatorMetadata.entityType}
        </li>
        <li>
          <strong>Jurisdiction:</strong> {operatorMetadata.jurisdiction}
        </li>
        <li>
          <strong>Repository:</strong>{" "}
          <a
            href={operatorMetadata.github.repositoryUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {operatorMetadata.github.repositoryUrl}
          </a>
        </li>
      </ul>
    </InformationalPage>
  );
}
