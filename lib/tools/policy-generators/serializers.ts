/**
 * Multi-Format Serializers for Policy Document AST
 * Produces Plain Text, Markdown, Semantic HTML5, and Structured JSON.
 * Code Station — Browser-Native Developer Tools
 */

import {
  PolicyCallout,
  PolicyDocument,
  PolicySection,
  PolicySubsection,
  PolicyTable,
  SerializerOptions,
} from "./types";

// ============================================================================
// Token Fallback & Sanitization Utilities
// ============================================================================

export function resolveToken(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  return fallback;
}

export function cleanStr(value: unknown, fallback: string): string {
  return resolveToken(value, fallback);
}

/**
 * Sanitizes numerical options, ensuring the value is a finite, positive integer.
 * Gracefully rejects NaN, negative numbers, zero, non-finite values, and invalid types,
 * returning the specified fallback.
 */
export function cleanPositiveNumber(val: unknown, fallback: number): number {
  if (typeof val === "number" && Number.isFinite(val) && !isNaN(val) && val > 0) {
    const floored = Math.floor(val);
    return floored > 0 ? floored : fallback;
  }
  if (typeof val === "string" && val.trim().length > 0) {
    const parsed = Number(val.trim());
    if (Number.isFinite(parsed) && !isNaN(parsed) && parsed > 0) {
      const floored = Math.floor(parsed);
      return floored > 0 ? floored : fallback;
    }
  }
  return fallback;
}

