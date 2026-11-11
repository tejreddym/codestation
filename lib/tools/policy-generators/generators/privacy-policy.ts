/**
 * Privacy Policy Generator Engine
 * GDPR, CCPA/CPRA, CalOPPA, and COPPA compliant policy generator.
 * Code Station — Browser-Native Developer Tools
 */

import { cleanPositiveNumber, cleanStr } from "../serializers";
import {
  PolicyDocument,
  PolicyMetadata,
  PolicySection,
  PolicySubsection,
  PolicyTable,
  PrivacyPolicyOptions,
} from "../types";

export function generatePrivacyPolicy(
  rawOptions: Record<string, unknown> = {}
): PolicyDocument {
  const opts = rawOptions as PrivacyPolicyOptions;

  const today = new Date().toISOString().split("T")[0];
  const companyName = cleanStr(opts.companyName, "[Company Name]");
  const appName = cleanStr(opts.appName, opts.companyName ? String(opts.companyName) : "[Application Name]");
  const websiteUrl = cleanStr(opts.websiteUrl, "[https://example.com]");
  const contactEmail = cleanStr(opts.contactEmail, "[privacy@example.com]");
  const physicalAddress = cleanStr(opts.physicalAddress, "[Company Address]");
  const country = cleanStr(opts.country, "[Country]");
  const stateOrProvince = cleanStr(opts.stateOrProvince, "[State/Province]");
  const effectiveDate = cleanStr(opts.effectiveDate, today);
  const lastUpdatedDate = cleanStr(opts.lastUpdatedDate, effectiveDate);
  const dpoEmail = cleanStr(opts.dpoEmail, contactEmail);
  const minimumAge = cleanPositiveNumber(opts.minimumAge, 13);

  const metadata: PolicyMetadata = {
    toolId: "privacy-policy-generator",
    title: "Privacy Policy",
    companyName,
    appName,
    websiteUrl,
    contactEmail,
    physicalAddress,
    country,
    stateOrProvince,
    effectiveDate,
    lastUpdatedDate,
  };

  const sections: PolicySection[] = [];

  // ==========================================================================
  // Section 1: Introduction and Scope
  // ==========================================================================
  sections.push({
    id: "introduction",
    title: "Introduction and Scope",
    paragraphs: [
      `This Privacy Policy explains how ${companyName} ("we", "us", or "our") collects, uses, discloses, and safeguards personal information when you visit or interact with ${websiteUrl} or utilize ${appName} (collectively, the "Services").`,
      `We are committed to maintaining the confidentiality, integrity, and security of your personal data. Please read this Privacy Policy carefully. If you do not agree with the terms of this Privacy Policy, please discontinue access and use of our Services immediately.`,
    ],
    callout: {
      type: "legal",
      title: "Consent and Agreement",
      text: `By accessing, browsing, or using our Services, you acknowledge that you have read, understood, and agree to be bound by the data handling practices described in this Privacy Policy.`,
    },
  });

  // ==========================================================================
  // Section 2: Information We Collect
  // ==========================================================================
  const collectedCategories = Array.isArray(opts.collectedCategories) && opts.collectedCategories.length > 0
    ? opts.collectedCategories
    : ["personal_identity", "account_credentials", "device_telemetry", "usage_activity"];

  const providedInfoBullets: string[] = [];
  if (collectedCategories.includes("personal_identity")) {
    providedInfoBullets.push("Personal Identifiers: Full name, email address, postal address, and telephone number.");
  }
  if (collectedCategories.includes("account_credentials")) {
    providedInfoBullets.push("Account Credentials: Usernames, encrypted passwords, authentication tokens, and security challenge responses.");
  }
  if (collectedCategories.includes("financial_payment")) {
    providedInfoBullets.push("Billing & Payment Information: Billing address, invoice history, and tokenized payment identifiers processed via PCI-DSS compliant payment gateways.");
  }
  if (collectedCategories.includes("communications")) {
    providedInfoBullets.push("Communications: Inquiries, customer support tickets, survey responses, and feedback submitted directly to us.");
  }
  if (collectedCategories.includes("user_content")) {
    providedInfoBullets.push("User-Generated Content: Profile data, text posts, files, images, or documents you upload to the Services.");
  }
  if (providedInfoBullets.length === 0) {
    providedInfoBullets.push("Contact and account identifiers submitted voluntarily when registering or communicating with us.");
  }

  const automatedInfoBullets: string[] = [
    "Device Telemetry: Operating system version, browser family, screen resolution, device brand/model, and unique hardware identifiers.",
    "Log & Network Data: Internet Protocol (IP) address, referring URL, pages viewed, time stamps, access frequency, and clickstream navigation patterns.",
  ];
  if (collectedCategories.includes("geolocation")) {
    automatedInfoBullets.push("Location Information: Approximate geographic location derived from IP address (city, state, country).");
  }

  const subsections2: PolicySubsection[] = [
    {
      id: "information-provided",
      title: "Information Provided Voluntarily by You",
      paragraphs: [
        "We collect personal information that you intentionally provide when registering for an account, subscribing to features, completing web forms, or communicating with customer care.",
      ],
      bulletPoints: providedInfoBullets,
    },
    {
      id: "information-automated",
      title: "Information Collected Automatically",
      paragraphs: [
        "When you navigate or interact with our Services, our servers and automated telemetry tools record technical connection data:",
      ],
      bulletPoints: automatedInfoBullets,
    },
  ];

  // Sensitive data statement
  if (opts.collectsSensitiveData && Array.isArray(opts.sensitiveDataCategories) && opts.sensitiveDataCategories.length > 0) {
    subsections2.push({
      id: "sensitive-data",
      title: "Sensitive Personal Information",
      paragraphs: [
        `We collect specific categories of sensitive personal data with your explicit consent or where required by law: ${opts.sensitiveDataCategories.join(", ")}. We apply enhanced cryptographic controls, access restrictions, and strict retention limits to sensitive data.`,
      ],
    });
  } else {
    subsections2.push({
      id: "sensitive-data",
      title: "Sensitive Personal Information",
      paragraphs: [
        "We do not intentionally collect or process sensitive personal data such as biometric identifiers, genetic information, health or medical records, racial or ethnic origins, religious or political beliefs, or government identification numbers.",
      ],
    });
  }

  sections.push({
    id: "information-collected",
    title: "Information We Collect",
    subsections: subsections2,
  });

  // ==========================================================================
  // Section 3: How We Use Information & Lawful Bases (GDPR Article 6)
  // ==========================================================================
  const legalBasesTable: PolicyTable = {
    caption: "Purposes of Processing and GDPR Lawful Bases (Art. 6)",
    headers: ["Purpose of Processing", "Data Categories Involved", "Lawful Basis (GDPR Art. 6)"],
    rows: [
      [
        "Delivering core application functionality, account authentication, and customer service",
        "Personal Identifiers, Account Credentials",
        "Performance of a Contract (Art. 6(1)(b))",
      ],
      [
        "Processing subscription payments, billing invoices, and tax compliance",
        "Billing Information, Transaction Logs",
        "Contractual Necessity & Legal Obligation (Art. 6(1)(c))",
      ],
      [
        "Platform security, intrusion prevention, bot detection, and bug diagnosis",
        "Device Telemetry, Network Logs, IP Addresses",
        "Legitimate Interests (Art. 6(1)(f))",
      ],
      [
        "Sending transactional notifications, service updates, and operational notices",
        "Contact Email, Personal Identifiers",
        "Performance of a Contract (Art. 6(1)(b))",
      ],
      [
        "Optional marketing newsletters, product feature surveys, and promotional announcements",
        "Contact Email, Stored Preferences",
        "Consent (Art. 6(1)(a))",
      ],
    ],
  };

  sections.push({
    id: "how-we-use-information",
    title: "How We Use Information and Lawful Bases for Processing",
    paragraphs: [
      `Under European data protection laws (including the General Data Protection Regulation / Regulation (EU) 2016/679 and UK Data Protection Act 2018), ${companyName} processes personal information only when an established lawful basis applies.`,
    ],
    table: legalBasesTable,
  });

  // ==========================================================================
  // Section 4: Cookies and Automated Tracking Technologies
  // ==========================================================================
  if (opts.usesCookies !== false) {
    const cookieBullets = [
      "Strictly Necessary: Essential for cryptographic security, authenticated sessions, and core platform delivery.",
      "Analytics & Performance: Measuring visitor traffic, page load performance, error diagnostics, and feature adoption.",
      "Functional: Remembering user preferences such as theme, layout, and language selections.",
    ];
    if (opts.hasAdvertising) {
      cookieBullets.push("Advertising & Targeting: Delivering personalized promotional campaigns and tracking conversion efficacy across partner networks.");
    }

    sections.push({
      id: "cookies-tracking",
      title: "Cookies and Automated Tracking Technologies",
      paragraphs: [
        `Our Services utilize HTTP cookies, web beacons, and browser local storage to maintain session states and analyze platform performance.`,
      ],
      bulletPoints: cookieBullets,
      subsections: [
        {
          id: "dnt-gpc-signals",
          title: "Browser Privacy Signals (Do Not Track & Global Privacy Control)",
          paragraphs: [
            `While our Services do not alter standard responses to legacy browser "Do Not Track" (DNT) header signals due to absence of a unified industry standard, we fully recognize and honor valid Global Privacy Control (GPC) opt-out signals transmitted by supported browsers in compliance with applicable consumer privacy regulations.`,
          ],
        },
      ],
    });
  }

  // ==========================================================================
  // Section 5: Third-Party Disclosures & Service Providers
  // ==========================================================================
  const thirdParties = Array.isArray(opts.thirdPartyServices) && opts.thirdPartyServices.length > 0
    ? opts.thirdPartyServices
    : ["AWS / Cloud Infrastructure", "Stripe (Payment Processing)", "Cloudflare (Security & CDN)", "Google Analytics"];

  sections.push({
    id: "third-party-disclosures",
    title: "Third-Party Service Providers and Disclosures",
    paragraphs: [
      `We do not sell your personal data. We disclose personal information only to trusted third-party service providers bound by Data Processing Agreements (DPAs) requiring adherence to strict confidentiality and security standards.`,
      `Categories of service providers engaged by ${companyName} include:`,
    ],
    bulletPoints: thirdParties.map((tp) => `Service Partner: ${tp}`),
    callout: {
      type: "note",
      title: "Payment Card Security",
      text: "All payment card transactions are processed directly by PCI-DSS Level 1 certified payment processors (such as Stripe). We do not store or transmit raw credit card numbers or security CVV codes across our internal systems.",
    },
  });

  // ==========================================================================
  // Section 6: International Data Transfers
  // ==========================================================================
  if (opts.internationalTransfers !== false) {
    sections.push({
      id: "international-transfers",
      title: "International Data Transfers",
      paragraphs: [
        `Personal information collected by ${companyName} may be stored and processed in ${country} or any other jurisdiction where we or our third-party infrastructure partners maintain server operations.`,
        `When transferring personal data from the European Economic Area (EEA), the United Kingdom, or Switzerland to countries not recognized as providing an adequate level of data protection, we implement appropriate contractual safeguards, including standard contractual clauses (SCCs) approved by the European Commission (Implementing Decision (EU) 2021/914) or adherence to the EU-U.S. Data Privacy Framework (DPF).`,
      ],
    });
  }

  // ==========================================================================
  // Section 7: Data Retention and Security Measures
  // ==========================================================================
  const retentionText = cleanStr(
    opts.retentionDescription,
    `We retain your personal data only for as long as necessary to fulfill the purposes outlined in this Privacy Policy, including satisfying any legal, accounting, tax, or reporting requirements. Account data is retained for the duration of your active account plus 30 days following an account deletion request.`
  );

  const securityBullets = Array.isArray(opts.securityMeasures) && opts.securityMeasures.length > 0
    ? opts.securityMeasures
    : [
        "Transport Layer Security (TLS 1.3) cryptographic transit encryption for all public API and web traffic.",
        "Advanced Encryption Standard (AES-256) data encryption at rest for database volumes and backup snapshots.",
        "Role-Based Access Control (RBAC) restricting data access to authorized personnel with a legitimate business need.",
        "Multi-Factor Authentication (MFA) required across all internal corporate and administrative infrastructure.",
        "Routine vulnerability assessments, dependency scanning, and automated patch management.",
      ];

  sections.push({
    id: "data-retention-security",
    title: "Data Retention and Information Security",
    paragraphs: [retentionText],
    bulletPoints: securityBullets,
  });

  // ==========================================================================
  // Section 8: Your Privacy Rights
  // ==========================================================================
  const rightsSubsections: PolicySubsection[] = [];

  // GDPR Rights
  rightsSubsections.push({
    id: "gdpr-rights",
    title: "European Economic Area (EEA) and UK Data Subject Rights",
    paragraphs: [
      `If you reside within the European Union, European Economic Area, or United Kingdom, you possess the following statutory rights under GDPR Articles 15 through 22:`,
    ],
    bulletPoints: [
      "Right of Access (Art. 15): Request confirmation of processing and obtain a copy of your personal data.",
      "Right to Rectification (Art. 16): Request correction of inaccurate, incomplete, or outdated personal data.",
      "Right to Erasure / 'Right to Be Forgotten' (Art. 17): Request permanent deletion of personal data where retention is no longer justified.",
      "Right to Restriction of Processing (Art. 18): Request suspension of data processing under contested accuracy or legality.",
      "Right to Data Portability (Art. 20): Receive personal information in a structured, commonly used, and machine-readable format.",
      "Right to Object (Art. 21): Object to processing based on legitimate interests or direct marketing at any time.",
      "Right to Lodge a Complaint (Art. 77): Lodge a complaint with a supervisory data protection authority in your EU member state.",
    ],
  });

  // CCPA / CPRA Rights
  if (opts.includeCcpa !== false) {
    const ccpaBullets: string[] = [
      "Right to Know: Request disclosure of categories and specific pieces of personal information collected in the preceding 12 months.",
      "Right to Delete: Request deletion of personal information collected directly from you, subject to statutory exceptions.",
      "Right to Correct: Request correction of inaccurate personal data maintained in our records.",
      "Right to Non-Discrimination: We will never deny services, charge different prices, or provide an altered service level for exercising your privacy rights.",
    ];

    if (opts.sellsOrSharesData) {
      ccpaBullets.push("Right to Opt-Out of Sale or Sharing: You may opt out of the sale or cross-context behavioral sharing of personal data by utilizing our 'Do Not Sell or Share My Personal Information' web link or enabling GPC signals.");
    } else {
      ccpaBullets.push("Notice of No Sale or Sharing: We do not sell your personal information, nor do we share your personal data with third parties for cross-context behavioral advertising.");
    }

    rightsSubsections.push({
      id: "california-rights",
      title: "California Consumer Privacy Disclosures (CCPA / CPRA)",
      paragraphs: [
        `Under the California Consumer Privacy Act of 2018 as amended by the California Privacy Rights Act of 2020 (CCPA / CPRA), California residents are entitled to specific statutory disclosures and consumer rights:`,
      ],
      bulletPoints: ccpaBullets,
    });
  }

  sections.push({
    id: "privacy-rights",
    title: "Your Statutory Privacy Rights",
    paragraphs: [
      `Depending on your geographic location and applicable local privacy statutes, you may exercise specific rights regarding your personal information by contacting us at ${contactEmail}. We will verify your identity and respond within the statutory timeframe (typically 30 days under GDPR, 45 days under CCPA).`,
    ],
    subsections: rightsSubsections,
  });

  // ==========================================================================
  // Section 9: Children's Online Privacy Protection (COPPA)
  // ==========================================================================
  if (opts.targetAudience === "under13") {
    sections.push({
      id: "childrens-privacy",
      title: "Children's Privacy (COPPA Compliance)",
      paragraphs: [
        `Our Services provide educational features that may be accessed by children under 13. In accordance with the Children's Online Privacy Protection Act (COPPA), we require verifiable parental consent prior to collecting personal data from children under 13. Parents and legal guardians retain the right to review, update, or request immediate deletion of their child's records by contacting us at ${contactEmail}.`,
      ],
    });
  } else {
    sections.push({
      id: "childrens-privacy",
      title: "Children's Privacy Protection",
      paragraphs: [
        `Our Services are not directed to individuals under the age of ${minimumAge}. We do not knowingly solicit or collect personal information from children under ${minimumAge}. If we learn that personal data of a minor under ${minimumAge} has been collected without verified parental consent, we will take immediate steps to permanently purge such data from our databases.`,
        `If you are a parent or legal guardian and believe that your child has submitted personal information to us without consent, please contact us immediately at ${contactEmail}.`,
      ],
    });
  }

  // ==========================================================================
  // Section 10: Policy Updates
  // ==========================================================================
  sections.push({
    id: "policy-updates",
    title: "Changes to This Privacy Policy",
    paragraphs: [
      `We may update this Privacy Policy periodically to reflect changes in our operational practices, regulatory mandates, or legal obligations. When material updates are made, we will notify you by updating the "Last Updated" date at the top of this policy and, where appropriate, displaying a prominent notice within our application or sending an email notification.`,
      `Your continued access or use of our Services following the posting of an updated Privacy Policy constitutes your acceptance of the revised practices.`,
    ],
  });

  // ==========================================================================
  // Section 11: Contact Information & DPO
  // ==========================================================================
  const contactBullets: string[] = [
    `Organization: ${companyName}`,
    `Website: ${websiteUrl}`,
    `Privacy Inquiries Email: ${contactEmail}`,
  ];
  if (opts.dpoName || opts.dpoEmail) {
    contactBullets.push(`Data Protection Officer (DPO): ${cleanStr(opts.dpoName, "Data Protection Office")} (${dpoEmail})`);
  }
  if (opts.euRepresentative) {
    contactBullets.push(`EU Privacy Representative: ${cleanStr(opts.euRepresentative, "[EU Representative Name]")}`);
  }
  if (physicalAddress !== "[Company Address]") {
    contactBullets.push(`Mailing Address: ${physicalAddress}`);
  }

  sections.push({
    id: "contact-information",
    title: "Contact Information and Data Protection Officer",
    paragraphs: [
      `If you have questions, comments, or wish to exercise any statutory rights regarding this Privacy Policy, please contact our data protection team:`,
    ],
    bulletPoints: contactBullets,
  });

  return {
    id: "privacy-policy",
    title: "Privacy Policy",
    metadata,
    sections,
  };
}
