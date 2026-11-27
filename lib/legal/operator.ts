/**
 * Code Station — Centralized Operator, Legal & Support Metadata
 *
 * ============================================================================
 * OWNER ACTION REQUIRED — Fields awaiting final real business / legal values:
 * ============================================================================
 * - [ ] `operatorName`: Confirm final personal or legal business name
 * - [ ] `entityType`: Confirm legal entity type (e.g., Individual / Sole Proprietorship / LLC)
 * - [ ] `jurisdiction`: Specify governing law and legal jurisdiction
 * - [ ] `hosting.retentionPolicy`: Confirm final Cloudflare / edge log retention details
 * - [ ] `licenses.themeToggleProvenance`: Confirm attribution/license for the illustrated theme toggle
 * - [ ] Verify dedicated `supportEmail` / `privacyEmail` / `securityEmail` routing mailboxes
 * ============================================================================
 */

export type LegalFieldStatus = "confirmed" | "pending_owner_confirmation";

export interface OperatorMetadata {
  readonly brandName: string;
  readonly operatorName: string;
  readonly entityType: string;
  readonly supportEmail: string;
  readonly privacyEmail: string;
  readonly securityEmail: string;
  readonly jurisdiction: string;
  readonly hasPendingFields: boolean;
  readonly pendingFieldsSummary: readonly string[];
  readonly hosting: {
    readonly provider: string;
    readonly applicationRetention: string;
    readonly proLicenseStorage: string;
    readonly paymentProcessor: string;
  };
  readonly licenses: {
    readonly repositoryLicenseName: string;
    readonly repositoryLicenseUrl: string;
    readonly thirdPartyNoticesPath: string;
    readonly assetProvenanceNote: string;
  };
  readonly github: {
    readonly repositoryUrl: string;
    readonly bugReportUrl: string;
    readonly toolRequestUrl: string;
    readonly securityAdvisoryUrl: string;
  };
  readonly provisionalNotice: string;
}

export const PENDING_OPERATOR_FIELDS = [
  "Legal operator / business entity name",
  "Entity type",
  "Governing law and jurisdiction",
  "Hosting edge-log retention period confirmation",
  "Illustrated theme toggle asset provenance",
] as const;

export const operatorMetadata: OperatorMetadata = {
  brandName: "Code Station",
  operatorName: "Tej Reddy (Pending final legal entity confirmation)",
  entityType: "Independent Developer / Individual Operator (Provisional)",
  supportEmail: "hello@codestation.in",
  privacyEmail: "hello@codestation.in",
  securityEmail: "security@codestation.in",
  jurisdiction: "Pending owner confirmation (governing law & venue)",
  hasPendingFields: true,
  pendingFieldsSummary: PENDING_OPERATOR_FIELDS,
  hosting: {
    provider: "Cloudflare Workers & static edge assets (verify account-level retention settings)",
    applicationRetention:
      "Browser-first tools run locally in memory with zero server-side input retention or app analytics.",
    proLicenseStorage:
      "Code Station Pro stores only one-way SHA-256 hashes of issued license keys (lic_*) in Cloudflare KV.",
    paymentProcessor:
      "Razorpay Standard Web Checkout handles payment processing; order and payment verification IDs are matched server-side.",
  },
  licenses: {
    repositoryLicenseName: "MIT License (Copyright (c) 2026 Tej Reddy)",
    repositoryLicenseUrl: "https://github.com/tejreddym/codestation/blob/main/LICENSE",
    thirdPartyNoticesPath: "/THIRD_PARTY_NOTICES.md",
    assetProvenanceNote:
      "The illustrated Sun/Moon theme toggle artwork is included in the repository; explicit third-party provenance/attribution must be confirmed by the owner before treating asset notices as final.",
  },
  github: {
    repositoryUrl: "https://github.com/tejreddym/codestation",
    bugReportUrl:
      "https://github.com/tejreddym/codestation/issues/new?template=bug_report.yml",
    toolRequestUrl:
      "https://github.com/tejreddym/codestation/issues/new?template=tool_request.yml",
    securityAdvisoryUrl:
      "https://github.com/tejreddym/codestation/security/advisories/new",
  },
  provisionalNotice:
    "Provisional legal metadata is active: operator entity type, governing jurisdiction, edge-log retention period, and theme-toggle provenance await final owner confirmation in lib/legal/operator.ts.",
};
