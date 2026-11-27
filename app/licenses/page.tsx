import Link from "next/link";
import {
  InformationalPage,
  informationalStyles,
} from "@/components/InformationalPage";
import { metadataForPage } from "@/config/site";
import { operatorMetadata } from "@/lib/legal/operator";

export const metadata = metadataForPage(
  "/licenses",
  "Licenses and Notices",
  "Repository license, third-party software notices, and asset provenance for Code Station.",
);

export default function LicensesPage() {
  return (
    <InformationalPage
      title="Licenses and Notices"
      intro="Code Station includes open-source project code, third-party dependencies, and presentation assets."
    >
      {operatorMetadata.hasPendingFields && (
        <p className={informationalStyles.notice}>
          {operatorMetadata.provisionalNotice}
        </p>
      )}
      <h2>Repository License</h2>
      <p>
        Code Station source code is licensed under the{" "}
        <a
          href={operatorMetadata.licenses.repositoryLicenseUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          {operatorMetadata.licenses.repositoryLicenseName}
        </a>
        . Operated by {operatorMetadata.operatorName}.
      </p>
      <h2>Third-party software</h2>
      <p>
        The build-generated{" "}
        <a href={operatorMetadata.licenses.thirdPartyNoticesPath}>
          third-party notice artifact
        </a>{" "}
        preserves discovered license texts for the installed production
        dependency closure. It is generated from <code>package-lock.json</code>{" "}
        and installed package license files by <code>npm run generate:notices</code>{" "}
        (<code>scripts/generate-third-party-notices.mjs</code>). License labels
        without corresponding text are recorded as unresolved rather than
        treated as sufficient notice.
      </p>
      <h2>Assets and provenance</h2>
      <p>
        {operatorMetadata.licenses.assetProvenanceNote} Questions regarding
        attribution or asset rights can be sent to{" "}
        <a href={`mailto:${operatorMetadata.supportEmail}`}>
          {operatorMetadata.supportEmail}
        </a>{" "}
        or via <Link href="/contact">Contact &amp; Support</Link>.
      </p>
      <h2>Maintenance</h2>
      <p>
        Regenerate the artifact automatically on build (<code>npm run build</code>{" "}
        / <code>npm run generate:notices</code>) after dependency changes and
        review missing-license entries before a production release.
      </p>
    </InformationalPage>
  );
}
