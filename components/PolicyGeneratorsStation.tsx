"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Scale,
  Copy,
  Check,
  Download,
  Printer,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import {
  policyToolIds,
  type PolicyToolId,
  policyTools,
  getPolicyDefinition,
} from "@/config/policy-tools";
import {
  generatePolicyDocument,
  serializePolicyDocument,
  getPolicyPreset,
  listPolicyPresets,
} from "@/lib/tools/policy-generators/engine";
import type {
  PolicyOutputFormat,
  PresetVertical,
  PolicyDocument,
} from "@/lib/tools/policy-generators/types";
import { useToolHandoff } from "./WorkbenchProvider";
import styles from "./PolicyGeneratorsStation.module.css";

interface PolicyGeneratorsStationProps {
  toolId: PolicyToolId;
}

type ViewFormat = "preview" | "markdown" | "html" | "text" | "json";

export default function PolicyGeneratorsStation({ toolId }: PolicyGeneratorsStationProps) {
  const definition = getPolicyDefinition(toolId) || policyTools[0];
  const presets = useMemo(() => listPolicyPresets(), []);

  // Active vertical preset
  const [selectedVertical, setSelectedVertical] = useState<PresetVertical>("saas");

  // Format tab
  const [activeFormat, setActiveFormat] = useState<ViewFormat>("preview");

  // Copy feedback state
  const [copied, setCopied] = useState(false);

  // Initial options loaded from default preset
  const initialOptions = useMemo(() => {
    return getPolicyPreset(toolId, "saas");
  }, [toolId]);

  // Form state
  const [options, setOptions] = useState<Record<string, any>>(() => initialOptions);

  // Tool handoff support for triage pre-fill
  useToolHandoff(toolId, (handedText) => {
    if (handedText && handedText.trim()) {
      setOptions((prev) => ({
        ...prev,
        companyName: handedText.slice(0, 80).trim() || prev.companyName,
      }));
    }
  });

  // Switch vertical preset
  const handleApplyPreset = useCallback((vertical: PresetVertical) => {
    setSelectedVertical(vertical);
    const presetData = getPolicyPreset(toolId, vertical);
    setOptions(presetData);
  }, [toolId]);

  // Helper to update individual form field
  const updateField = (key: string, value: any) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
  };

  // Toggle array items (e.g. collectedCategories, disclaimerTypes)
  const toggleArrayItem = (key: string, item: string) => {
    setOptions((prev) => {
      const arr = Array.isArray(prev[key]) ? [...prev[key]] : [];
      const index = arr.indexOf(item);
      if (index >= 0) {
        arr.splice(index, 1);
      } else {
        arr.push(item);
      }
      return { ...prev, [key]: arr };
    });
  };

  // Generate Document AST in real-time with zero-crash guarantee
  const documentAst: PolicyDocument = useMemo(() => {
    try {
      return generatePolicyDocument(toolId, options);
    } catch {
      return generatePolicyDocument(toolId, {});
    }
  }, [toolId, options]);

  // Serialized content for each format
  const serializedMarkdown = useMemo(() => {
    return serializePolicyDocument(documentAst, "markdown");
  }, [documentAst]);

  const serializedHtmlSnippet = useMemo(() => {
    return serializePolicyDocument(documentAst, "html", { standaloneHtml: false });
  }, [documentAst]);

  const serializedHtmlStandalone = useMemo(() => {
    return serializePolicyDocument(documentAst, "html", { standaloneHtml: true });
  }, [documentAst]);

  const serializedPlainText = useMemo(() => {
    return serializePolicyDocument(documentAst, "text");
  }, [documentAst]);

  const serializedJson = useMemo(() => {
    return serializePolicyDocument(documentAst, "json");
  }, [documentAst]);

  // Current active text based on format
  const activeContent = useMemo(() => {
    switch (activeFormat) {
      case "preview":
      case "html":
        return serializedHtmlStandalone;
      case "markdown":
        return serializedMarkdown;
      case "text":
        return serializedPlainText;
      case "json":
        return serializedJson;
    }
  }, [activeFormat, serializedHtmlStandalone, serializedMarkdown, serializedPlainText, serializedJson]);

  // Copy to clipboard
  const handleCopy = useCallback(async () => {
    const textToCopy =
      activeFormat === "preview" ? serializedMarkdown : activeContent;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = textToCopy;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  }, [activeFormat, serializedMarkdown, activeContent]);

  // File Download
  const handleDownload = useCallback(() => {
    let extension = "md";
    let mimeType = "text/markdown;charset=utf-8";
    let content = serializedMarkdown;

    if (activeFormat === "html") {
      extension = "html";
      mimeType = "text/html;charset=utf-8";
      content = serializedHtmlStandalone;
    } else if (activeFormat === "text") {
      extension = "txt";
      mimeType = "text/plain;charset=utf-8";
      content = serializedPlainText;
    } else if (activeFormat === "json") {
      extension = "json";
      mimeType = "application/json;charset=utf-8";
      content = serializedJson;
    }

    const dateStr = new Date().toISOString().split("T")[0];
    const filename = `${toolId}-${dateStr}.${extension}`;
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [activeFormat, serializedMarkdown, serializedHtmlStandalone, serializedPlainText, serializedJson, toolId]);

  // Print / Save to PDF
  const handlePrint = useCallback(() => {
    if (typeof window !== "undefined") {
      window.print();
    }
  }, []);

  // Reset form
  const handleReset = useCallback(() => {
    handleApplyPreset(selectedVertical);
  }, [selectedVertical, handleApplyPreset]);

  return (
    <div
      className={styles.container}
      data-webmcp-station="policy-generators"
      data-webmcp-tool={`codestation_${toolId.replace(/-/g, "_")}`}
    >
      {/* Station Header */}
      <div className={styles.stationHeader}>
        <div>
          <div className={styles.stationTitle}>
            <Scale size={24} color="var(--accent)" aria-hidden="true" />
            <h1 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 800 }}>
              {definition.name}
            </h1>
            <span className={styles.stationBadge}>Station 26 · In-Browser</span>
          </div>
          <p className={styles.stationDescription}>
            Generate, customize, and export compliant legal policies entirely in your browser with zero server uploads.
          </p>
        </div>
      </div>

      {/* Tool Navigation Tabs */}
      <nav className={styles.toolTabs} aria-label="Policy generator tools">
        {policyTools.map((t) => {
          const isActive = t.id === toolId;
          return (
            <Link
              key={t.id}
              href={`/tools/${t.slug}`}
              className={`${styles.toolTab} ${isActive ? styles.activeTab : ""}`}
              aria-current={isActive ? "page" : undefined}
            >
              {t.name.replace(" Generator", "")}
            </Link>
          );
        })}
      </nav>

      {/* 2-Column Responsive Workspace */}
      <div className={styles.workspaceLayout}>
        {/* Left Column: Form Controls */}
        <section className={styles.formPanel} aria-label="Policy Configuration">
          {/* Preset Selector */}
          <div className={styles.presetBar}>
            <label htmlFor="preset-select" className={styles.presetLabel}>
              <Sparkles size={14} aria-hidden="true" style={{ verticalAlign: "middle", marginRight: 4 }} />
              Preset Profile:
            </label>
            <select
              id="preset-select"
              className={styles.presetSelect}
              value={selectedVertical}
              onChange={(e) => handleApplyPreset(e.target.value as PresetVertical)}
            >
              {presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Group 1: Business Details */}
          <div className={styles.sectionGroup}>
            <div className={styles.sectionGroupHeader}>1. Company &amp; Website Identity</div>

            <div className={styles.fieldRow}>
              <label htmlFor="field-company-name" className={styles.fieldLabel}>
                Entity / Company Name
              </label>
              <input
                id="field-company-name"
                className={styles.fieldInput}
                type="text"
                value={options.companyName ?? ""}
                onChange={(e) => updateField("companyName", e.target.value)}
                placeholder="Acme Technologies Inc."
              />
            </div>

            <div className={styles.fieldRow}>
              <label htmlFor="field-app-name" className={styles.fieldLabel}>
                Application or Platform Name
              </label>
              <input
                id="field-app-name"
                className={styles.fieldInput}
                type="text"
                value={options.appName ?? ""}
                onChange={(e) => updateField("appName", e.target.value)}
                placeholder="Acme Cloud Platform"
              />
            </div>

            <div className={styles.fieldRow}>
              <label htmlFor="field-website-url" className={styles.fieldLabel}>
                Primary Website / Service URL
              </label>
              <input
                id="field-website-url"
                className={styles.fieldInput}
                type="url"
                value={options.websiteUrl ?? ""}
                onChange={(e) => updateField("websiteUrl", e.target.value)}
                placeholder="https://example.com"
              />
            </div>

            <div className={styles.fieldRow}>
              <label htmlFor="field-contact-email" className={styles.fieldLabel}>
                Contact / Legal Email
              </label>
              <input
                id="field-contact-email"
                className={styles.fieldInput}
                type="email"
                value={options.contactEmail ?? ""}
                onChange={(e) => updateField("contactEmail", e.target.value)}
                placeholder="legal@example.com"
              />
            </div>

            <div className={styles.fieldRow}>
              <label htmlFor="field-effective-date" className={styles.fieldLabel}>
                Effective Date
              </label>
              <input
                id="field-effective-date"
                className={styles.fieldInput}
                type="date"
                value={options.effectiveDate ?? new Date().toISOString().split("T")[0]}
                onChange={(e) => updateField("effectiveDate", e.target.value)}
              />
            </div>

            <div className={styles.fieldRow}>
              <label htmlFor="field-country" className={styles.fieldLabel}>
                Country &amp; Jurisdiction
              </label>
              <input
                id="field-country"
                className={styles.fieldInput}
                type="text"
                value={options.country ?? options.governingCountry ?? ""}
                onChange={(e) => {
                  updateField("country", e.target.value);
                  updateField("governingCountry", e.target.value);
                }}
                placeholder="United States"
              />
            </div>
          </div>

          {/* Group 2: Tool-Specific Clauses */}
          {toolId === "privacy-policy-generator" && (
            <div className={styles.sectionGroup}>
              <div className={styles.sectionGroupHeader}>2. Privacy Regulations &amp; Data Practices</div>

              <div className={styles.checkboxGrid}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    className={styles.checkboxInput}
                    checked={Boolean(options.includeGdpr ?? true)}
                    onChange={(e) => updateField("includeGdpr", e.target.checked)}
                  />
                  GDPR Disclosures (EU/UK)
                </label>

                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    className={styles.checkboxInput}
                    checked={Boolean(options.includeCcpa ?? true)}
                    onChange={(e) => updateField("includeCcpa", e.target.checked)}
                  />
                  CCPA/CPRA Disclosures (CA)
                </label>

                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    className={styles.checkboxInput}
                    checked={Boolean(options.usesCookies ?? true)}
                    onChange={(e) => updateField("usesCookies", e.target.checked)}
                  />
                  Uses Cookies &amp; Local Storage
                </label>

                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    className={styles.checkboxInput}
                    checked={Boolean(options.internationalTransfers ?? true)}
                    onChange={(e) => updateField("internationalTransfers", e.target.checked)}
                  />
                  Cross-Border Transfers
                </label>
              </div>

              <div className={styles.fieldRow}>
                <label htmlFor="field-minimum-age" className={styles.fieldLabel}>
                  Minimum User Age (COPPA / Age Gate)
                </label>
                <input
                  id="field-minimum-age"
                  className={styles.fieldInput}
                  type="number"
                  min={0}
                  max={21}
                  value={options.minimumAge ?? 13}
                  onChange={(e) => updateField("minimumAge", parseInt(e.target.value, 10) || 13)}
                />
              </div>

              <div className={styles.fieldRow}>
                <label htmlFor="field-retention" className={styles.fieldLabel}>
                  Data Retention Policy Description
                </label>
                <textarea
                  id="field-retention"
                  className={styles.fieldTextarea}
                  value={options.retentionDescription ?? ""}
                  onChange={(e) => updateField("retentionDescription", e.target.value)}
                  placeholder="Data is retained for active membership plus 30 days..."
                />
              </div>
            </div>
          )}

          {toolId === "terms-and-conditions-generator" && (
            <div className={styles.sectionGroup}>
              <div className={styles.sectionGroupHeader}>2. Terms &amp; Dispute Resolution</div>

              <div className={styles.fieldRow}>
                <label htmlFor="field-dispute-type" className={styles.fieldLabel}>
                  Dispute Resolution Forum
                </label>
                <select
                  id="field-dispute-type"
                  className={styles.fieldSelect}
                  value={options.disputeResolutionType ?? "binding_arbitration"}
                  onChange={(e) => updateField("disputeResolutionType", e.target.value)}
                >
                  <option value="binding_arbitration">Binding Individual Arbitration</option>
                  <option value="court_litigation">Direct Court Litigation</option>
                  <option value="informal_first">Informal Negotiation First</option>
                </select>
              </div>

              <div className={styles.checkboxGrid}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    className={styles.checkboxInput}
                    checked={Boolean(options.includeClassActionWaiver ?? true)}
                    onChange={(e) => updateField("includeClassActionWaiver", e.target.checked)}
                  />
                  Class Action Waiver
                </label>

                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    className={styles.checkboxInput}
                    checked={Boolean(options.hasUserAccounts ?? true)}
                    onChange={(e) => updateField("hasUserAccounts", e.target.checked)}
                  />
                  User Account Registration
                </label>

                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    className={styles.checkboxInput}
                    checked={Boolean(options.hasUgc ?? false)}
                    onChange={(e) => updateField("hasUgc", e.target.checked)}
                  />
                  User-Generated Content (UGC)
                </label>

                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    className={styles.checkboxInput}
                    checked={Boolean(options.includeDmca ?? true)}
                    onChange={(e) => updateField("includeDmca", e.target.checked)}
                  />
                  DMCA Safe Harbor Notice
                </label>
              </div>

              <div className={styles.fieldRow}>
                <label htmlFor="field-liability-ceiling" className={styles.fieldLabel}>
                  Liability Ceiling / Cap Formula
                </label>
                <input
                  id="field-liability-ceiling"
                  className={styles.fieldInput}
                  type="text"
                  value={options.liabilityCeilingDescription ?? ""}
                  onChange={(e) => updateField("liabilityCeilingDescription", e.target.value)}
                  placeholder="Total amounts paid by user in previous 12 months"
                />
              </div>
            </div>
          )}

          {toolId === "cookie-policy-generator" && (
            <div className={styles.sectionGroup}>
              <div className={styles.sectionGroupHeader}>2. Cookie Classifications &amp; Trackers</div>

              <div className={styles.checkboxGrid}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    className={styles.checkboxInput}
                    checked={Boolean(options.useEssential ?? true)}
                    onChange={(e) => updateField("useEssential", e.target.checked)}
                  />
                  Essential Cookies
                </label>

                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    className={styles.checkboxInput}
                    checked={Boolean(options.useAnalytics ?? true)}
                    onChange={(e) => updateField("useAnalytics", e.target.checked)}
                  />
                  Analytics &amp; Performance
                </label>

                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    className={styles.checkboxInput}
                    checked={Boolean(options.useFunctional ?? true)}
                    onChange={(e) => updateField("useFunctional", e.target.checked)}
                  />
                  Functional Preferences
                </label>

                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    className={styles.checkboxInput}
                    checked={Boolean(options.useAdvertising ?? false)}
                    onChange={(e) => updateField("useAdvertising", e.target.checked)}
                  />
                  Targeted Advertising
                </label>
              </div>
            </div>
          )}

          {toolId === "disclaimer-generator" && (
            <div className={styles.sectionGroup}>
              <div className={styles.sectionGroupHeader}>2. Disclaimer Exclusions</div>

              <div className={styles.checkboxGrid}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    className={styles.checkboxInput}
                    checked={(options.disclaimerTypes ?? ["general_information"]).includes("professional_legal")}
                    onChange={() => toggleArrayItem("disclaimerTypes", "professional_legal")}
                  />
                  Legal Advice Disclaimer
                </label>

                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    className={styles.checkboxInput}
                    checked={(options.disclaimerTypes ?? ["general_information"]).includes("professional_financial")}
                    onChange={() => toggleArrayItem("disclaimerTypes", "professional_financial")}
                  />
                  Financial Advice Disclaimer
                </label>

                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    className={styles.checkboxInput}
                    checked={(options.disclaimerTypes ?? ["general_information"]).includes("professional_medical")}
                    onChange={() => toggleArrayItem("disclaimerTypes", "professional_medical")}
                  />
                  Medical / Health Disclaimer
                </label>

                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    className={styles.checkboxInput}
                    checked={(options.disclaimerTypes ?? ["general_information"]).includes("affiliate_links")}
                    onChange={() => toggleArrayItem("disclaimerTypes", "affiliate_links")}
                  />
                  FTC Affiliate Disclosure
                </label>
              </div>
            </div>
          )}

          {toolId === "refund-policy-generator" && (
            <div className={styles.sectionGroup}>
              <div className={styles.sectionGroupHeader}>2. Return Stance &amp; Eligibility</div>

              <div className={styles.fieldRow}>
                <label htmlFor="field-refund-stance" className={styles.fieldLabel}>
                  Policy Stance
                </label>
                <select
                  id="field-refund-stance"
                  className={styles.fieldSelect}
                  value={options.stance ?? "standard_returns"}
                  onChange={(e) => updateField("stance", e.target.value)}
                >
                  <option value="standard_returns">Standard Returns (Refunds Allowed)</option>
                  <option value="no_refunds">Strict No Refunds (All Sales Final)</option>
                  <option value="store_credit_only">Store Credit / Exchange Only</option>
                  <option value="case_by_case">Case-by-Case Discretionary</option>
                </select>
              </div>

              <div className={styles.fieldRow}>
                <label htmlFor="field-return-days" className={styles.fieldLabel}>
                  Return Window (Days)
                </label>
                <input
                  id="field-return-days"
                  className={styles.fieldInput}
                  type="number"
                  min={0}
                  max={365}
                  value={options.returnWindowDays ?? 30}
                  onChange={(e) => updateField("returnWindowDays", parseInt(e.target.value, 10) || 30)}
                />
              </div>

              <div className={styles.fieldRow}>
                <label htmlFor="field-shipping-payer" className={styles.fieldLabel}>
                  Return Shipping Costs
                </label>
                <select
                  id="field-shipping-payer"
                  className={styles.fieldSelect}
                  value={options.returnShippingPayer ?? "customer"}
                  onChange={(e) => updateField("returnShippingPayer", e.target.value)}
                >
                  <option value="customer">Customer Responsible</option>
                  <option value="company">Company Provides Prepaid Label</option>
                  <option value="split_or_defective_only">Free Only for Defective / Wrong Items</option>
                </select>
              </div>
            </div>
          )}
        </section>

        {/* Right Column: Live Real-Time Multi-Format Preview */}
        <section className={styles.previewPanel} aria-label="Policy Output Preview">
          {/* Toolbar */}
          <div className={styles.previewToolbar}>
            <div className={styles.formatTabs} role="tablist" aria-label="Output format tabs">
              {(["preview", "markdown", "html", "text", "json"] as ViewFormat[]).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  role="tab"
                  aria-selected={activeFormat === fmt}
                  className={`${styles.formatTab} ${activeFormat === fmt ? styles.formatTabActive : ""}`}
                  onClick={() => setActiveFormat(fmt)}
                >
                  {fmt === "preview" ? "Preview" : fmt}
                </button>
              ))}
            </div>

            <div className={styles.actionButtons}>
              <button
                type="button"
                className={`${styles.btnAction} ${styles.btnPrimary}`}
                onClick={handleCopy}
                aria-label="Copy policy text to clipboard"
              >
                {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                {copied ? "Copied!" : "Copy"}
              </button>

              <button
                type="button"
                className={styles.btnAction}
                onClick={handleDownload}
                aria-label="Download policy file"
              >
                <Download size={14} aria-hidden="true" />
                Download
              </button>

              <button
                type="button"
                className={styles.btnAction}
                onClick={handlePrint}
                aria-label="Print or Save as PDF"
              >
                <Printer size={14} aria-hidden="true" />
                Print / PDF
              </button>

              <button
                type="button"
                className={styles.btnAction}
                onClick={handleReset}
                aria-label="Reset options to preset"
                title="Reset to default preset values"
              >
                <RefreshCw size={14} aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Stats Bar */}
          <div className={styles.statsBar}>
            <span>{documentAst.sections.length} Sections</span>
            <span>·</span>
            <span>{activeContent.length.toLocaleString()} Characters</span>
            <span>·</span>
            <span>Zero Server Uploads</span>
          </div>

          {/* Scrollable Output Box */}
          <div className={styles.previewScrollBox}>
            {activeFormat === "preview" ? (
              <article
                className={styles.renderedArticle}
                dangerouslySetInnerHTML={{ __html: serializedHtmlSnippet }}
              />
            ) : (
              <pre className={styles.codeBox}>
                <code>{activeContent}</code>
              </pre>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
