export type EnvSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
export type EnvConfidence = "HIGH" | "MEDIUM" | "LOW";

export type EnvCategory =
  | "SECRET_LEAK"
  | "MISSING_VAR"
  | "EXTRA_VAR"
  | "WEAK_VALUE"
  | "DUPLICATE_KEY"
  | "EMPTY_VALUE"
  | "SYNTAX_ISSUE"
  | "HIGH_ENTROPY";

export interface EnvFinding {
  line?: number;
  key: string;
  severity: EnvSeverity;
  confidence: EnvConfidence;
  category: EnvCategory;
  message: string;
  recommendation: string;
  maskedValue?: string;
  filePath?: string;
}

export interface EnvAuditOptions {
  example?: string;
  filePath?: string;
  ignoreRules?: string[];
}

export interface EnvAuditResult {
  filePath?: string;
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

// Calculate Shannon entropy to detect high-randomness secret strings
function calculateEntropy(str: string): number {
  if (!str || str.length === 0) return 0;
  const frequencies = new Map<string, number>();
  for (const char of str) {
    frequencies.set(char, (frequencies.get(char) || 0) + 1);
  }
  let entropy = 0;
  const len = str.length;
  for (const count of frequencies.values()) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

export function maskSecret(val: string): string {
  if (!val) return "••••••••";
  if (val.length <= 8) return "••••••••";
  return val.slice(0, 4) + "••••••••" + val.slice(-4);
}

function parseInputLines(content: string): { entries: ParsedEnvEntry[]; errors: EnvFinding[] } {
  const trimmedContent = content.trim();

  // 1. Check if input is JSON
  if (trimmedContent.startsWith("{") && trimmedContent.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmedContent);
      const entries: ParsedEnvEntry[] = [];
      let lineNum = 1;
      for (const [key, value] of Object.entries(parsed)) {
        entries.push({
          line: lineNum++,
          key,
          value: typeof value === "object" ? JSON.stringify(value) : String(value ?? ""),
          raw: `${key}: ${value}`,
        });
      }
      return { entries, errors: [] };
    } catch {
      // Fall through to regular line-by-line parsing
    }
  }

  const lines = content.split(/\r?\n/);
  const entries: ParsedEnvEntry[] = [];
  const errors: EnvFinding[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Skip empty lines or pure comments
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) {
      continue;
    }

    // Support:
    // 1. KEY=VALUE or export KEY=VALUE
    // 2. YAML: key: value
    // 3. TOML: key = "value"
    let key = "";
    let value = "";

    const envMatch = trimmed.match(/^(?:export\s+)?([A-Za-z0-9_.-]+)\s*=\s*(.*)$/);
    const yamlMatch = trimmed.match(/^([A-Za-z0-9_.-]+)\s*:\s*(.*)$/);

    if (envMatch) {
      key = envMatch[1];
      value = envMatch[2];
    } else if (yamlMatch && !trimmed.startsWith("-")) {
      key = yamlMatch[1];
      value = yamlMatch[2];
    } else {
      if (trimmed.includes("=")) {
        const potentialKey = trimmed.split("=")[0].trim();
        errors.push({
          line: i + 1,
          key: potentialKey,
          severity: "MEDIUM",
          confidence: "LOW",
          category: "SYNTAX_ISSUE",
          message: `Variable key contains invalid identifier characters: "${potentialKey}"`,
          recommendation: "Ensure environment variable names only use letters, digits, underscores, and hyphens.",
        });
      }
      continue;
    }

