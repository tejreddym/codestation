/**
 * Cookie Policy Generator Engine
 * ePrivacy Directive (2002/58/EC), GDPR Recital 30, UK PECR, and GPC compliance.
 * Code Station — Browser-Native Developer Tools
 */

import { cleanStr } from "../serializers";
import {
  CookiePolicyOptions,
  CookieRow,
  PolicyDocument,
  PolicyMetadata,
  PolicySection,
  PolicySubsection,
  PolicyTable,
} from "../types";

export const DEFAULT_COOKIE_ROWS: CookieRow[] = [
  {
    name: "__Host-session",
    provider: "First-party",
    category: "Strictly Necessary",
    purpose: "Maintains authenticated user session token securely over HTTPS",
    duration: "Session",
    type: "HTTP Cookie",
  },
  {
    name: "csrf_token",
    provider: "First-party",
    category: "Strictly Necessary",
    purpose: "Protects against Cross-Site Request Forgery (CSRF) exploits",
    duration: "Session",
    type: "HTTP Cookie",
  },
  {
    name: "cookie_consent",
    provider: "First-party",
    category: "Strictly Necessary",
    purpose: "Records the visitor's cookie category consent preferences",
    duration: "1 Year",
    type: "Local Storage",
  },
  {
    name: "theme_preference",
    provider: "First-party",
    category: "Functional",
    purpose: "Remembers visitor UI dark or light mode color scheme preference",
    duration: "1 Year",
    type: "Local Storage",
  },
  {
    name: "_ga",
    provider: "Google LLC",
    category: "Analytics & Performance",
    purpose: "Distinguishes unique visitors for aggregated traffic analytics",
    duration: "2 Years",
    type: "HTTP Cookie",
  },
  {
    name: "_ga_*",
    provider: "Google LLC",
    category: "Analytics & Performance",
    purpose: "Maintains session state and pageview attribution in Google Analytics 4",
    duration: "1 Year",
    type: "HTTP Cookie",
  },
  {
    name: "__cf_bm",
    provider: "Cloudflare Inc.",
    category: "Strictly Necessary",
    purpose: "Identifies and mitigates malicious bot traffic and automated abuse",
    duration: "30 Minutes",
    type: "HTTP Cookie",
  },
  {
    name: "__stripe_mid",
    provider: "Stripe Inc.",
    category: "Strictly Necessary",
    purpose: "Fraud prevention and risk evaluation during checkout processing",
    duration: "1 Year",
    type: "HTTP Cookie",
  },
  {
    name: "_fbp",
    provider: "Meta Platforms Inc.",
    category: "Advertising & Targeting",
    purpose: "Tracks conversions and delivers personalized advertisements on Meta services",
    duration: "3 Months",
    type: "HTTP Cookie",
  },
];

/**
 * Detect whether a third-party tracker or vendor performs advertising, retargeting,
 * or conversion profiling.
 */
export function isAdvertisingTracker(tracker: string): boolean {
  if (!tracker || typeof tracker !== "string") return false;
  const norm = tracker.toLowerCase();
  return (
    norm.includes("meta") ||
    norm.includes("facebook") ||
    norm.includes("adwords") ||
    norm.includes("googleads") ||
    norm.includes("google-ads") ||
    norm.includes("doubleclick") ||
    norm.includes("adsense") ||
    norm.includes("adroll") ||
    norm.includes("criteo") ||
    norm.includes("tiktok") ||
    norm.includes("linkedin") ||
    norm.includes("pinterest") ||
    norm.includes("bingads") ||
    norm.includes("taboola") ||
    norm.includes("outbrain") ||
    norm.includes("retarget") ||
    norm.includes("advert")
  );
}

