export type EnvSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

export type EnvCategory =
  | "SECRET_LEAK"
  | "MISSING_VAR"
  | "EXTRA_VAR"
  | "WEAK_VALUE"
  | "DUPLICATE_KEY"
  | "EMPTY_VALUE"
  | "SYNTAX_ISSUE";

export interface EnvFinding {
  line?: number;
  key: string;
  severity: EnvSeverity;
  category: EnvCategory;
  message: string;
  recommendation: string;
  maskedValue?: string;
}

export interface EnvAuditResult {
  totalVariables: number;
  findings: EnvFinding[];
  stats: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  isSecure: boolean;
  summary: string;
}

interface ParsedEnvEntry {
  line: number;
  key: string;
  value: string;
  raw: string;
}

function parseEnvLines(content: string): { entries: ParsedEnvEntry[]; errors: EnvFinding[] } {
  const lines = content.split(/\r?\n/);
  const entries: ParsedEnvEntry[] = [];
  const errors: EnvFinding[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Skip empty lines or pure comments
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    // Match KEY=VALUE or export KEY=VALUE
    const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) {
      if (trimmed.includes("=")) {
        const potentialKey = trimmed.split("=")[0].trim();
        errors.push({
          line: i + 1,
          key: potentialKey,
          severity: "MEDIUM",
          category: "SYNTAX_ISSUE",
          message: `Variable key contains invalid identifier characters: "${potentialKey}"`,
          recommendation: "Ensure environment variable names only use letters, digits, and underscores.",
        });
      }
      continue;
    }

    const key = match[1];
    let value = match[2];

    // Strip surrounding quotes if matching
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    } else {
      // Remove trailing comments if unquoted (e.g., KEY=val # comment)
      const commentIdx = value.indexOf(" #");
      if (commentIdx !== -1) {
        value = value.slice(0, commentIdx).trim();
      }
    }

    entries.push({
      line: i + 1,
      key,
      value,
      raw: rawLine,
    });
  }

  return { entries, errors };
}

function maskSecret(val: string): string {
  if (val.length <= 8) return "••••••••";
  return val.slice(0, 4) + "••••••••" + val.slice(-4);
}

const WEAK_PASSWORD_PATTERNS = new Set([
  "password",
  "123456",
  "12345678",
  "admin",
  "secret",
  "test",
  "changeme",
  "root",
  "qwerty",
]);