    // Strip surrounding quotes if present
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

export function auditEnv(
  envContent: string,
  exampleOrOptions?: string | EnvAuditOptions
): EnvAuditResult {
  // Safe limit: truncate if exceeding 500KB
  const safeContent = envContent.length > 500_000 ? envContent.slice(0, 500_000) : envContent;

  let exampleContent: string | undefined;
  let filePath: string | undefined;
  let ignoreRules: string[] = [];

  if (typeof exampleOrOptions === "string") {
    exampleContent = exampleOrOptions;
  } else if (exampleOrOptions) {
    exampleContent = exampleOrOptions.example;
    filePath = exampleOrOptions.filePath;
    ignoreRules = exampleOrOptions.ignoreRules || [];
  }

  const { entries, errors } = parseInputLines(safeContent);
  const findings: EnvFinding[] = errors.map(e => ({ ...e, filePath }));

  const seenKeys = new Map<string, number>();

  const isIgnored = (key: string): boolean => {
    return ignoreRules.some(rule => {
      if (rule.endsWith("*")) {
        return key.startsWith(rule.slice(0, -1));
      }
      return key === rule;
    });
  };

  for (const entry of entries) {
    const { line, key, value } = entry;

    if (isIgnored(key)) {
      continue;
    }

    // 1. Duplicate keys
    if (seenKeys.has(key)) {
      findings.push({
        filePath,
        line,
        key,
        severity: "HIGH",
        confidence: "HIGH",
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
        filePath,
        line,
        key,
        severity: "INFO",
        confidence: "HIGH",
        category: "EMPTY_VALUE",
        message: `Variable "${key}" has an empty value`,
        recommendation: "Provide a default or populate the required configuration value.",
      });
      continue;
    }

    // 3. Secret Pattern Scanners

    // Private Keys (including "-----BEGIN TEST KEY-----", RSA, EC, OPENSSH)
    if (/-----BEGIN\s+[A-Z\s]+KEY-----/i.test(value) || /-----BEGIN\s+PRIVATE\s+KEY-----/i.test(value)) {
      findings.push({
        filePath,
        line,
        key,
        severity: "CRITICAL",
        confidence: "HIGH",
        category: "SECRET_LEAK",
        message: `Asymmetric Private Key detected in "${key}"`,
        recommendation: "Store private keys in a secure key vault or file, never unencrypted in configuration files.",
        maskedValue: "•••••[PRIVATE KEY]•••••",
      });
    }

    // AWS Access Key ID
    if (/(?:AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}/.test(value)) {
      findings.push({
        filePath,
        line,
        key,
        severity: "CRITICAL",
        confidence: "HIGH",
        category: "SECRET_LEAK",
        message: `Live AWS Access Key detected in "${key}"`,
        recommendation: "Revoke key in AWS IAM immediately and use AWS Secrets Manager or IAM roles.",
        maskedValue: maskSecret(value),
      });
    }

    // Stripe Live Secret Key
    if (/(?:sk|rk)_live_[0-9a-zA-Z]{24,}/.test(value)) {
      findings.push({
        filePath,
        line,
        key,
        severity: "CRITICAL",
        confidence: "HIGH",
        category: "SECRET_LEAK",
        message: `Live Stripe Secret Key detected in "${key}"`,
        recommendation: "Roll this key in the Stripe dashboard. Never commit live secret keys to version control.",
        maskedValue: maskSecret(value),
      });
    }

    // GitHub Personal Access Token
    if (/gh[pousr]_[0-9a-zA-Z]{36}/.test(value) || /github_pat_[0-9a-zA-Z_]{82}/.test(value)) {
      findings.push({
        filePath,
        line,
        key,
        severity: "CRITICAL",
        confidence: "HIGH",
        category: "SECRET_LEAK",
        message: `GitHub Personal Access Token detected in "${key}"`,
        recommendation: "Revoke token under GitHub Settings > Developer settings > Personal access tokens.",
        maskedValue: maskSecret(value),
      });
    }

    // Database Connection URL with credentials
    if (/^(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^:\s]+:[^@\s]+@[^\s]+/i.test(value)) {
      findings.push({
        filePath,
        line,
        key,
        severity: "HIGH",
        confidence: "HIGH",
        category: "SECRET_LEAK",
        message: `Database connection string containing embedded credentials detected in "${key}"`,
        recommendation: "Use environment variables for user/password separately or store connection strings in a secure secret manager.",
        maskedValue: maskSecret(value),
      });
    }

    // OpenAI API Key
    if (/sk-(?:proj-|live-)?[a-zA-Z0-9_-]{32,}/.test(value)) {
      findings.push({
        filePath,
        line,
        key,
        severity: "HIGH",
        confidence: "HIGH",
        category: "SECRET_LEAK",
        message: `OpenAI API Key detected in "${key}"`,
        recommendation: "Rotate this key in OpenAI platform dashboard.",
        maskedValue: maskSecret(value),
      });
    }

    // Anthropic API Key
    if (/sk-ant-[a-zA-Z0-9_-]{32,}/.test(value)) {
      findings.push({
        filePath,
        line,
        key,
        severity: "HIGH",
        confidence: "HIGH",
        category: "SECRET_LEAK",
        message: `Anthropic API Key detected in "${key}"`,
        recommendation: "Rotate this key in Anthropic Console.",
        maskedValue: maskSecret(value),
      });
    }

    // Slack Bot/User Token
    if (/xox[baprs]-[0-9a-zA-Z]{10,48}/.test(value)) {
      findings.push({
        filePath,
        line,
        key,
        severity: "HIGH",
        confidence: "HIGH",
        category: "SECRET_LEAK",
        message: `Slack Token detected in "${key}"`,
        recommendation: "Rotate token in Slack API app settings.",
        maskedValue: maskSecret(value),
      });
    }

    // Weak / Default Password
    const lowerKey = key.toLowerCase();
    if (
      (lowerKey.includes("pass") || lowerKey.includes("pwd") || lowerKey.includes("secret")) &&
      WEAK_PASSWORD_PATTERNS.has(value.toLowerCase())
    ) {
      findings.push({
        filePath,
        line,
        key,
        severity: "HIGH",
        confidence: "HIGH",
        category: "WEAK_VALUE",
        message: `Weak / default value detected for "${key}": "${value}"`,
        recommendation: "Generate a cryptographically random secret with at least 32 characters.",
      });
    }

    // High Entropy strings (> 24 chars, entropy > 4.5, not a known URL/path)
    if (
      value.length >= 24 &&
      !value.includes("/") &&
      !value.includes(" ") &&
      calculateEntropy(value) > 4.5 &&
      !findings.some(f => f.line === line && f.category === "SECRET_LEAK")
    ) {
      findings.push({
        filePath,
        line,
        key,
        severity: "MEDIUM",
        confidence: "MEDIUM",
        category: "HIGH_ENTROPY",
        message: `High-entropy random token detected in "${key}"`,
        recommendation: "Verify whether this is a sensitive API key or token that should be stored in a secret manager.",
        maskedValue: maskSecret(value),
      });
    }
  }

  // 4. Comparison against .env.example
  if (exampleContent) {
    const { entries: exampleEntries } = parseInputLines(exampleContent);
    const exampleKeyMap = new Map<string, number>();
    for (const e of exampleEntries) {
      exampleKeyMap.set(e.key, e.line);
    }

    // Check for variables in .env.example missing from .env
    for (const [eKey] of exampleKeyMap) {
      if (!seenKeys.has(eKey)) {
        findings.push({
          filePath,
          key: eKey,
          severity: "HIGH",
          confidence: "HIGH",
          category: "MISSING_VAR",
          message: `Variable "${eKey}" documented in .env.example is missing from your environment`,
          recommendation: `Add "${eKey}" to your .env file or local environment.`,
        });
      }
    }

    // Check for extra variables in .env not documented in .env.example
    for (const [aKey, aLine] of seenKeys) {
      if (!exampleKeyMap.has(aKey) && !isIgnored(aKey)) {
        findings.push({
          filePath,
          line: aLine,
          key: aKey,
          severity: "LOW",
          confidence: "MEDIUM",
          category: "EXTRA_VAR",
          message: `Variable "${aKey}" exists in environment but is not documented in .env.example`,
          recommendation: `Document "${aKey}" in .env.example with an empty or placeholder value.`,
        });
      }
    }
  }

  const stats = {
    critical: findings.filter((f) => f.severity === "CRITICAL").length,
    high: findings.filter((f) => f.severity === "HIGH").length,
    medium: findings.filter((f) => f.severity === "MEDIUM").length,
    low: findings.filter((f) => f.severity === "LOW").length,
    info: findings.filter((f) => f.severity === "INFO").length,
  };

  const isSecure = stats.critical === 0 && stats.high === 0;

  let summary = "";
  if (findings.length === 0) {
    summary = "No environment or secret leak issues detected. Environment is clean.";
  } else if (isSecure) {
    summary = `Environment audit passed with ${findings.length} minor notice${findings.length === 1 ? "" : "s"} (${stats.medium} medium, ${stats.low} low, ${stats.info} info).`;
  } else {
    summary = `Security Alert: Found ${stats.critical} critical and ${stats.high} high severity finding${stats.critical + stats.high === 1 ? "" : "s"} that require remediation.`;
  }

  return {
    filePath,
    totalVariables: seenKeys.size,
    findings,
    stats,
    isSecure,
    summary,
  };
}

export function formatEnvAuditReport(result: EnvAuditResult): string {
  const lines: string[] = [];
  lines.push("\n=== CODE STATION ENVIRONMENT AUDIT REPORT ===");
  if (result.filePath) {
    lines.push(`File:            ${result.filePath}`);
  }
  lines.push(`Total Variables: ${result.totalVariables}`);
  lines.push(`Security Status: ${result.isSecure ? "PASS (Secure)" : "FAIL (Action Required)"}`);
  lines.push(
    `Breakdown:       ${result.stats.critical} Critical, ${result.stats.high} High, ${result.stats.medium} Medium, ${result.stats.low} Low, ${result.stats.info} Info\n`
  );

  if (result.findings.length === 0) {
    lines.push("✓ No leaked secrets or environment discrepancies found.\n");
    return lines.join("\n");
  }

  for (const f of result.findings) {
    const loc = f.line ? ` (Line ${f.line})` : "";
    const masked = f.maskedValue ? ` [Value: ${f.maskedValue}]` : "";
    lines.push(`[${f.severity}] ${f.key}${loc}: ${f.message}${masked}`);
    lines.push(`  → Recommendation: ${f.recommendation}\n`);
  }

  return lines.join("\n");
}