export function generateCookiePolicy(
  rawOptions: Record<string, unknown> = {}
): PolicyDocument {
  const opts = rawOptions as CookiePolicyOptions;

  const today = new Date().toISOString().split("T")[0];
  const companyName = cleanStr(opts.companyName, "[Company Name]");
  const appName = cleanStr(opts.appName, opts.companyName ? String(opts.companyName) : "[Application Name]");
  const websiteUrl = cleanStr(opts.websiteUrl, "[https://example.com]");
  const contactEmail = cleanStr(opts.contactEmail, "[privacy@example.com]");
  const physicalAddress = cleanStr(opts.physicalAddress, "[Company Address]");
  const effectiveDate = cleanStr(opts.effectiveDate, today);
  const lastUpdatedDate = cleanStr(opts.lastUpdatedDate, effectiveDate);
  const cookieBannerLink = cleanStr(opts.cookieBannerLink, "#cookie-settings");

  const useStrictlyNecessary = opts.useStrictlyNecessary !== false;
  const useAnalytics = opts.useAnalytics !== false;
  const useFunctional = opts.useFunctional !== false;

  // Cross-reconciliation (DEFECT-M1-05): Check if advertising trackers or custom cookies are selected
  const candidateTrackers = Array.isArray(opts.thirdPartyTrackers) && opts.thirdPartyTrackers.length > 0
    ? opts.thirdPartyTrackers
    : (Array.isArray(opts.thirdPartyServices) && opts.thirdPartyServices.length > 0
      ? opts.thirdPartyServices
      : []);

  const hasAdvertisingTrackers = candidateTrackers.some(
    (t) => typeof t === "string" && isAdvertisingTracker(t)
  );

  const hasAdvertisingCookies =
    (Array.isArray(opts.customCookieRows) &&
      opts.customCookieRows.some(
        (r) =>
          r !== null &&
          typeof r === "object" &&
          typeof (r as unknown as Record<string, unknown>).category === "string" &&
          /advert|market|target/i.test(String((r as unknown as Record<string, unknown>).category))
      )) ||
    (Array.isArray(opts.customCookies) &&
      opts.customCookies.some(
        (c) =>
          c !== null &&
          typeof c === "object" &&
          typeof (c as unknown as Record<string, unknown>).category === "string" &&
          /advert|market|target/i.test(String((c as unknown as Record<string, unknown>).category))
      ));

  // Automatically enable advertising if advertising trackers or custom advertising cookies are selected,
  // preventing internal contradiction between Section 4 ("Zero Advertising") and Section 6.
  const useAdvertising = opts.useAdvertising === true || hasAdvertisingTrackers || hasAdvertisingCookies;

  const metadata: PolicyMetadata = {
    toolId: "cookie-policy-generator",
    title: "Cookie Policy",
    companyName,
    appName,
    websiteUrl,
    contactEmail,
    physicalAddress,
    effectiveDate,
    lastUpdatedDate,
  };

  const sections: PolicySection[] = [];

  // ==========================================================================
  // Section 1: Introduction and Statutory Scope
  // ==========================================================================
  sections.push({
    id: "introduction",
    title: "Introduction and Statutory Scope",
    paragraphs: [
      `This Cookie Policy explains how ${companyName} ("we", "us", or "our") uses cookies and similar tracking technologies when you visit ${websiteUrl} or access ${appName} (collectively, the "Services").`,
      `This policy complies with European Directive 2002/58/EC on Privacy and Electronic Communications (ePrivacy Directive, as amended by Directive 2009/136/EC), Regulation (EU) 2016/679 (GDPR Recital 30 and Article 7), the UK Privacy and Electronic Communications Regulations (PECR 2003), and relevant US privacy statutes.`,
    ],
    callout: {
      type: "legal",
      title: "Your Consent Rights",
      text: "Under EU and UK data protection frameworks, we require your freely given, specific, informed, and unambiguous consent prior to depositing non-essential cookies (such as analytics, functional, or advertising cookies) on your terminal device. Strictly necessary technical cookies do not require prior consent.",
    },
  });

  // ==========================================================================
  // Section 2: What Are Cookies and Tracking Technologies?
  // ==========================================================================
  sections.push({
    id: "what-are-cookies",
    title: "What Are Cookies and Local Storage Technologies?",
    paragraphs: [
      `A cookie is a small text file containing a string of alphanumeric characters deposited onto your computer, tablet, or mobile device by a web server when you visit an online service. Cookies allow websites to recognize your web browser on subsequent visits, maintain authenticated user sessions, and store configuration preferences.`,
      `In addition to traditional HTTP cookies, our Services may utilize related browser storage technologies:`,
    ],
    bulletPoints: [
      "Session Cookies: Temporary cookies that exist only during an active browser session and are automatically deleted when you close your web browser.",
      "Persistent Cookies: Cookies that remain stored on your device for a defined retention lifespan (ranging from days to years) or until manually purged by the user.",
      "First-Party Cookies: Cookies set directly by the host domain you are visiting (e.g. directly by our Services).",
      "Third-Party Cookies: Cookies deployed by trusted external service providers (e.g., analytics engines, payment gateways, or advertising networks) through scripts embedded in our pages.",
      "HTML5 Web Storage: Local Storage and Session Storage mechanisms providing client-side key-value memory with higher capacity and improved security.",
      "Tracking Pixels / Web Beacons: Microscopic 1x1 transparent image tags or JavaScript snippets used to verify pageviews and campaign engagement.",
    ],
  });

  // ==========================================================================
  // Section 3: How We Use Cookies
  // ==========================================================================
  sections.push({
    id: "how-we-use-cookies",
    title: "How We Use Cookies",
    paragraphs: [
      `We use cookies and telemetry storage for several essential business purposes:`,
    ],
    bulletPoints: [
      "Verifying user authentication credentials and maintaining secure sessions.",
      "Protecting against Cross-Site Request Forgery (CSRF) and automated bot attacks.",
      "Remembering custom user preferences such as dark/light UI mode, volume levels, and language.",
      "Compiling aggregated, anonymized telemetry regarding page load times and error rates.",
      useAdvertising
        ? "Delivering personalized marketing content and measuring the ROI of our advertising campaigns."
        : "Measuring platform performance without cross-site behavioral tracking or profiling.",
    ],
  });

  // ==========================================================================
  // Section 4: Categories of Cookies We Deploy
  // ==========================================================================
  const categorySubsections: PolicySubsection[] = [];

  if (useStrictlyNecessary) {
    categorySubsections.push({
      id: "strictly-necessary-cookies",
      title: "Strictly Necessary / Essential Cookies",
      paragraphs: [
        "These cookies are technically indispensable to enable you to navigate the Services and use their essential features, such as accessing secure account areas, authenticating API requests, and remembering shopping cart contents.",
        "EXEMPTION FROM CONSENT: In accordance with Article 5(3) of the ePrivacy Directive, strictly necessary cookies are exempt from the requirement of prior user consent. You cannot disable these cookies through our site settings, as core functionality would cease to operate.",
      ],
    });
  }

  if (useAnalytics) {
    categorySubsections.push({
      id: "analytics-cookies",
      title: "Analytics and Performance Cookies",
      paragraphs: [
        "These cookies collect aggregated, pseudonymized information about how visitors interact with our Services—for example, which pages are visited most frequently, average time spent per page, and whether users encounter error messages. They do not store directly identifiable personal data and are used exclusively to improve how our Services function.",
      ],
    });
  }

  if (useFunctional) {
    categorySubsections.push({
      id: "functional-cookies",
      title: "Functional and Preference Cookies",
      paragraphs: [
        "These cookies allow our website to remember choices you make (such as your chosen username, interface language, or color theme) and provide enhanced, personalized features. If you reject these cookies, certain custom UI preferences will not be preserved between visits.",
      ],
    });
  }

  if (useAdvertising) {
    categorySubsections.push({
      id: "advertising-cookies",
      title: "Advertising and Marketing Cookies",
      paragraphs: [
        "These cookies track your browsing habits across different websites to build a profile of your interests and deliver advertisements that are relevant to you. They are placed by third-party advertising networks with our permission. Under the California Consumer Privacy Act (CCPA/CPRA), these cookies may constitute the 'sharing' or 'sale' of personal information for cross-context behavioral advertising.",
      ],
    });
  } else {
    categorySubsections.push({
      id: "no-advertising-cookies",
      title: "Zero Third-Party Advertising Trackers",
      paragraphs: [
        "We do not deploy third-party advertising cookies, retargeting pixels, or behavioral profiling trackers on our Services. Your browsing history is never monetized or shared with third-party ad brokers.",
      ],
    });
  }

  sections.push({
    id: "cookie-categories",
    title: "Categories of Cookies We Use",
    subsections: categorySubsections,
  });

  // ==========================================================================
  // Section 5: Detailed Cookie Inventory Table
  // ==========================================================================
  if (opts.hasCookieTable !== false) {
    let rowsToUse: CookieRow[] = [];

    // Filter defensively for non-null objects with valid cookie names (DEFECT-M1-01)
    const validCustomRows = Array.isArray(opts.customCookieRows)
      ? opts.customCookieRows.filter(
          (r): r is CookieRow =>
            r !== null &&
            typeof r === "object" &&
            typeof (r as unknown as Record<string, unknown>).name === "string" &&
            String((r as unknown as Record<string, unknown>).name).trim().length > 0
        )
      : [];

    const validCustomCookies = Array.isArray(opts.customCookies)
      ? opts.customCookies.filter(
          (c): c is NonNullable<typeof c> =>
            c !== null &&
            typeof c === "object" &&
            typeof (c as unknown as Record<string, unknown>).name === "string" &&
            String((c as unknown as Record<string, unknown>).name).trim().length > 0
        )
      : [];

    if (validCustomRows.length > 0) {
      rowsToUse = validCustomRows.map((r) => ({
        name: cleanStr(r.name, "custom_cookie"),
        provider: cleanStr(r.provider, "First-party"),
        category: cleanStr(r.category, "Functional"),
        purpose: cleanStr(r.purpose, "Operational functionality"),
        duration: cleanStr(r.duration, "Session"),
        type: cleanStr(r.type, "HTTP Cookie"),
      }));
    } else if (validCustomCookies.length > 0) {
      rowsToUse = validCustomCookies.map((c) => ({
        name: cleanStr(c.name, "custom_cookie"),
        provider: cleanStr(c.provider, "First-party"),
        category: cleanStr(c.category, "Functional"),
        purpose: cleanStr(c.purpose, "Operational functionality"),
        duration: cleanStr(c.duration, "Session"),
        type: cleanStr((c as Record<string, unknown>).type, "HTTP Cookie"),
      }));
    } else {
      // Filter default rows based on enabled categories
      rowsToUse = DEFAULT_COOKIE_ROWS.filter((r) => {
        if (r.category === "Strictly Necessary") return useStrictlyNecessary;
        if (r.category === "Analytics & Performance") return useAnalytics;
        if (r.category === "Functional") return useFunctional;
        if (r.category === "Advertising & Targeting") return useAdvertising;
        return true;
      });
    }

    const tableRows = rowsToUse.map((r) => [
      cleanStr(r?.name, "custom_cookie"),
      cleanStr(r?.provider, "First-party"),
      cleanStr(r?.category, "Functional"),
      cleanStr(r?.purpose, "Operational functionality"),
      cleanStr(r?.duration, "Session"),
      cleanStr(r?.type, "HTTP Cookie"),
    ]);

    const inventoryTable: PolicyTable = {
      caption: `Active Cookie and Storage Inventory on ${websiteUrl}`,
      headers: ["Cookie Name", "Provider", "Category", "Purpose", "Duration", "Type"],
      rows: tableRows,
    };

    sections.push({
      id: "cookie-inventory",
      title: "Detailed Cookie Inventory",
      paragraphs: [
        `The following table discloses the specific cookies and storage mechanisms deployed on ${websiteUrl}:`,
      ],
      table: inventoryTable,
    });
  }

  // ==========================================================================
  // Section 6: Third-Party Trackers & Disclosures
  // ==========================================================================
  const rawTrackers = Array.isArray(opts.thirdPartyTrackers) && opts.thirdPartyTrackers.length > 0
    ? opts.thirdPartyTrackers
    : (Array.isArray(opts.thirdPartyServices) && opts.thirdPartyServices.length > 0
      ? opts.thirdPartyServices
      : ["googleAnalytics", "cloudflare", "stripe"]);

  // Defensively sanitize tracker items: ignore null, undefined, or non-string items
  const validTrackers = rawTrackers
    .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
    .map((t) => t.trim());

  const trackers = validTrackers.length > 0
    ? validTrackers
    : ["googleAnalytics", "cloudflare", "stripe"];

  const trackerBullets: string[] = [];
  for (const t of trackers) {
    const norm = t.toLowerCase();
    if (norm.includes("adwords") || norm.includes("googleads") || norm.includes("google-ads") || norm.includes("doubleclick")) {
      trackerBullets.push("Google Ads (Google LLC): Conversion tracking, retargeting, and personalized advertising. Manage Google ad settings: https://adssettings.google.com.");
    } else if (norm.includes("google") || norm.includes("analytics")) {
      trackerBullets.push("Google Analytics (Google LLC): Traffic attribution and session analytics. Opt-out via Google Analytics Opt-out Browser Add-on: https://tools.google.com/dlpage/gaoptout.");
    } else if (norm.includes("meta") || norm.includes("facebook")) {
      trackerBullets.push("Meta Pixel (Meta Platforms Inc.): Conversion measurement and targeted advertising. Manage Facebook ad preferences: https://www.facebook.com/adpreferences.");
    } else if (norm.includes("tiktok")) {
      trackerBullets.push("TikTok Pixel (TikTok Inc.): Advertising conversion tracking and campaign measurement. Privacy Policy: https://www.tiktok.com/legal/privacy-policy.");
    } else if (norm.includes("linkedin")) {
      trackerBullets.push("LinkedIn Insight Tag (LinkedIn Corp.): Conversion tracking, website retargeting, and demographic reporting. Manage preferences: https://www.linkedin.com/psettings/guest-controls/retargeting-opt-out.");
    } else if (norm.includes("cloudflare")) {
      trackerBullets.push("Cloudflare (Cloudflare Inc.): Security management, bot detection (__cf_bm), and DDoS mitigation. Privacy Policy: https://www.cloudflare.com/privacypolicy/.");
    } else if (norm.includes("stripe")) {
      trackerBullets.push("Stripe (Stripe Inc.): Payment security, checkout tokenization, and fraud risk evaluation. Privacy Policy: https://stripe.com/privacy.");
    } else if (norm.includes("hotjar")) {
      trackerBullets.push("Hotjar (Hotjar Ltd.): Behavioral session heatmap tracking and UX feedback. Opt-out: https://www.hotjar.com/legal/compliance/opt-out/.");
    } else if (norm.includes("posthog")) {
      trackerBullets.push("PostHog (PostHog Inc.): Product telemetry and feature flag telemetry. Privacy Policy: https://posthog.com/privacy.");
    } else if (norm.includes("sentry")) {
      trackerBullets.push("Sentry (Functional Software Inc.): Application crash reporting and error diagnostics. Privacy Policy: https://sentry.io/privacy/.");
    } else {
      trackerBullets.push(`${t}: External third-party infrastructure and service partner.`);
    }
  }

  if (trackerBullets.length > 0) {
    sections.push({
      id: "third-party-trackers",
      title: "Third-Party Trackers and Service Providers",
      paragraphs: [
        `We work with selected third-party partners who may set cookies when you interact with our Services:`,
      ],
      bulletPoints: trackerBullets,
    });
  }

  // ==========================================================================
  // Section 7: How to Manage and Disable Cookies
  // ==========================================================================
  sections.push({
    id: "cookie-management",
    title: "How to Manage and Disable Cookies",
    paragraphs: [
      `You possess full control over which cookies you accept or reject. You may update your consent preferences at any time:`,
    ],
    subsections: [
      {
        id: "in-app-consent",
        title: "In-App Cookie Preference Center",
        paragraphs: [
          `You can modify your consent settings anytime by clicking the cookie settings link on our website: ${cookieBannerLink}. Non-essential cookies will be immediately disabled upon withdrawal of consent.`,
        ],
      },
      {
        id: "browser-controls",
        title: "Browser-Level Cookie Controls",
        paragraphs: [
          `Most web browsers allow you to modify cookie settings to reject cookies or prompt you before accepting cookies. You may consult the official documentation for your browser:`,
        ],
        bulletPoints: [
          "Google Chrome: Settings > Privacy and security > Third-party cookies.",
          "Mozilla Firefox: Settings > Privacy & Security > Cookies and Site Data.",
          "Apple Safari: Settings > Safari > Advanced > Block All Cookies / Prevent Cross-Site Tracking.",
          "Microsoft Edge: Settings > Cookies and site permissions > Manage and delete cookies and site data.",
        ],
      },
      {
        id: "advertising-opt-outs",
        title: "Industry Digital Advertising Opt-Out Alliances",
        paragraphs: [
          `To opt out of interest-based advertising across participating networks, you may visit the following self-regulatory programs:`,
        ],
        bulletPoints: [
          "Digital Advertising Alliance (DAA) (US): https://optout.aboutads.info/",
          "European Interactive Digital Advertising Alliance (EDAA) (EU): https://www.youronlinechoices.eu/",
          "Network Advertising Initiative (NAI): https://optout.networkadvertising.org/",
        ],
      },
    ],
  });

  // ==========================================================================
  // Section 8: Global Privacy Control (GPC) & Do Not Track
  // ==========================================================================
  sections.push({
    id: "gpc-dnt-signals",
    title: "Global Privacy Control (GPC) and Do Not Track",
    paragraphs: [
      `Global Privacy Control (GPC) is a browser setting that communicates your privacy preference to opt out of the sale or sharing of your personal information under California CPRA, Colorado CPA, and other consumer protection laws.`,
      `We support and affirmatively honor Global Privacy Control (GPC) signals transmitted by your browser. When our platform detects an active GPC signal, we automatically disable all advertising and marketing tracking cookies for your session without requiring any additional user action.`,
    ],
  });

  // ==========================================================================
  // Section 9: Updates to This Cookie Policy
  // ==========================================================================
  sections.push({
    id: "policy-revisions",
    title: "Updates to This Cookie Policy",
    paragraphs: [
      `We may update this Cookie Policy from time to time in order to reflect changes to the cookies we utilize, technological developments, or new statutory obligations. We encourage you to review this Cookie Policy regularly to remain informed about our use of tracking technologies.`,
      `The "Effective Date" at the beginning of this policy indicates when it was most recently revised.`,
    ],
  });

  // ==========================================================================
  // Section 10: Contact Us
  // ==========================================================================
  sections.push({
    id: "contact",
    title: "Contact Us",
    paragraphs: [
      `If you have questions or concerns about this Cookie Policy or our data practices, please reach out to our privacy compliance team:`,
    ],
    bulletPoints: [
      `Organization: ${companyName}`,
      `Application: ${appName}`,
      `Website: ${websiteUrl}`,
      `Email: ${contactEmail}`,
      physicalAddress !== "[Company Address]" ? `Mailing Address: ${physicalAddress}` : `Address: Available upon formal inquiry`,
    ],
  });

  return {
    id: "cookie-policy",
    title: "Cookie Policy",
    metadata,
    sections,
  };
}
