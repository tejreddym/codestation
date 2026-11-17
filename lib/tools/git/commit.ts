import { assertGitInput } from "./limits";

export const CONVENTIONAL_COMMIT_TYPES = [
  "feat",
  "fix",
  "docs",
  "style",
  "refactor",
  "perf",
  "test",
  "build",
  "ci",
  "chore",
  "revert",
] as const;

export type ConventionalCommitType = (typeof CONVENTIONAL_COMMIT_TYPES)[number];

const TYPE_SET: ReadonlySet<string> = new Set(CONVENTIONAL_COMMIT_TYPES);

export interface CommitBuilderInput {
  type: string;
  scope?: string;
  description: string;
  body?: string;
  footer?: string;
  breaking?: boolean;
  breakingDescription?: string;
}

export interface CommitBuildResult {
  message: string;
  hints: string[];
}

export interface ParsedCommit {
  valid: boolean;
  type: string;
  scope?: string;
  description: string;
  breaking: boolean;
  breakingDescription?: string;
  body?: string;
  footer?: string;
  errors: string[];
}

function normalizeBlock(value: string | undefined): string {
  if (!value) return "";
  return value
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+$/, ""))
    .join("\n")
    .replace(/^\n+|\n+$/g, "");
}

const FOOTER_TOKEN = /^(BREAKING[ -]CHANGE|[A-Za-z][A-Za-z-]*):\s+/;

/**
 * Build a Conventional Commit message from explicit fields.
 * Deterministic, bounded, and never executes Git.
 */
export function buildConventionalCommit(input: CommitBuilderInput): CommitBuildResult {
  assertGitInput(input.description ?? "", "Description");
  assertGitInput(input.body ?? "", "Body");
  assertGitInput(input.footer ?? "", "Footer");
  assertGitInput(input.scope ?? "", "Scope");
  assertGitInput(input.breakingDescription ?? "", "Breaking change description");

  const type = (input.type ?? "").trim().toLowerCase();
  if (!type) throw new Error("Choose a commit type.");
  if (!TYPE_SET.has(type)) {
    throw new Error(`Unknown commit type "${type}". Choose one of: ${CONVENTIONAL_COMMIT_TYPES.join(", ")}.`);
  }

  const description = (input.description ?? "").trim().replace(/\s+/g, " ");
  if (!description) throw new Error("Add a short commit description.");

  const scope = (input.scope ?? "").trim();
  if (scope && !/^[a-z0-9][a-z0-9._/-]*$/i.test(scope)) {
    throw new Error("Scope may contain letters, numbers, dots, underscores, slashes and hyphens only.");
  }

  const breaking = Boolean(input.breaking);
  const header = `${type}${scope ? `(${scope})` : ""}${breaking ? "!" : ""}: ${description}`;
  const body = normalizeBlock(input.body);
  let footer = normalizeBlock(input.footer);
  const hints: string[] = [];

  if (description.length > 72) {
    hints.push(`The subject is ${description.length} characters; conventional commits usually stay within 72.`);
  }

  if (breaking && !/(^|\n)BREAKING[ -]CHANGE:/.test(footer)) {
    const note = (input.breakingDescription ?? "").trim().replace(/\s+/g, " ") || description;
    footer = [footer, `BREAKING CHANGE: ${note}`].filter(Boolean).join("\n");
    hints.push("A breaking change adds ! to the header and a BREAKING CHANGE footer.");
  }

  if (!breaking && /(^|\n)BREAKING[ -]CHANGE:/.test(footer)) {
    hints.push("The footer declares a breaking change; add ! to the header for consistency.");
  }

  const message = [header, body, footer].filter(Boolean).join("\n\n");
  return { message, hints };
}

/** Human-readable text used by the UI and WebMCP dispatcher. */
export function formatCommitBuilderOutput(result: CommitBuildResult): string {
  return result.hints.length
    ? `${result.message}\n\nHints:\n${result.hints.map((hint) => `- ${hint}`).join("\n")}`
    : result.message;
}

/** Parse and validate a Conventional Commit message without executing anything. */
export function parseConventionalCommit(message: string): ParsedCommit {
  assertGitInput(message, "Commit message");
  const normalized = message.replace(/\r\n/g, "\n").trim();
  const errors: string[] = [];

  if (!normalized) {
    return { valid: false, type: "", description: "", breaking: false, errors: ["Commit message is empty."] };
  }

  const lines = normalized.split("\n");
  const header = lines[0].trim();
  const match = header.match(/^([A-Za-z][A-Za-z0-9-]*)(?:\(([^()\r\n]+)\))?(!)?: (.+)$/);

  if (!match) {
    return {
      valid: false,
      type: "",
      description: "",
      breaking: false,
      errors: ["Header must match `type(scope): description` with an optional scope."],
    };
  }

  const type = match[1].toLowerCase();
  const scope = match[2]?.trim();
  const bang = Boolean(match[3]);
  const description = match[4].trim();
  const rest = lines.slice(1);

  if (!TYPE_SET.has(type)) {
    errors.push(`"${type}" is not a standard Conventional Commit type (${CONVENTIONAL_COMMIT_TYPES.join(", ")}).`);
  }
  if (scope && !/^[a-z0-9][a-z0-9._/-]*$/i.test(scope)) {
    errors.push("Scope may contain letters, numbers, dots, underscores, slashes and hyphens only.");
  }
  if (!description) errors.push("Description is empty.");

  let body: string | undefined;
  let footer: string | undefined;
  if (rest.length) {
    const footerStart = rest.findIndex((line) => FOOTER_TOKEN.test(line.trim()));
    if (footerStart >= 0) {
      body = normalizeBlock(rest.slice(0, footerStart).join("\n")) || undefined;
      footer = normalizeBlock(rest.slice(footerStart).join("\n")) || undefined;
    } else {
      body = normalizeBlock(rest.join("\n")) || undefined;
    }
  }

  const breakingMatch = footer?.match(/(^|\n)BREAKING[ -]CHANGE:\s*([^\n]+)/);
  const breakingDescription = breakingMatch?.[2]?.trim();
  const breaking = bang || Boolean(breakingMatch);

  return {
    valid: errors.length === 0,
    type,
    ...(scope ? { scope } : {}),
    description,
    breaking,
    ...(breakingDescription ? { breakingDescription } : {}),
    ...(body ? { body } : {}),
    ...(footer ? { footer } : {}),
    errors,
  };
}