export function auditEnv(envContent: string, exampleContent?: string): EnvAuditResult {
  const { entries, errors } = parseEnvLines(envContent);
  const findings: EnvFinding[] = [...errors];

  const seenKeys = new Map<string, number>();

  for (const entry of entries) {
    const { line, key, value } = entry;

    // 1. Duplicate keys
    if (seenKeys.has(key)) {
      findings.push({
        line,
        key,
        severity: "HIGH",
        category: "DUPLICATE_KEY",
        message: `Duplicate key "${key}" already defined at line ${seenKeys.get(key)}`,
        recommendation: "Remove duplicate definitions; the later entry will silently overwrite earlier ones.",
      });
    } else {
      seenKeys.set(key, line);
    }

    // 2. Empty values
    if (value.trim() === "") {
      findings.push({
        line,
        key,
        severity: "INFO",
        category: "EMPTY_VALUE",
        message: `Variable "${key}" has an empty value`,
        recommendation: "Provide a default or populate the required configuration value.",
      });
      continue;
    }

    // 3. Secret Pattern Scanners
    // AWS Access Key ID
    if (/(?:AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}/.test(value)) {
      findings.push({
        line,
        key,
        severity: "CRITICAL",
        category: "SECRET_LEAK",
        message: `Live AWS Access Key detected in "${key}"`,
        recommendation: "Revoke key in AWS IAM immediately and use AWS Secrets Manager or IAM roles.",
        maskedValue: maskSecret(value),
      });
    }

    // Stripe Live Secret Key
    if (/(?:sk|rk)_live_[0-9a-zA-Z]{24,}/.test(value)) {
      findings.push({
        line,
        key,
        severity: "CRITICAL",
        category: "SECRET_LEAK",
        message: `Live Stripe Secret Key detected in "${key}"`,
        recommendation: "Roll this key in the Stripe dashboard. Never commit live secret keys to version control.",
        maskedValue: maskSecret(value),
      });
    }

    // GitHub Personal Access Token
    if (/gh[pousr]_[0-9a-zA-Z]{36}/.test(value) || /github_pat_[0-9a-zA-Z_]{82}/.test(value)) {
      findings.push({
        line,
        key,
        severity: "CRITICAL",
        category: "SECRET_LEAK",
        message: `GitHub Personal Access Token detected in "${key}"`,
        recommendation: "Revoke token under GitHub Settings > Developer settings > Personal access tokens.",
        maskedValue: maskSecret(value),
      });
    }

    // OpenAI API Key
    if (/sk-(?:proj-|live-)?[a-zA-Z0-9_-]{32,}/.test(value)) {
      findings.push({
        line,
        key,
        severity: "HIGH",
        category: "SECRET_LEAK",
        message: `OpenAI API Key detected in "${key}"`,
        recommendation: "Rotate this key in OpenAI platform dashboard.",
        maskedValue: maskSecret(value),
      });
    }

    // Anthropic API Key
    if (/sk-ant-[a-zA-Z0-9_-]{32,}/.test(value)) {
      findings.push({
        line,
        key,
        severity: "HIGH",
        category: "SECRET_LEAK",
        message: `Anthropic API Key detected in "${key}"`,
        recommendation: "Rotate this key in Anthropic Console.",
        maskedValue: maskSecret(value),
      });
    }

    // Slack Bot/User Token
    if (/xox[baprs]-[0-9a-zA-Z]{10,48}/.test(value)) {
      findings.push({
        line,
        key,
        severity: "HIGH",
        category: "SECRET_LEAK",
        message: `Slack Token detected in "${key}"`,
        recommendation: "Rotate token in Slack API app settings.",
        maskedValue: maskSecret(value),
      });
    }

    // RSA / OpenSSH Private Keys
    if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(value)) {
      findings.push({
        line,
        key,
        severity: "CRITICAL",
        category: "SECRET_LEAK",
        message: `Asymmetric Private Key detected in "${key}"`,
        recommendation: "Store private keys in a secure key vault or file, never unencrypted in environment variables.",
        maskedValue: "•••••[PRIVATE KEY]•••••",
      });
    }

    // Weak / Default Password
    const lowerKey = key.toLowerCase();
    if (
      (lowerKey.includes("pass") || lowerKey.includes("pwd") || lowerKey.includes("secret")) &&
      WEAK_PASSWORD_PATTERNS.has(value.toLowerCase())
    ) {
      findings.push({
        line,
        key,
        severity: "HIGH",
        category: "WEAK_VALUE",
        message: `Weak / default value detected for "${key}": "${value}"`,
        recommendation: "Generate a cryptographically random secret with at least 32 characters.",
      });
    }
  }

  // 4. Comparison against .env.example
  if (exampleContent) {
    const { entries: exampleEntries } = parseEnvLines(exampleContent);
    const exampleKeyMap = new Map<string, number>();
    for (const e of exampleEntries) {
      exampleKeyMap.set(e.key, e.line);
    }

    // Check for variables in .env.example missing from .env
    for (const [eKey] of exampleKeyMap) {
      if (!seenKeys.has(eKey)) {
        findings.push({
          key: eKey,
          severity: "HIGH",
          category: "MISSING_VAR",
          message: `Variable "${eKey}" documented in .env.example is missing from your environment`,
          recommendation: `Add "${eKey}" to your .env file or local environment.`,
        });
      }
    }

    // Check for extra variables in .env not documented in .env.example
    for (const [actualKey, line] of seenKeys) {
      if (!exampleKeyMap.has(actualKey)) {
        findings.push({
          line,
          key: actualKey,
          severity: "LOW",
          category: "EXTRA_VAR",
          message: `Variable "${actualKey}" is present in .env but undocumented in .env.example`,
          recommendation: `Document "${actualKey}" in .env.example for teammates and CI setups.`,
        });
      }
    }
  }

  // Stats calculation
  const stats = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of findings) {
    if (f.severity === "CRITICAL") stats.critical++;
    else if (f.severity === "HIGH") stats.high++;
    else if (f.severity === "MEDIUM") stats.medium++;
    else if (f.severity === "LOW") stats.low++;
    else if (f.severity === "INFO") stats.info++;
  }

  const isSecure = stats.critical === 0 && stats.high === 0;
  const summary = isSecure
    ? `✅ Audit Passed: ${entries.length} variables analyzed. No critical secrets or high-severity vulnerabilities found.`
    : `⚠️ Audit Warning: Found ${stats.critical} critical and ${stats.high} high severity issues out of ${entries.length} variables.`;

  return {
    totalVariables: entries.length,
    findings,
    stats,
    isSecure,
    summary,
  };
}

export function formatEnvAuditReport(result: EnvAuditResult): string {
  const lines: string[] = [];
  lines.push("\n=== CODE STATION ENVIRONMENT AUDIT REPORT ===");
  lines.push(`Total Variables: ${result.totalVariables}`);
  lines.push(
    `Findings: ${result.findings.length} (Critical: ${result.stats.critical}, High: ${result.stats.high}, Medium: ${result.stats.medium}, Low: ${result.stats.low}, Info: ${result.stats.info})`
  );
  lines.push(`Status: ${result.summary}\n`);

  if (result.findings.length === 0) {
    lines.push("✨ Clean! No security issues or synchronization discrepancies detected.\n");
    return lines.join("\n");
  }

  lines.push("--- Detailed Findings ---");
  for (const f of result.findings) {
    const loc = f.line ? `[Line ${f.line}] ` : "";
    const badge = `[${f.severity}]`.padEnd(11);
    lines.push(`${badge} ${loc}${f.key}: ${f.message}`);
    if (f.maskedValue) {
      lines.push(`            Masked: ${f.maskedValue}`);
    }
    lines.push(`            Fix:    ${f.recommendation}`);
  }
  lines.push("");

  return lines.join("\n");
}
