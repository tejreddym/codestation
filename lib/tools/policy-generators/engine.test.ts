import { describe, expect, it } from "vitest";
import {
  cleanPositiveNumber,
  cleanStr,
  escapeHtml,
  generatePolicyDocument,
  generatePolicyText,
  getPolicyPreset,
  listPolicyPresets,
  PolicyDocument,
  PolicyToolId,
  resolveToken,
  sanitizeUrl,
  serializePolicyDocument,
  toJson,
  toHtml,
  toMarkdown,
  toPlainText,
} from "./engine";

describe("Policy Generator Engine — Core & Serializers", () => {
  const toolIds: PolicyToolId[] = [
    "privacy-policy-generator",
    "terms-and-conditions-generator",
    "cookie-policy-generator",
    "disclaimer-generator",
    "refund-policy-generator",
  ];

  describe("Token Fallback & Zero-Crash Resilience", () => {
    it("resolveToken returns trimmed string when non-empty, otherwise fallback", () => {
      expect(resolveToken("  My Company  ", "Default")).toBe("My Company");
      expect(resolveToken("", "Default")).toBe("Default");
      expect(resolveToken("   ", "Default")).toBe("Default");
      expect(resolveToken(undefined, "Default")).toBe("Default");
      expect(resolveToken(null, "Default")).toBe("Default");
      expect(resolveToken(123, "Default")).toBe("Default");
    });

    it("cleanStr behaves identically to resolveToken", () => {
      expect(cleanStr(" Acme ", "Fallback")).toBe("Acme");
      expect(cleanStr("", "Fallback")).toBe("Fallback");
    });

    it("generates all 5 policy documents without throwing when passed empty options {}", () => {
      for (const id of toolIds) {
        expect(() => {
          const doc = generatePolicyDocument(id, {});
          expect(doc).toBeDefined();
          expect(doc.id).toBeTruthy();
          expect(doc.title).toBeTruthy();
          expect(doc.metadata.companyName).toBe("[Company Name]");
          expect(doc.metadata.websiteUrl).toContain("example.com");
          expect(doc.sections.length).toBeGreaterThan(0);
        }).not.toThrow();
      }
    });

    it("generates all 5 policy documents without throwing when options is undefined or null", () => {
      for (const id of toolIds) {
        // @ts-expect-error testing runtime resilience against unexpected inputs
        const doc = generatePolicyDocument(id, null);
        expect(doc).toBeDefined();
        expect(doc.sections.length).toBeGreaterThan(0);
      }
    });

    it("generates policy text directly across all formats for empty options {}", () => {
      const formats = ["text", "markdown", "html", "json"] as const;
      for (const id of toolIds) {
        for (const format of formats) {
          const text = generatePolicyText(id, format, {});
          expect(typeof text).toBe("string");
          expect(text.length).toBeGreaterThan(50);
        }
      }
    });

    it("throws descriptive error for unsupported tool ID", () => {
      // @ts-expect-error testing invalid tool ID
      expect(() => generatePolicyDocument("invalid-tool-id", {})).toThrow(
        /Unsupported policy tool ID/
      );
    });

    it("throws error when trying to serialize null or undefined document", () => {
      // @ts-expect-error testing null document
      expect(() => serializePolicyDocument(null)).toThrow(
        /Cannot serialize an undefined or null PolicyDocument/
      );
    });
  });

  describe("HTML Entity Escaping and URL Sanitization (XSS Prevention)", () => {
    it("escapes dangerous HTML special characters", () => {
      expect(escapeHtml("<script>alert('xss')</script>")).toBe(
        "&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;"
      );
      expect(escapeHtml('" onmouseover="alert(1)"')).toBe(
        "&quot; onmouseover=&quot;alert(1)&quot;"
      );
      expect(escapeHtml("Foo & Bar <Baz>")).toBe("Foo &amp; Bar &lt;Baz&gt;");
    });

    it("sanitizes unsafe URL protocols to #", () => {
      expect(sanitizeUrl("javascript:alert(1)")).toBe("#");
      expect(sanitizeUrl("javascript:void(0)")).toBe("#");
      expect(sanitizeUrl("data:text/html,<script>alert(1)</script>")).toBe("#");
      expect(sanitizeUrl("vbscript:msgbox(1)")).toBe("#");
      expect(sanitizeUrl("")).toBe("#");
      // @ts-expect-error testing non-string url
      expect(sanitizeUrl(null)).toBe("#");
    });

    it("preserves legitimate http, https, and mailto URLs", () => {
      expect(sanitizeUrl("https://example.com/privacy")).toBe(
        "https://example.com/privacy"
      );
      expect(sanitizeUrl("http://localhost:3000")).toBe("http://localhost:3000");
      expect(sanitizeUrl("mailto:privacy@example.com")).toBe(
        "mailto:privacy@example.com"
      );
    });

    it("prevents stored XSS in generated HTML when companyName contains script tags", () => {
      const maliciousCompany = "<script>alert('pwned')</script>";
      const maliciousUrl = "javascript:alert('xss')";
      const html = generatePolicyText("privacy-policy-generator", "html", {
        companyName: maliciousCompany,
        websiteUrl: maliciousUrl,
      });

      expect(html).not.toContain("<script>alert('pwned')</script>");
      expect(html).toContain("&lt;script&gt;alert(&#39;pwned&#39;)&lt;/script&gt;");
      expect(html).not.toContain('href="javascript:');
      expect(html).toContain('href="#"');
    });
  });

  describe("Plain Text Serializer (`toPlainText`)", () => {
    it("formats uppercase title with 80-character border banner", () => {
      const doc: PolicyDocument = {
        id: "test-doc",
        title: "Test Policy",
        metadata: {
          toolId: "privacy-policy-generator",
          title: "Test Policy",
          companyName: "Acme Corp",
          websiteUrl: "https://acme.test",
          contactEmail: "legal@acme.test",
          effectiveDate: "2026-11-10",
          lastUpdatedDate: "2026-11-10",
        },
        sections: [
          {
            id: "sec-1",
            title: "First Section",
            paragraphs: ["Paragraph one content."],
            bulletPoints: ["Bullet point A", "Bullet point B"],
          },
        ],
      };

      const text = toPlainText(doc);
      expect(text).toContain("=".repeat(80));
      expect(text).toContain("TEST POLICY");
      expect(text).toContain("Company:        Acme Corp");
      expect(text).toContain("1. FIRST SECTION");
      expect(text).toContain("Paragraph one content.");
      expect(text).toContain("  • Bullet point A");
    });

    it("renders ASCII tables with properly aligned columns", () => {
      const doc: PolicyDocument = {
        id: "test-table-doc",
        title: "Table Test",
        metadata: {
          toolId: "cookie-policy-generator",
          title: "Table Test",
          companyName: "Acme Corp",
          websiteUrl: "https://acme.test",
          contactEmail: "privacy@acme.test",
          effectiveDate: "2026-11-10",
          lastUpdatedDate: "2026-11-10",
        },
        sections: [
          {
            id: "sec-table",
            title: "Cookie Inventory",
            table: {
              caption: "Active Cookies",
              headers: ["Cookie", "Provider", "Category"],
              rows: [
                ["_ga", "Google LLC", "Analytics"],
                ["session_id", "First-party", "Strictly Necessary"],
              ],
            },
          },
        ],
      };

      const text = toPlainText(doc);
      expect(text).toContain("TABLE: Active Cookies");
      expect(text).toMatch(/\+[-+]+\+/);
      expect(text).toContain("| Cookie ");
      expect(text).toContain("| _ga ");
      expect(text).toContain("| session_id ");
      expect(text).toMatch(/\+[=+ wave]+\+/);
    });

    it("formats callouts in plain text", () => {
      const doc: PolicyDocument = {
        id: "callout-doc",
        title: "Callout Test",
        metadata: {
          toolId: "terms-and-conditions-generator",
          title: "Callout Test",
          companyName: "Acme Corp",
          websiteUrl: "https://acme.test",
          contactEmail: "legal@acme.test",
          effectiveDate: "2026-11-10",
          lastUpdatedDate: "2026-11-10",
        },
        sections: [
          {
            id: "callout-sec",
            title: "Arbitration",
            callout: {
              type: "warning",
              title: "Arbitration Notice",
              text: "Disputes are subject to binding individual arbitration.",
            },
          },
        ],
      };

      const text = toPlainText(doc);
      expect(text).toContain("[WARNING: Arbitration Notice]");
      expect(text).toContain("Disputes are subject to binding individual arbitration.");
    });
  });

  describe("Markdown Serializer (`toMarkdown`)", () => {
    it("renders GFM headings, bold metadata, blockquotes, and tables", () => {
      const doc: PolicyDocument = {
        id: "md-test",
        title: "Markdown Policy",
        metadata: {
          toolId: "privacy-policy-generator",
          title: "Markdown Policy",
          companyName: "Acme Corp",
          websiteUrl: "https://acme.test",
          contactEmail: "privacy@acme.test",
          effectiveDate: "2026-11-10",
          lastUpdatedDate: "2026-11-10",
        },
        sections: [
          {
            id: "sec-1",
            title: "Introduction",
            paragraphs: ["Welcome to our policy."],
            callout: {
              type: "legal",
              title: "Statutory Notice",
              text: "This agreement is binding.",
            },
            table: {
              headers: ["Key", "Value | Note"],
              rows: [["Name", "John | Doe"]],
            },
            subsections: [
              {
                title: "Sub One",
                paragraphs: ["Sub paragraph."],
                bulletPoints: ["Sub item 1"],
              },
            ],
          },
        ],
      };

      const md = toMarkdown(doc);
      expect(md).toContain("# Markdown Policy");
      expect(md).toContain("**Company:** Acme Corp");
      expect(md).toContain("## 1. Introduction");
      expect(md).toContain("> **[LEGAL] Statutory Notice**");
      expect(md).toContain("> This agreement is binding.");
      expect(md).toContain("| Key | Value \\| Note |");
      expect(md).toContain("| :--- | :--- |");
      expect(md).toContain("| Name | John \\| Doe |");
      expect(md).toContain("### 1.1 Sub One");
      expect(md).toContain("- Sub item 1");
    });
  });

  describe("HTML Serializer (`toHtml`) — Standalone vs Snippet Mode", () => {
    const sampleDoc: PolicyDocument = {
      id: "privacy-policy",
      title: "Privacy Policy",
      metadata: {
        toolId: "privacy-policy-generator",
        title: "Privacy Policy",
        companyName: "Acme Corp",
        websiteUrl: "https://acme.test",
        contactEmail: "privacy@acme.test",
        effectiveDate: "2026-11-10",
        lastUpdatedDate: "2026-11-10",
      },
      sections: [
        {
          id: "intro",
          title: "Introduction",
          paragraphs: ["Intro text."],
          callout: {
            type: "warning",
            title: "Caution",
            text: "Important warning notice.",
          },
        },
      ],
    };

    it("snippet mode generates <article> container without <html> wrapper", () => {
      const snippet = toHtml(sampleDoc, { standaloneHtml: false });
      expect(snippet.startsWith('<article class="policy-document" data-policy-id="privacy-policy">')).toBe(true);
      expect(snippet).not.toContain("<!DOCTYPE html>");
      expect(snippet).not.toContain("<html");
      expect(snippet).toContain('<h1 class="policy-title">Privacy Policy</h1>');
      expect(snippet).toContain('<aside class="policy-callout policy-callout-warning">');
    });

    it("standalone mode generates complete HTML5 document with CSS styling", () => {
      const fullHtml = toHtml(sampleDoc, { standaloneHtml: true });
      expect(fullHtml).toContain("<!DOCTYPE html>");
      expect(fullHtml).toContain('<html lang="en">');
      expect(fullHtml).toContain("<head>");
      expect(fullHtml).toContain("<style>");
      expect(fullHtml).toContain("@media print");
      expect(fullHtml).toContain("<body>");
      expect(fullHtml).toContain('<article class="policy-document" data-policy-id="privacy-policy">');
      expect(fullHtml).toContain("</html>");
    });
  });

  describe("JSON Serializer (`toJson`)", () => {
    it("produces valid parseable JSON matching PolicyDocument AST", () => {
      const doc = generatePolicyDocument("privacy-policy-generator", {
        companyName: "Test Company Inc.",
      });

      const jsonStr = toJson(doc);
      expect(() => JSON.parse(jsonStr)).not.toThrow();

      const parsed = JSON.parse(jsonStr) as PolicyDocument;
      expect(parsed.id).toBe("privacy-policy");
      expect(parsed.title).toBe("Privacy Policy");
      expect(parsed.metadata.companyName).toBe("Test Company Inc.");
      expect(Array.isArray(parsed.sections)).toBe(true);
      expect(parsed.sections.length).toBeGreaterThan(0);
    });
  });

  describe("Generator 1: Privacy Policy (`privacy-policy.ts`)", () => {
    it("generates comprehensive GDPR, CCPA, CalOPPA, and COPPA compliant sections", () => {
      const doc = generatePolicyDocument("privacy-policy-generator", {
        companyName: "Nova Cloud Corp",
        appName: "Nova Workspace",
        websiteUrl: "https://nova.example.com",
        contactEmail: "privacy@nova.example.com",
        includeGdpr: true,
        includeCcpa: true,
        usesCookies: true,
        hasAdvertising: true,
        dpoName: "Jane Doe, CIPP/E",
        dpoEmail: "dpo@nova.example.com",
      });

      expect(doc.id).toBe("privacy-policy");
      expect(doc.title).toBe("Privacy Policy");

      const sectionTitles = doc.sections.map((s) => s.title);
      expect(sectionTitles).toContain("Introduction and Scope");
      expect(sectionTitles).toContain("Information We Collect");
      expect(sectionTitles).toContain("How We Use Information and Lawful Bases for Processing");
      expect(sectionTitles).toContain("Cookies and Automated Tracking Technologies");
      expect(sectionTitles).toContain("Third-Party Service Providers and Disclosures");
      expect(sectionTitles).toContain("International Data Transfers");
      expect(sectionTitles).toContain("Data Retention and Information Security");
      expect(sectionTitles).toContain("Your Statutory Privacy Rights");
      expect(sectionTitles).toContain("Children's Privacy Protection");
      expect(sectionTitles).toContain("Changes to This Privacy Policy");
      expect(sectionTitles).toContain("Contact Information and Data Protection Officer");

      // Verify GDPR Article 6 Table exists
      const lawfulSection = doc.sections.find((s) => s.id === "how-we-use-information");
      expect(lawfulSection?.table).toBeDefined();
      expect(lawfulSection?.table?.headers).toContain("Lawful Basis (GDPR Art. 6)");

      // Verify DPO details included
      const contactSection = doc.sections.find((s) => s.id === "contact-information");
      const contactText = contactSection?.bulletPoints?.join(" ") || "";
      expect(contactText).toContain("Jane Doe, CIPP/E");
      expect(contactText).toContain("dpo@nova.example.com");
    });

    it("adapts COPPA disclosures for children under 13 audience", () => {
      const docUnder13 = generatePolicyDocument("privacy-policy-generator", {
        companyName: "EduKids Media",
        targetAudience: "under13",
      });
      const coppaSec = docUnder13.sections.find((s) => s.id === "childrens-privacy");
      expect(coppaSec?.paragraphs?.[0]).toContain("verifiable parental consent");
    });
  });

  describe("Generator 2: Terms and Conditions (`terms-and-conditions.ts`)", () => {
    it("generates full contract clauses with arbitration, class action waiver, DMCA, and UCC warranties", () => {
      const doc = generatePolicyDocument("terms-and-conditions-generator", {
        companyName: "SaaSify Inc.",
        appName: "SaaSify Platform",
        websiteUrl: "https://saasify.example.com",
        contactEmail: "legal@saasify.example.com",
        hasSubscriptions: true,
        hasUserAccounts: true,
        hasUserContent: true,
        includeDmca: true,
        dmcaAgentEmail: "dmca@saasify.example.com",
        disputeResolution: "arbitration",
        arbitrationProvider: "AAA",
        classActionWaiver: true,
      });

      expect(doc.id).toBe("terms-and-conditions");
      const sectionIds = doc.sections.map((s) => s.id);

      expect(sectionIds).toContain("agreement-to-terms");
      expect(sectionIds).toContain("eligibility");
      expect(sectionIds).toContain("user-accounts");
      expect(sectionIds).toContain("acceptable-use");
      expect(sectionIds).toContain("intellectual-property");
      expect(sectionIds).toContain("user-generated-content");
      expect(sectionIds).toContain("dmca-copyright");
      expect(sectionIds).toContain("billing-subscriptions");
      expect(sectionIds).toContain("term-and-termination");
      expect(sectionIds).toContain("warranty-disclaimer");
      expect(sectionIds).toContain("limitation-of-liability");
      expect(sectionIds).toContain("indemnification");
      expect(sectionIds).toContain("dispute-resolution");
      expect(sectionIds).toContain("governing-law");
      expect(sectionIds).toContain("general-provisions");
      expect(sectionIds).toContain("contact-information");

      // Verify UCC "AS IS" disclaimer
      const warrantySec = doc.sections.find((s) => s.id === "warranty-disclaimer");
      expect(warrantySec?.paragraphs?.[0]).toContain('"AS IS"');
      expect(warrantySec?.paragraphs?.[0]).toContain("MERCHANTABILITY");

      // Verify Arbitration & Class Action Waiver
      const disputeSec = doc.sections.find((s) => s.id === "dispute-resolution");
      const subTitles = disputeSec?.subsections?.map((s) => s.title) || [];
      expect(subTitles).toContain("Binding Individual Arbitration");
      expect(subTitles).toContain("Class Action and Jury Trial Waiver");
      expect(subTitles).toContain("30-Day Right to Opt Out");
    });
  });

  describe("Generator 3: Cookie Policy (`cookie-policy.ts`)", () => {
    it("generates 4 cookie categories, default inventory table, tracker disclosures, and browser guides", () => {
      const doc = generatePolicyDocument("cookie-policy-generator", {
        companyName: "WebShop Co.",
        websiteUrl: "https://webshop.example.com",
        useStrictlyNecessary: true,
        useAnalytics: true,
        useFunctional: true,
        useAdvertising: true,
        hasCookieTable: true,
        thirdPartyTrackers: ["googleAnalytics", "metaPixel", "stripe", "cloudflare"],
        supportsGpc: true,
        cookieBannerLink: "#manage-cookie-preferences",
      });

      expect(doc.id).toBe("cookie-policy");
      const sectionIds = doc.sections.map((s) => s.id);
      expect(sectionIds).toContain("introduction");
      expect(sectionIds).toContain("what-are-cookies");
      expect(sectionIds).toContain("how-we-use-cookies");
      expect(sectionIds).toContain("cookie-categories");
      expect(sectionIds).toContain("cookie-inventory");
      expect(sectionIds).toContain("third-party-trackers");
      expect(sectionIds).toContain("cookie-management");
      expect(sectionIds).toContain("gpc-dnt-signals");
      expect(sectionIds).toContain("policy-revisions");
      expect(sectionIds).toContain("contact");

      // Verify table rows exist
      const tableSec = doc.sections.find((s) => s.id === "cookie-inventory");
      expect(tableSec?.table).toBeDefined();
      expect(tableSec?.table?.rows.length).toBeGreaterThan(0);
      expect(tableSec?.table?.headers).toEqual([
        "Cookie Name",
        "Provider",
        "Category",
        "Purpose",
        "Duration",
        "Type",
      ]);

      // Verify browser instructions exist
      const mgmtSec = doc.sections.find((s) => s.id === "cookie-management");
      const mgmtSubs = mgmtSec?.subsections?.map((s) => s.id) || [];
      expect(mgmtSubs).toContain("in-app-consent");
      expect(mgmtSubs).toContain("browser-controls");
      expect(mgmtSubs).toContain("advertising-opt-outs");
    });

    it("respects custom cookie table rows if provided", () => {
      const doc = generatePolicyDocument("cookie-policy-generator", {
        hasCookieTable: true,
        customCookieRows: [
          {
            name: "my_custom_token",
            provider: "Custom Provider",
            category: "Functional",
            purpose: "Custom purpose",
            duration: "30 Days",
            type: "HTTP Cookie",
          },
        ],
      });

      const tableSec = doc.sections.find((s) => s.id === "cookie-inventory");
      expect(tableSec?.table?.rows).toHaveLength(1);
      expect(tableSec?.table?.rows[0][0]).toBe("my_custom_token");
      expect(tableSec?.table?.rows[0][1]).toBe("Custom Provider");
    });
  });

  describe("Generator 4: Disclaimer (`disclaimer.ts`)", () => {
    it("generates professional advice disclaimers and FTC Amazon affiliate disclosures", () => {
      const doc = generatePolicyDocument("disclaimer-generator", {
        companyName: "Finance & Health Blog LLC",
        disclaimerTypes: ["legal", "medical", "financial", "fitness"],
        hasAffiliateLinks: true,
        isAmazonAssociate: true,
        hasSponsoredContent: true,
        includeTestimonials: true,
      });

      expect(doc.id).toBe("disclaimer");
      const sectionIds = doc.sections.map((s) => s.id);
      expect(sectionIds).toContain("general-disclaimer");
      expect(sectionIds).toContain("risk-assumption");
      expect(sectionIds).toContain("professional-disclaimers");
      expect(sectionIds).toContain("external-links");
      expect(sectionIds).toContain("affiliate-disclosure");
      expect(sectionIds).toContain("testimonials-disclaimer");
      expect(sectionIds).toContain("errors-and-omissions");
      expect(sectionIds).toContain("warranty-exclusion");
      expect(sectionIds).toContain("contact-information");

      // Verify Amazon verbatim clause
      const affiliateSec = doc.sections.find((s) => s.id === "affiliate-disclosure");
      const affiliateFullText = affiliateSec?.paragraphs?.join(" ") || "";
      expect(affiliateFullText).toContain(
        "As an Amazon Associate I earn from qualifying purchases."
      );

      // Verify medical emergency 911 warning
      const profSec = doc.sections.find((s) => s.id === "professional-disclaimers");
      const medicalSub = profSec?.subsections?.find((s) => s.id === "medical-advice-disclaimer");
      expect(medicalSub?.callout?.text).toContain("911");
    });
  });

  describe("Generator 5: Refund Policy (`refund-policy.ts`)", () => {
    it("supports Standard Returns with physical RMA workflows and restocking clauses", () => {
      const doc = generatePolicyDocument("refund-policy-generator", {
        companyName: "Aero Outfitters LLC",
        policyType: "standardReturns",
        returnWindowDays: 30,
        productTypes: ["physicalGoods"],
        shippingFeePayer: "customerUnlessDefective",
        restockingFee: "10percent",
        physicalReturnAddress: "123 Warehouse Way, Reno, NV 89501",
      });

      expect(doc.id).toBe("refund-policy");
      expect(doc.metadata.physicalAddress).toBe("123 Warehouse Way, Reno, NV 89501");

      const stanceSec = doc.sections.find((s) => s.id === "return-window-stance");
      expect(stanceSec?.paragraphs?.[0]).toContain("30 calendar days");

      const shippingSec = doc.sections.find((s) => s.id === "shipping-and-fees");
      expect(shippingSec?.paragraphs?.[0]).toContain("discretionary returns");
      expect(shippingSec?.paragraphs?.[0]).toContain("damaged, defective, or incorrect");
      expect(shippingSec?.paragraphs?.[1]).toContain("10%");

      const rmaSec = doc.sections.find((s) => s.id === "return-process");
      expect(rmaSec?.bulletPoints?.[0]).toContain("Request an RMA");
    });

    it("supports 'No Refunds' stance with statutory defect exceptions", () => {
      const doc = generatePolicyDocument("refund-policy-generator", {
        policyType: "noRefunds",
      });
      const stanceSec = doc.sections.find((s) => s.id === "return-window-stance");
      expect(stanceSec?.title).toContain("All Sales Final");
      expect(stanceSec?.paragraphs?.[0]).toContain("final, non-refundable");
    });

    it("supports 'Store Credit Only' stance", () => {
      const doc = generatePolicyDocument("refund-policy-generator", {
        policyType: "storeCreditOnly",
        returnWindowDays: 14,
      });
      const stanceSec = doc.sections.find((s) => s.id === "return-window-stance");
      expect(stanceSec?.title).toContain("Store Credit");
      expect(stanceSec?.paragraphs?.[0]).toContain("store credit or merchandise exchanges");
    });

    it("includes EU statutory digital download withdrawal waiver", () => {
      const doc = generatePolicyDocument("refund-policy-generator", {
        productTypes: ["digitalDownloads", "saasSubscriptions"],
      });
      const digitalSec = doc.sections.find((s) => s.id === "digital-and-saas");
      const digitalSub = digitalSec?.subsections?.find((s) => s.id === "digital-downloads");
      expect(digitalSub?.paragraphs?.[1]).toContain("Directive 2011/83/EU");
      expect(digitalSub?.paragraphs?.[1]).toContain("waive your statutory 14-day right of withdrawal");
    });
  });

  describe("Industry Presets (`presets.ts`)", () => {
    const presetVerticals = ["saas", "ecommerce", "blog", "mobile-app"] as const;

    it("provides valid presets for all 4 verticals across all 5 tools", () => {
      for (const presetName of presetVerticals) {
        for (const toolId of toolIds) {
          const opts = getPolicyPreset(toolId, presetName);
          expect(opts).toBeDefined();
          expect(typeof opts).toBe("object");
          expect(opts.companyName).toBeTruthy();
          expect(opts.websiteUrl).toBeTruthy();

          // Ensure preset can directly be processed by generatePolicyDocument without errors
          const doc = generatePolicyDocument(toolId, opts);
          expect(doc.metadata.companyName).toBe(opts.companyName);
          expect(doc.sections.length).toBeGreaterThan(0);
        }
      }
    });

    it("falls back to 'saas' preset when unknown preset name is requested", () => {
      const fallbackOpts = getPolicyPreset("privacy-policy-generator", "non-existent-preset");
      const saasOpts = getPolicyPreset("privacy-policy-generator", "saas");
      expect(fallbackOpts.companyName).toBe(saasOpts.companyName);
    });

    it("listPolicyPresets returns all 4 verticals with names and descriptions", () => {
      const list = listPolicyPresets();
      expect(list).toHaveLength(4);
      const ids = list.map((item) => item.id);
      expect(ids).toContain("saas");
      expect(ids).toContain("ecommerce");
      expect(ids).toContain("blog");
      expect(ids).toContain("mobile-app");
    });
  });

  // ==========================================================================
  // Milestone 1 Iteration 2 Regression Tests (DEFECT-M1-01 to DEFECT-M1-05)
  // ==========================================================================
  describe("Milestone 1 Iteration 2 Regression Tests", () => {
    describe("DEFECT-M1-04: Numerical Input Sanitization & Anti-NaN Leakage", () => {
      it("cleanPositiveNumber validates finite positive integers and rejects NaN/negatives/zero", () => {
        expect(cleanPositiveNumber(13, 13)).toBe(13);
        expect(cleanPositiveNumber(21, 13)).toBe(21);
        expect(cleanPositiveNumber(NaN, 13)).toBe(13);
        expect(cleanPositiveNumber(-5, 13)).toBe(13);
        expect(cleanPositiveNumber(0, 13)).toBe(13);
        expect(cleanPositiveNumber(0.4, 13)).toBe(13);
        expect(cleanPositiveNumber(Infinity, 30)).toBe(30);
        expect(cleanPositiveNumber(-Infinity, 30)).toBe(30);
        expect(cleanPositiveNumber("18", 13)).toBe(18);
        expect(cleanPositiveNumber("invalid", 13)).toBe(13);
        expect(cleanPositiveNumber("", 13)).toBe(13);
        expect(cleanPositiveNumber(null, 13)).toBe(13);
        expect(cleanPositiveNumber(undefined, 13)).toBe(13);
        expect(cleanPositiveNumber({}, 13)).toBe(13);
        expect(cleanPositiveNumber([], 13)).toBe(13);
      });

      it("privacy-policy: prevents literal 'NaN' and negative numbers from leaking into minimumAge clause", () => {
        // 1. Test NaN
        const textNaN = generatePolicyText("privacy-policy-generator", "markdown", {
          minimumAge: NaN,
        });
        expect(textNaN).not.toContain("NaN");
        expect(textNaN).not.toContain("under the age of NaN");
        expect(textNaN).toContain("under the age of 13");
        expect(textNaN).toContain("children under 13");

        // 2. Test negative number (-5)
        const textNeg = generatePolicyText("privacy-policy-generator", "markdown", {
          minimumAge: -5,
        });
        expect(textNeg).not.toContain("-5");
        expect(textNeg).not.toContain("under the age of -5");
        expect(textNeg).toContain("under the age of 13");

        // 3. Test 0 and Infinity
        const textZero = generatePolicyText("privacy-policy-generator", "markdown", {
          minimumAge: 0,
        });
        expect(textZero).toContain("under the age of 13");

        const textInf = generatePolicyText("privacy-policy-generator", "markdown", {
          minimumAge: Infinity,
        });
        expect(textInf).toContain("under the age of 13");

        // 4. Test non-numeric string
        const textStr = generatePolicyText("privacy-policy-generator", "markdown", {
          minimumAge: "not-a-number" as unknown as number,
        });
        expect(textStr).toContain("under the age of 13");

        // 5. Test valid custom age (16)
        const textValid = generatePolicyText("privacy-policy-generator", "markdown", {
          minimumAge: 16,
        });
        expect(textValid).toContain("under the age of 16");
        expect(textValid).toContain("children under 16");
      });

      it("terms-and-conditions: sanitizes minimumAge and arbitrationOptOutDays against NaN and negative values", () => {
        // 1. Test NaN on both fields
        const textNaN = generatePolicyText("terms-and-conditions-generator", "markdown", {
          minimumAge: NaN,
          arbitrationOptOutDays: NaN,
        });
        expect(textNaN).not.toContain("NaN");
        expect(textNaN).not.toContain("at least NaN years of age");
        expect(textNaN).not.toContain("within NaN calendar days");
        expect(textNaN).toContain("at least 13 years of age");
        expect(textNaN).toContain("within 30 calendar days of first accepting these Terms");

        // 2. Test negative numbers (-5 and -15)
        const textNeg = generatePolicyText("terms-and-conditions-generator", "markdown", {
          minimumAge: -5,
          arbitrationOptOutDays: -15,
        });
        expect(textNeg).not.toContain("-5");
        expect(textNeg).not.toContain("-15");
        expect(textNeg).toContain("at least 13 years of age");
        expect(textNeg).toContain("within 30 calendar days of first accepting these Terms");

        // 3. Test 0 and Infinity
        const textZero = generatePolicyText("terms-and-conditions-generator", "markdown", {
          minimumAge: 0,
          arbitrationOptOutDays: 0,
        });
        expect(textZero).toContain("at least 13 years of age");
        expect(textZero).toContain("within 30 calendar days of first accepting these Terms");

        // 4. Test valid custom positive values
        const textValid = generatePolicyText("terms-and-conditions-generator", "markdown", {
          minimumAge: 18,
          arbitrationOptOutDays: 60,
        });
        expect(textValid).toContain("at least 18 years of age");
        expect(textValid).toContain("within 60 calendar days of first accepting these Terms");
        expect(textValid).toContain("60-Day Right to Opt Out");
      });

      it("refund-policy: sanitizes returnWindowDays against NaN and negative values across all stances", () => {
        // 1. Standard Returns with NaN
        const textNaN = generatePolicyText("refund-policy-generator", "markdown", {
          policyType: "standardReturns",
          returnWindowDays: NaN,
        });
        expect(textNaN).not.toContain("NaN");
        expect(textNaN).not.toContain("NaN-Day Satisfaction Guarantee");
        expect(textNaN).toContain("30-Day Satisfaction Guarantee");
        expect(textNaN).toContain("within 30 calendar days from the date of confirmed delivery");

        // 2. Standard Returns with negative number (-15)
        const textNeg = generatePolicyText("refund-policy-generator", "markdown", {
          policyType: "standardReturns",
          returnWindowDays: -15,
        });
        expect(textNeg).not.toContain("-15");
        expect(textNeg).not.toContain("-15-Day Satisfaction Guarantee");
        expect(textNeg).toContain("30-Day Satisfaction Guarantee");
        expect(textNeg).toContain("within 30 calendar days from the date of confirmed delivery");

        // 3. Store Credit Only with NaN
        const textStoreCreditNaN = generatePolicyText("refund-policy-generator", "markdown", {
          policyType: "storeCreditOnly",
          returnWindowDays: NaN,
        });
        expect(textStoreCreditNaN).not.toContain("NaN");
        expect(textStoreCreditNaN).toContain("30-day return window");
        expect(textStoreCreditNaN).toContain("within 30 days of receipt");

        // 4. Conditional Refunds with negative (-30)
        const textCondNeg = generatePolicyText("refund-policy-generator", "markdown", {
          policyType: "conditionalRefunds",
          returnWindowDays: -30,
        });
        expect(textCondNeg).not.toContain("-30");
        expect(textCondNeg).toContain("within 30 calendar days of purchase");

        // 5. Zero and Infinity
        const textZero = generatePolicyText("refund-policy-generator", "markdown", {
          returnWindowDays: 0,
        });
        expect(textZero).toContain("30-Day Satisfaction Guarantee");

        const textInf = generatePolicyText("refund-policy-generator", "markdown", {
          returnWindowDays: Infinity,
        });
        expect(textInf).toContain("30-Day Satisfaction Guarantee");

        // 6. Valid custom return window
        const textValid = generatePolicyText("refund-policy-generator", "markdown", {
          returnWindowDays: 45,
        });
        expect(textValid).toContain("45-Day Satisfaction Guarantee");
        expect(textValid).toContain("within 45 calendar days");
      });
    });

    describe("DEFECT-M1-01: Cookie Policy Malformed Arrays / Zero Crash", () => {
      it("does not throw TypeError when customCookieRows contains null or undefined elements", () => {
        expect(() => {
          const doc = generatePolicyDocument("cookie-policy-generator", {
            customCookieRows: [null],
          });
          expect(doc).toBeDefined();
          expect(doc.id).toBe("cookie-policy");
        }).not.toThrow();

        expect(() => {
          const doc = generatePolicyDocument("cookie-policy-generator", {
            customCookieRows: [
              null,
              undefined,
              {},
              {
                name: "custom_session",
                provider: "Acme",
                category: "Functional",
                purpose: "Session storage",
                duration: "1 hour",
                type: "HTTP Cookie",
              },
            ],
          });
          expect(doc).toBeDefined();
          const tableSec = doc.sections.find((s) => s.id === "cookie-inventory");
          expect(tableSec?.table).toBeDefined();
          expect(tableSec?.table?.rows).toHaveLength(1);
          expect(tableSec?.table?.rows[0][0]).toBe("custom_session");
        }).not.toThrow();
      });

      it("does not throw TypeError when customCookies contains null or undefined elements", () => {
        expect(() => {
          const doc = generatePolicyDocument("cookie-policy-generator", {
            customCookies: [null],
          });
          expect(doc).toBeDefined();
          expect(doc.id).toBe("cookie-policy");
        }).not.toThrow();

        expect(() => {
          const doc = generatePolicyDocument("cookie-policy-generator", {
            customCookies: [null, undefined, { name: "my_token" }],
          });
          expect(doc).toBeDefined();
          const tableSec = doc.sections.find((s) => s.id === "cookie-inventory");
          expect(tableSec?.table?.rows).toHaveLength(1);
          expect(tableSec?.table?.rows[0][0]).toBe("my_token");
        }).not.toThrow();
      });

      it("does not throw TypeError when thirdPartyTrackers contains null elements", () => {
        expect(() => {
          const doc = generatePolicyDocument("cookie-policy-generator", {
            thirdPartyTrackers: [null],
          });
          expect(doc).toBeDefined();
          expect(doc.id).toBe("cookie-policy");
        }).not.toThrow();
      });
    });

    describe("DEFECT-M1-05: Cookie Policy Advertising Reconciliation", () => {
      it("eliminates internal contradiction when useAdvertising is false but thirdPartyTrackers includes advertising trackers", () => {
        const text = generatePolicyText("cookie-policy-generator", "markdown", {
          useAdvertising: false,
          thirdPartyTrackers: ["metaPixel"],
        });

        // Must disclose Meta Pixel in Section 6
        expect(text).toContain("Meta Pixel");

        // Must NOT falsely claim 'Zero Third-Party Advertising Trackers' in Section 4
        expect(text).not.toContain("Zero Third-Party Advertising Trackers");
        expect(text).toContain("Advertising and Marketing Cookies");
      });

      it("auto-reconciles useAdvertising when googleAds is selected", () => {
        const text = generatePolicyText("cookie-policy-generator", "markdown", {
          thirdPartyTrackers: ["googleAds"],
        });

        expect(text).toContain("Google Ads");
        expect(text).not.toContain("Zero Third-Party Advertising Trackers");
        expect(text).toContain("Advertising and Marketing Cookies");
      });

      it("retains 'Zero Third-Party Advertising Trackers' when useAdvertising is false and no ad trackers are present", () => {
        const text = generatePolicyText("cookie-policy-generator", "markdown", {
          useAdvertising: false,
          thirdPartyTrackers: ["cloudflare", "stripe"],
        });

        expect(text).toContain("Zero Third-Party Advertising Trackers");
        expect(text).toContain("Cloudflare");
        expect(text).toContain("Stripe");
        expect(text).not.toContain("Meta Pixel");
        expect(text).not.toContain("Advertising and Marketing Cookies");
      });

      it("displays advertising section without contradiction when useAdvertising is true", () => {
        const text = generatePolicyText("cookie-policy-generator", "markdown", {
          useAdvertising: true,
          thirdPartyTrackers: ["metaPixel"],
        });

        expect(text).toContain("Advertising and Marketing Cookies");
        expect(text).toContain("Meta Pixel");
        expect(text).not.toContain("Zero Third-Party Advertising Trackers");
      });
    });

    describe("DEFECT-M1-02: Markdown Serializer Link Sanitization", () => {
      it("sanitizes dangerous URL pseudo-protocols in Markdown metadata to #", () => {
        const doc: PolicyDocument = {
          id: "security-test",
          title: "Security Test Policy",
          metadata: {
            toolId: "privacy-policy-generator",
            title: "Security Test Policy",
            companyName: "SafeCorp",
            websiteUrl: "javascript:alert(1)",
            contactEmail: "javascript:alert(2)",
            effectiveDate: "2026-01-01",
            lastUpdatedDate: "2026-01-01",
          },
          sections: [],
        };

        const md = toMarkdown(doc);

        // Target URL href must be sanitized to (#)
        expect(md).toContain("[javascript:alert(1)](#)");
        expect(md).not.toContain("(javascript:alert(1))");
        expect(md).toContain("[javascript:alert(2)](#)");
        expect(md).not.toContain("(mailto:javascript:alert(2))");
      });

      it("prevents markdown link breakout via parentheses in URLs", () => {
        const doc: PolicyDocument = {
          id: "breakout-test",
          title: "Breakout Test Policy",
          metadata: {
            toolId: "privacy-policy-generator",
            title: "Breakout Test Policy",
            companyName: "SafeCorp",
            websiteUrl: "https://example.com) [Evil](https://evil.com",
            contactEmail: "legal@example.com",
            effectiveDate: "2026-01-01",
            lastUpdatedDate: "2026-01-01",
          },
          sections: [],
        };

        const md = toMarkdown(doc);
        expect(md).not.toContain("[Evil]");
        expect(md).toContain("%29");
      });

      it("preserves valid https and mailto URLs in Markdown metadata", () => {
        const doc: PolicyDocument = {
          id: "valid-links-test",
          title: "Valid Links Test",
          metadata: {
            toolId: "privacy-policy-generator",
            title: "Valid Links Test",
            companyName: "LegitCorp",
            websiteUrl: "https://legit.example.com",
            contactEmail: "privacy@legit.example.com",
            effectiveDate: "2026-01-01",
            lastUpdatedDate: "2026-01-01",
          },
          sections: [],
        };

        const md = toMarkdown(doc);
        expect(md).toContain("[https://legit.example.com](https://legit.example.com)");
        expect(md).toContain("[privacy@legit.example.com](mailto:privacy@legit.example.com)");
      });
    });

    describe("DEFECT-M1-03: Table Cell Newline Sanitization in Markdown & Plain Text", () => {
      const docWithMultilineCells: PolicyDocument = {
        id: "multiline-table-test",
        title: "Multiline Table Test",
        metadata: {
          toolId: "cookie-policy-generator",
          title: "Multiline Table Test",
          companyName: "Acme Corp",
          websiteUrl: "https://example.com",
          contactEmail: "info@example.com",
          effectiveDate: "2026-01-01",
          lastUpdatedDate: "2026-01-01",
        },
        sections: [
          {
            id: "table-section",
            title: "Table Section",
            table: {
              caption: "Multi-line\nCaption",
              headers: ["Header\nOne", "Header Two"],
              rows: [
                ["Row 1 Line 1\nRow 1 Line 2", "Cell B1"],
                ["Cell A2", "Row 2 Line 1\r\nRow 2 Line 2"],
              ],
            },
          },
        ],
      };

      it("replaces newlines with <br> in Markdown tables so table rows do not break", () => {
        const md = toMarkdown(docWithMultilineCells);
        expect(md).toContain("Row 1 Line 1<br>Row 1 Line 2");
        expect(md).toContain("Row 2 Line 1<br>Row 2 Line 2");

        // Verify that every table row starts and ends with | on the same line
        const tableLines = md.split("\n").filter((l) => l.startsWith("|"));
        expect(tableLines.length).toBe(4); // header, separator, row1, row2
        for (const line of tableLines) {
          expect(line.trim().endsWith("|")).toBe(true);
        }
      });

      it("replaces newlines with spaces in Plain Text ASCII tables so box formatting aligns", () => {
        const txt = toPlainText(docWithMultilineCells);
        expect(txt).toContain("Row 1 Line 1 Row 1 Line 2");
        expect(txt).toContain("Row 2 Line 1 Row 2 Line 2");

        // Verify borders and data rows maintain box formatting
        const lines = txt.split("\n");
        const boxLines = lines.filter((l) => l.startsWith("|") || l.startsWith("+"));
        expect(boxLines.length).toBeGreaterThan(0);
        for (const bl of boxLines) {
          expect(bl.endsWith("|") || bl.endsWith("+")).toBe(true);
        }
      });
    });
  });
});