export function escapeHtml(str: string): string {
  if (typeof str !== "string") {
    return "";
  }
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function sanitizeUrl(urlStr: string): string {
  if (!urlStr || typeof urlStr !== "string") {
    return "#";
  }
  const trimmed = urlStr.trim();
  if (
    /^(https?:|mailto:)/i.test(trimmed) &&
    !/(javascript|data|vbscript):/i.test(trimmed)
  ) {
    return escapeHtml(trimmed);
  }
  return "#";
}

// ============================================================================
// 1. Plain Text Serializer (`toPlainText`)
// ============================================================================

function formatAsciiTable(table: PolicyTable): string {
  if (!table.headers || table.headers.length === 0) {
    return "";
  }

  const cleanHeaders = table.headers.map((h) => (h || "").replace(/\r?\n/g, " ").trim());
  const numCols = cleanHeaders.length;
  const colWidths: number[] = cleanHeaders.map((h) => h.length);

  const cleanRows = (table.rows || []).map((row) =>
    Array.from({ length: numCols }, (_, c) => (row[c] || "").replace(/\r?\n/g, " ").trim())
  );

  for (const row of cleanRows) {
    for (let c = 0; c < numCols; c++) {
      const cell = row[c] || "";
      if (cell.length > colWidths[c]) {
        colWidths[c] = cell.length;
      }
    }
  }

  // Ensure minimum width of 3 chars per column
  for (let c = 0; c < numCols; c++) {
    colWidths[c] = Math.max(colWidths[c], 3);
  }

  const border = "+" + colWidths.map((w) => "-".repeat(w + 2)).join("+") + "+";
  const headerDivider = "+" + colWidths.map((w) => "=".repeat(w + 2)).join("+") + "+";

  const headerLine =
    "|" +
    cleanHeaders.map((h, i) => ` ${h.padEnd(colWidths[i])} `).join("|") +
    "|";

  const dataLines = cleanRows.map((row) => {
    return (
      "|" +
      colWidths
        .map((w, i) => ` ${(row[i] || "").padEnd(w)} `)
        .join("|") +
      "|"
    );
  });

  const lines: string[] = [];
  if (table.caption) {
    lines.push(`TABLE: ${table.caption.replace(/\r?\n/g, " ").trim()}`);
  }
  lines.push(border);
  lines.push(headerLine);
  lines.push(headerDivider);
  for (const dl of dataLines) {
    lines.push(dl);
  }
  lines.push(border);

  return lines.join("\n");
}

function formatAsciiCallout(callout: PolicyCallout): string {
  const badge = callout.type.toUpperCase();
  const titlePart = callout.title ? `: ${callout.title}` : "";
  const header = `[${badge}${titlePart}]`;
  const divider = "-".repeat(Math.min(header.length + 4, 80));
  return `${header}\n${divider}\n${callout.text}\n${divider}`;
}

export function toPlainText(doc: PolicyDocument, options?: SerializerOptions): string {
  const parts: string[] = [];
  const bannerBorder = "=".repeat(80);

  // Document Title Banner
  parts.push(bannerBorder);
  parts.push(doc.title.toUpperCase());
  parts.push(bannerBorder);
  parts.push("");

  // Metadata block
  if (options?.includeMetadataBlock !== false) {
    const metaLines: string[] = [];
    if (doc.metadata.companyName) metaLines.push(`Company:        ${doc.metadata.companyName}`);
    if (doc.metadata.appName) metaLines.push(`Application:    ${doc.metadata.appName}`);
    if (doc.metadata.websiteUrl) metaLines.push(`Website:        ${doc.metadata.websiteUrl}`);
    if (doc.metadata.contactEmail) metaLines.push(`Contact Email:  ${doc.metadata.contactEmail}`);
    if (doc.metadata.physicalAddress) metaLines.push(`Address:        ${doc.metadata.physicalAddress}`);
    if (doc.metadata.effectiveDate) metaLines.push(`Effective Date: ${doc.metadata.effectiveDate}`);
    if (doc.metadata.lastUpdatedDate) metaLines.push(`Last Updated:   ${doc.metadata.lastUpdatedDate}`);

    if (metaLines.length > 0) {
      parts.push(metaLines.join("\n"));
      parts.push("");
      parts.push("-".repeat(80));
      parts.push("");
    }
  }

  // Sections
  doc.sections.forEach((section, sIdx) => {
    const sectionNum = sIdx + 1;
    parts.push(`${sectionNum}. ${section.title.toUpperCase()}`);
    parts.push("-".repeat(40));

    if (section.callout) {
      parts.push(formatAsciiCallout(section.callout));
      parts.push("");
    }

    if (section.paragraphs && section.paragraphs.length > 0) {
      for (const p of section.paragraphs) {
        parts.push(p);
        parts.push("");
      }
    }

    if (section.bulletPoints && section.bulletPoints.length > 0) {
      for (const bp of section.bulletPoints) {
        parts.push(`  • ${bp}`);
      }
      parts.push("");
    }

    if (section.table) {
      parts.push(formatAsciiTable(section.table));
      parts.push("");
    }

    // Subsections
    if (section.subsections && section.subsections.length > 0) {
      section.subsections.forEach((sub, subIdx) => {
        const subNum = `${sectionNum}.${subIdx + 1}`;
        parts.push(`${subNum} ${sub.title}`);
        parts.push("");

        if (sub.callout) {
          parts.push(formatAsciiCallout(sub.callout));
          parts.push("");
        }

        if (sub.paragraphs && sub.paragraphs.length > 0) {
          for (const sp of sub.paragraphs) {
            parts.push(sp);
            parts.push("");
          }
        }

        if (sub.bulletPoints && sub.bulletPoints.length > 0) {
          for (const sbp of sub.bulletPoints) {
            parts.push(`  - ${sbp}`);
          }
          parts.push("");
        }

        if (sub.table) {
          parts.push(formatAsciiTable(sub.table));
          parts.push("");
        }
      });
    }

    parts.push("");
  });

  return parts.join("\n").trim() + "\n";
}

// ============================================================================
// 2. Markdown Serializer (`toMarkdown`)
// ============================================================================

function formatMarkdownTable(table: PolicyTable): string {
  if (!table.headers || table.headers.length === 0) {
    return "";
  }

  const lines: string[] = [];
  if (table.caption) {
    lines.push(`*Table: ${table.caption.replace(/\r?\n/g, " ").trim()}*\n`);
  }

  const headers = table.headers.map((h) =>
    (h || "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim()
  );
  const headerLine = `| ${headers.join(" | ")} |`;
  const dividerLine = `| ${headers.map(() => ":---").join(" | ")} |`;

  lines.push(headerLine);
  lines.push(dividerLine);

  for (const row of table.rows || []) {
    const cells = table.headers.map((_, i) =>
      (row[i] || "")
        .replace(/\|/g, "\\|")
        .replace(/\r?\n/g, "<br>")
        .trim()
    );
    lines.push(`| ${cells.join(" | ")} |`);
  }

  return lines.join("\n");
}

function formatMarkdownCallout(callout: PolicyCallout): string {
  const badge = callout.type.toUpperCase();
  const titlePart = callout.title ? ` ${callout.title}` : "";
  const lines: string[] = [];
  lines.push(`> **[${badge}]${titlePart}**`);
  lines.push(`> `);
  const textLines = callout.text.split("\n");
  for (const tl of textLines) {
    lines.push(`> ${tl}`);
  }
  return lines.join("\n");
}

export function toMarkdown(doc: PolicyDocument, options?: SerializerOptions): string {
  const parts: string[] = [];

  // Document Title
  parts.push(`# ${doc.title}\n`);

  // Metadata block
  if (options?.includeMetadataBlock !== false) {
    const metaParts: string[] = [];
    if (doc.metadata.companyName) metaParts.push(`**Company:** ${doc.metadata.companyName}`);
    if (doc.metadata.appName) metaParts.push(`**Application:** ${doc.metadata.appName}`);
    if (doc.metadata.websiteUrl) {
      const safeUrl = sanitizeUrl(doc.metadata.websiteUrl)
        .replace(/\(/g, "%28")
        .replace(/\)/g, "%29")
        .replace(/\[/g, "%5B")
        .replace(/\]/g, "%5D");
      const cleanLabel = doc.metadata.websiteUrl
        .replace(/\[/g, "&#91;")
        .replace(/\]/g, "&#93;");
      metaParts.push(`**Website:** [${cleanLabel}](${safeUrl})`);
    }
    if (doc.metadata.contactEmail) {
      const emailHref = doc.metadata.contactEmail.startsWith("mailto:")
        ? doc.metadata.contactEmail
        : `mailto:${doc.metadata.contactEmail}`;
      const safeEmail = sanitizeUrl(emailHref)
        .replace(/\(/g, "%28")
        .replace(/\)/g, "%29")
        .replace(/\[/g, "%5B")
        .replace(/\]/g, "%5D");
      const cleanLabel = doc.metadata.contactEmail
        .replace(/\[/g, "&#91;")
        .replace(/\]/g, "&#93;");
      metaParts.push(`**Contact:** [${cleanLabel}](${safeEmail})`);
    }
    if (doc.metadata.physicalAddress) metaParts.push(`**Address:** ${doc.metadata.physicalAddress}`);
    if (doc.metadata.effectiveDate) metaParts.push(`**Effective Date:** ${doc.metadata.effectiveDate}`);
    if (doc.metadata.lastUpdatedDate) metaParts.push(`**Last Updated:** ${doc.metadata.lastUpdatedDate}`);

    if (metaParts.length > 0) {
      parts.push(metaParts.join("  \n"));
      parts.push("\n---\n");
    }
  }

  // Sections
  doc.sections.forEach((section, sIdx) => {
    const sectionNum = sIdx + 1;
    parts.push(`## ${sectionNum}. ${section.title}\n`);

    if (section.callout) {
      parts.push(formatMarkdownCallout(section.callout));
      parts.push("");
    }

    if (section.paragraphs && section.paragraphs.length > 0) {
      for (const p of section.paragraphs) {
        parts.push(`${p}\n`);
      }
    }

    if (section.bulletPoints && section.bulletPoints.length > 0) {
      for (const bp of section.bulletPoints) {
        parts.push(`- ${bp}`);
      }
      parts.push("");
    }

    if (section.table) {
      parts.push(formatMarkdownTable(section.table));
      parts.push("");
    }

    // Subsections
    if (section.subsections && section.subsections.length > 0) {
      section.subsections.forEach((sub, subIdx) => {
        const subNum = `${sectionNum}.${subIdx + 1}`;
        parts.push(`### ${subNum} ${sub.title}\n`);

        if (sub.callout) {
          parts.push(formatMarkdownCallout(sub.callout));
          parts.push("");
        }

        if (sub.paragraphs && sub.paragraphs.length > 0) {
          for (const sp of sub.paragraphs) {
            parts.push(`${sp}\n`);
          }
        }

        if (sub.bulletPoints && sub.bulletPoints.length > 0) {
          for (const sbp of sub.bulletPoints) {
            parts.push(`- ${sbp}`);
          }
          parts.push("");
        }

        if (sub.table) {
          parts.push(formatMarkdownTable(sub.table));
          parts.push("");
        }
      });
    }
  });

  return parts.join("\n").trim() + "\n";
}

// ============================================================================
// 3. HTML Serializer (`toHtml`)
// ============================================================================

function formatHtmlTable(table: PolicyTable): string {
  if (!table.headers || table.headers.length === 0) {
    return "";
  }

  const out: string[] = [];
  out.push('  <div class="policy-table-wrapper">');
  if (table.caption) {
    out.push(`    <div class="policy-table-caption">${escapeHtml(table.caption)}</div>`);
  }
  out.push('    <table class="policy-table">');
  out.push("      <thead>");
  out.push("        <tr>");
  for (const h of table.headers) {
    out.push(`          <th scope="col">${escapeHtml(h)}</th>`);
  }
  out.push("        </tr>");
  out.push("      </thead>");
  out.push("      <tbody>");
  for (const row of table.rows || []) {
    out.push("        <tr>");
    for (let c = 0; c < table.headers.length; c++) {
      out.push(`          <td>${escapeHtml(row[c] || "")}</td>`);
    }
    out.push("        </tr>");
  }
  out.push("      </tbody>");
  out.push("    </table>");
  out.push("  </div>");
  return out.join("\n");
}

function formatHtmlCallout(callout: PolicyCallout): string {
  const typeEscaped = escapeHtml(callout.type);
  const out: string[] = [];
  out.push(`  <aside class="policy-callout policy-callout-${typeEscaped}">`);
  out.push('    <div class="policy-callout-header">');
  out.push(`      <span class="policy-callout-badge">${typeEscaped.toUpperCase()}</span>`);
  if (callout.title) {
    out.push(`      <strong class="policy-callout-title">${escapeHtml(callout.title)}</strong>`);
  }
  out.push("    </div>");
  out.push(`    <p class="policy-callout-text">${escapeHtml(callout.text)}</p>`);
  out.push("  </aside>");
  return out.join("\n");
}

function formatHtmlSubsection(sub: PolicySubsection, prefix: string): string {
  const out: string[] = [];
  const idAttr = sub.id ? ` id="${escapeHtml(sub.id)}"` : "";
  out.push(`    <div class="policy-subsection"${idAttr}>`);
  out.push(`      <h3 class="policy-subsection-title">${escapeHtml(prefix)} ${escapeHtml(sub.title)}</h3>`);

  if (sub.callout) {
    out.push(formatHtmlCallout(sub.callout));
  }

  if (sub.paragraphs) {
    for (const p of sub.paragraphs) {
      out.push(`      <p>${escapeHtml(p)}</p>`);
    }
  }

  if (sub.bulletPoints && sub.bulletPoints.length > 0) {
    out.push('      <ul class="policy-list">');
    for (const bp of sub.bulletPoints) {
      out.push(`        <li>${escapeHtml(bp)}</li>`);
    }
    out.push("      </ul>");
  }

  if (sub.table) {
    out.push(formatHtmlTable(sub.table));
  }

  out.push("    </div>");
  return out.join("\n");
}

function formatHtmlSection(section: PolicySection, sectionNum: number): string {
  const out: string[] = [];
  const idAttr = section.id ? ` id="${escapeHtml(section.id)}"` : "";
  out.push(`  <section class="policy-section"${idAttr}>`);
  out.push(`    <h2 class="policy-section-title">${sectionNum}. ${escapeHtml(section.title)}</h2>`);

  if (section.callout) {
    out.push(formatHtmlCallout(section.callout));
  }

  if (section.paragraphs) {
    for (const p of section.paragraphs) {
      out.push(`    <p>${escapeHtml(p)}</p>`);
    }
  }

  if (section.bulletPoints && section.bulletPoints.length > 0) {
    out.push('    <ul class="policy-list">');
    for (const bp of section.bulletPoints) {
      out.push(`      <li>${escapeHtml(bp)}</li>`);
    }
    out.push("    </ul>");
  }

  if (section.table) {
    out.push(formatHtmlTable(section.table));
  }

  if (section.subsections && section.subsections.length > 0) {
    section.subsections.forEach((sub, subIdx) => {
      out.push(formatHtmlSubsection(sub, `${sectionNum}.${subIdx + 1}`));
    });
  }

  out.push("  </section>");
  return out.join("\n");
}

export function toHtml(doc: PolicyDocument, options?: SerializerOptions): string {
  const snippetParts: string[] = [];
  snippetParts.push(`<article class="policy-document" data-policy-id="${escapeHtml(doc.id)}">`);

  // Header & Metadata
  snippetParts.push('  <header class="policy-header">');
  snippetParts.push(`    <h1 class="policy-title">${escapeHtml(doc.title)}</h1>`);

  if (options?.includeMetadataBlock !== false) {
    snippetParts.push('    <div class="policy-metadata">');
    if (doc.metadata.companyName) {
      snippetParts.push(`      <div class="policy-meta-item"><span class="policy-meta-label">Company:</span> <span class="policy-meta-value">${escapeHtml(doc.metadata.companyName)}</span></div>`);
    }
    if (doc.metadata.appName) {
      snippetParts.push(`      <div class="policy-meta-item"><span class="policy-meta-label">Application:</span> <span class="policy-meta-value">${escapeHtml(doc.metadata.appName)}</span></div>`);
    }
    if (doc.metadata.websiteUrl) {
      const safeUrl = sanitizeUrl(doc.metadata.websiteUrl);
      snippetParts.push(`      <div class="policy-meta-item"><span class="policy-meta-label">Website:</span> <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="policy-meta-link">${escapeHtml(doc.metadata.websiteUrl)}</a></div>`);
    }
    if (doc.metadata.contactEmail) {
      const safeEmail = sanitizeUrl(`mailto:${doc.metadata.contactEmail}`);
      snippetParts.push(`      <div class="policy-meta-item"><span class="policy-meta-label">Contact:</span> <a href="${safeEmail}" class="policy-meta-link">${escapeHtml(doc.metadata.contactEmail)}</a></div>`);
    }
    if (doc.metadata.physicalAddress) {
      snippetParts.push(`      <div class="policy-meta-item"><span class="policy-meta-label">Address:</span> <span class="policy-meta-value">${escapeHtml(doc.metadata.physicalAddress)}</span></div>`);
    }
    if (doc.metadata.effectiveDate) {
      snippetParts.push(`      <div class="policy-meta-item"><span class="policy-meta-label">Effective Date:</span> <time datetime="${escapeHtml(doc.metadata.effectiveDate)}">${escapeHtml(doc.metadata.effectiveDate)}</time></div>`);
    }
    if (doc.metadata.lastUpdatedDate) {
      snippetParts.push(`      <div class="policy-meta-item"><span class="policy-meta-label">Last Updated:</span> <time datetime="${escapeHtml(doc.metadata.lastUpdatedDate)}">${escapeHtml(doc.metadata.lastUpdatedDate)}</time></div>`);
    }
    snippetParts.push("    </div>");
  }
  snippetParts.push("  </header>");

  // Body Sections
  snippetParts.push('  <div class="policy-body">');
  doc.sections.forEach((section, sIdx) => {
    snippetParts.push(formatHtmlSection(section, sIdx + 1));
  });
  snippetParts.push("  </div>");
  snippetParts.push("</article>");

  const snippet = snippetParts.join("\n");

  if (!options?.standaloneHtml) {
    return snippet;
  }

  // Standalone HTML5 Document
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(doc.title)} — ${escapeHtml(doc.metadata.companyName || "Code Station")}</title>
  <style>
    :root {
      --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
      --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      --color-bg: #ffffff;
      --color-text: #1a1a1a;
      --color-text-muted: #555555;
      --color-border: #e0e0e0;
      --color-surface: #f9f9f9;
      --color-primary: #1976d2;
      --color-warning-bg: #fff8e1;
      --color-warning-border: #ffe082;
      --color-warning-text: #b78103;
      --color-legal-bg: #ede7f6;
      --color-legal-border: #d1c4e9;
      --color-legal-text: #512da8;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --color-bg: #121212;
        --color-text: #eeeeee;
        --color-text-muted: #aaaaaa;
        --color-border: #2a2a2a;
        --color-surface: #1e1e1e;
        --color-primary: #64b5f6;
        --color-warning-bg: #2d2613;
        --color-warning-border: #4a3e1b;
        --color-warning-text: #ffd54f;
        --color-legal-bg: #1f1a2e;
        --color-legal-border: #3b2f57;
        --color-legal-text: #b39ddb;
      }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 2rem 1rem;
      background: var(--color-bg);
      color: var(--color-text);
      font-family: var(--font-sans);
      line-height: 1.65;
    }
    .policy-document {
      max-width: 860px;
      margin: 0 auto;
      background: var(--color-bg);
    }
    .policy-header {
      border-bottom: 2px solid var(--color-border);
      padding-bottom: 1.5rem;
      margin-bottom: 2rem;
    }
    .policy-title {
      font-size: 2.25rem;
      margin: 0 0 1rem;
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    .policy-metadata {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 0.75rem;
      font-size: 0.9rem;
      color: var(--color-text-muted);
    }
    .policy-meta-label {
      font-weight: 600;
      color: var(--color-text);
    }
    .policy-meta-link {
      color: var(--color-primary);
      text-decoration: none;
    }
    .policy-meta-link:hover {
      text-decoration: underline;
    }
    .policy-section {
      margin-bottom: 2.5rem;
    }
    .policy-section-title {
      font-size: 1.4rem;
      margin: 1.5rem 0 1rem;
      border-bottom: 1px solid var(--color-border);
      padding-bottom: 0.4rem;
      font-weight: 600;
    }
    .policy-subsection {
      margin: 1.25rem 0;
      padding-left: 0.5rem;
    }
    .policy-subsection-title {
      font-size: 1.15rem;
      margin: 1rem 0 0.5rem;
      font-weight: 600;
    }
    p {
      margin: 0.75rem 0;
    }
    .policy-list {
      margin: 0.75rem 0 0.75rem 1.5rem;
      padding: 0;
    }
    .policy-list li {
      margin-bottom: 0.35rem;
    }
    .policy-callout {
      margin: 1.25rem 0;
      padding: 1rem 1.25rem;
      border-radius: 6px;
      border-left: 4px solid var(--color-border);
      background: var(--color-surface);
    }
    .policy-callout-warning {
      background: var(--color-warning-bg);
      border-left-color: var(--color-warning-border);
      color: var(--color-warning-text);
    }
    .policy-callout-legal {
      background: var(--color-legal-bg);
      border-left-color: var(--color-legal-border);
      color: var(--color-legal-text);
    }
    .policy-callout-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
    }
    .policy-callout-badge {
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      padding: 0.15rem 0.4rem;
      border-radius: 3px;
      background: currentColor;
      color: var(--color-bg);
    }
    .policy-callout-text {
      margin: 0;
      font-size: 0.95rem;
      line-height: 1.5;
    }
    .policy-table-wrapper {
      margin: 1.5rem 0;
      overflow-x: auto;
    }
    .policy-table-caption {
      font-size: 0.85rem;
      font-style: italic;
      color: var(--color-text-muted);
      margin-bottom: 0.4rem;
    }
    .policy-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9rem;
    }
    .policy-table th, .policy-table td {
      border: 1px solid var(--color-border);
      padding: 0.6rem 0.75rem;
      text-align: left;
    }
    .policy-table th {
      background: var(--color-surface);
      font-weight: 600;
    }
    @media print {
      body {
        padding: 0;
        background: #ffffff !important;
        color: #000000 !important;
      }
      .policy-document {
        max-width: 100%;
      }
      .policy-callout {
        border-left: 3px solid #333333;
        background: #f5f5f5 !important;
        color: #000000 !important;
      }
      .policy-meta-link {
        color: #000000 !important;
        text-decoration: underline;
      }
    }
  </style>
</head>
<body>
  <main>
${snippet}
  </main>
</body>
</html>`;
}

// ============================================================================
// 4. JSON Serializer (`toJson`)
// ============================================================================

export function toJson(doc: PolicyDocument, options?: SerializerOptions): string {
  const spaces = typeof options?.indentSpaces === "number" ? options.indentSpaces : 2;
  return JSON.stringify(doc, null, spaces);
}
