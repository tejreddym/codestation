import { localDefinition, type LocalField, type LocalDefinition } from "./local-contract";

export const policyToolIds = [
  "privacy-policy-generator",
  "terms-and-conditions-generator",
  "cookie-policy-generator",
  "disclaimer-generator",
  "refund-policy-generator",
] as const;

export type PolicyToolId = (typeof policyToolIds)[number];

const notice =
  "100% in-browser legal policy generation. Business details, policy clauses, and export formatting run entirely in client memory with zero server uploads or external tracking.";

const define = (
  id: PolicyToolId,
  title: string,
  fields: LocalField[],
  outputs: string[],
  defaults: Record<string, unknown> = {},
  extra: string[] = [],
  action = "Generate"
): LocalDefinition<PolicyToolId> =>
  localDefinition(
    id,
    title,
    "Policy Generators",
    fields,
    outputs,
    defaults,
    [notice, ...extra],
    action
  );

export const policyTools: readonly LocalDefinition<PolicyToolId>[] = [
  define(
    "privacy-policy-generator",
    "Privacy Policy Generator",
    [
      { name: "companyName", label: "Company or Project Name", control: "text" },
      { name: "websiteUrl", label: "Website URL", control: "text" },
      { name: "contactEmail", label: "Contact / Privacy Email", control: "text" },
      { name: "effectiveDate", label: "Effective Date (YYYY-MM-DD)", control: "text", optional: true },
      { name: "country", label: "Governing Country", control: "text", optional: true },
      { name: "stateOrProvince", label: "State or Province", control: "text", optional: true },
      { name: "industryPreset", label: "Industry Preset", control: "select", options: ["SaaS / Cloud Software", "E-Commerce / Retail", "Content & Media Blog", "Mobile App / iOS / Android"] },
      { name: "format", label: "Default Export Format", control: "select", options: ["markdown", "html", "text", "json"] },
    ],
    [
      "Formatted Privacy Policy",
      "Markdown (.md) Export",
      "HTML (.html) Export",
      "Plain Text (.txt) Export",
      "Structured JSON AST",
    ],
    {
      companyName: "Acme Software, Inc.",
      websiteUrl: "https://example.com",
      contactEmail: "privacy@example.com",
      industryPreset: "SaaS / Cloud Software",
      format: "markdown",
    },
    [
      "Generate comprehensive, GDPR, CCPA/CPRA, and CalOPPA compliant privacy policies with custom clauses for cookies, analytics, payment gateways, and data retention.",
    ]
  ),
  define(
    "terms-and-conditions-generator",
    "Terms and Conditions Generator",
    [
      { name: "companyName", label: "Company or Entity Name", control: "text" },
      { name: "websiteUrl", label: "Website / Service URL", control: "text" },
      { name: "contactEmail", label: "Support / Legal Email", control: "text" },
      { name: "effectiveDate", label: "Effective Date (YYYY-MM-DD)", control: "text", optional: true },
      { name: "country", label: "Governing Jurisdiction (Country)", control: "text", optional: true },
      { name: "industryPreset", label: "Industry Preset", control: "select", options: ["SaaS / Cloud Software", "E-Commerce / Retail", "Content & Media Blog", "Mobile App / iOS / Android"] },
      { name: "format", label: "Default Export Format", control: "select", options: ["markdown", "html", "text", "json"] },
    ],
    [
      "Formatted Terms & Conditions",
      "Markdown (.md) Export",
      "HTML (.html) Export",
      "Plain Text (.txt) Export",
      "Structured JSON AST",
    ],
    {
      companyName: "Acme Software, Inc.",
      websiteUrl: "https://example.com",
      contactEmail: "legal@example.com",
      industryPreset: "SaaS / Cloud Software",
      format: "markdown",
    },
    [
      "Generate robust Terms of Service and End-User License Agreements covering intellectual property, user accounts, arbitration, limitation of liability, and DMCA notices.",
    ]
  ),
  define(
    "cookie-policy-generator",
    "Cookie Policy Generator",
    [
      { name: "companyName", label: "Company or Entity Name", control: "text" },
      { name: "websiteUrl", label: "Website URL", control: "text" },
      { name: "contactEmail", label: "Privacy Email", control: "text" },
      { name: "effectiveDate", label: "Effective Date (YYYY-MM-DD)", control: "text", optional: true },
      { name: "industryPreset", label: "Industry Preset", control: "select", options: ["SaaS / Cloud Software", "E-Commerce / Retail", "Content & Media Blog", "Mobile App / iOS / Android"] },
      { name: "format", label: "Default Export Format", control: "select", options: ["markdown", "html", "text", "json"] },
    ],
    [
      "Formatted Cookie Policy",
      "Cookie Inventory Table",
      "Markdown (.md) Export",
      "HTML (.html) Export",
      "Plain Text (.txt) Export",
    ],
    {
      companyName: "Acme Software, Inc.",
      websiteUrl: "https://example.com",
      contactEmail: "privacy@example.com",
      industryPreset: "SaaS / Cloud Software",
      format: "markdown",
    },
    [
      "Generate EU ePrivacy Directive and GDPR compliant cookie disclosures with 4 cookie classification pillars, third-party tracker inventories, and multi-browser management instructions.",
    ]
  ),
  define(
    "disclaimer-generator",
    "Legal & Professional Disclaimer Generator",
    [
      { name: "companyName", label: "Company or Entity Name", control: "text" },
      { name: "websiteUrl", label: "Website URL", control: "text" },
      { name: "contactEmail", label: "Contact Email", control: "text" },
      { name: "effectiveDate", label: "Effective Date (YYYY-MM-DD)", control: "text", optional: true },
      { name: "industryPreset", label: "Industry Preset", control: "select", options: ["SaaS / Cloud Software", "E-Commerce / Retail", "Content & Media Blog", "Mobile App / iOS / Android"] },
      { name: "format", label: "Default Export Format", control: "select", options: ["markdown", "html", "text", "json"] },
    ],
    [
      "Formatted Disclaimer",
      "Markdown (.md) Export",
      "HTML (.html) Export",
      "Plain Text (.txt) Export",
      "Structured JSON AST",
    ],
    {
      companyName: "Acme Software, Inc.",
      websiteUrl: "https://example.com",
      contactEmail: "legal@example.com",
      industryPreset: "Content & Media Blog",
      format: "markdown",
    },
    [
      "Generate clear disclaimers for professional advice (legal, financial, medical), FTC affiliate links, Amazon Associates disclosures, and external link liabilities.",
    ]
  ),
  define(
    "refund-policy-generator",
    "Refund & Cancellation Policy Generator",
    [
      { name: "companyName", label: "Company or Merchant Name", control: "text" },
      { name: "websiteUrl", label: "Store or Service URL", control: "text" },
      { name: "contactEmail", label: "Returns / Support Email", control: "text" },
      { name: "effectiveDate", label: "Effective Date (YYYY-MM-DD)", control: "text", optional: true },
      { name: "industryPreset", label: "Industry Preset", control: "select", options: ["SaaS / Cloud Software", "E-Commerce / Retail", "Content & Media Blog", "Mobile App / iOS / Android"] },
      { name: "format", label: "Default Export Format", control: "select", options: ["markdown", "html", "text", "json"] },
    ],
    [
      "Formatted Refund Policy",
      "Markdown (.md) Export",
      "HTML (.html) Export",
      "Plain Text (.txt) Export",
      "Structured JSON AST",
    ],
    {
      companyName: "Acme Commerce, Inc.",
      websiteUrl: "https://example.com",
      contactEmail: "support@example.com",
      industryPreset: "E-Commerce / Retail",
      format: "markdown",
    },
    [
      "Generate comprehensive refund and cancellation policies covering return timeframes, physical goods conditions, digital download waivers, restocking fees, and subscription cancellations.",
    ]
  ),
];

export const getPolicyDefinition = (id: string): LocalDefinition<PolicyToolId> | undefined =>
  policyTools.find((tool) => tool.id === id);

export const isPolicyToolId = (id: string): id is PolicyToolId =>
  (policyToolIds as readonly string[]).includes(id);
