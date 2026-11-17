import { assertGitInput } from "./limits";
import { parseConventionalCommit } from "./commit";

export interface ChangelogCommit {
  hash?: string;
  type: string;
  scope?: string;
  description: string;
  breaking: boolean;
  breakingDescription?: string;
  raw: string;
}

export interface ChangelogResult {
  markdown: string;
  commitCount: number;
  breakingCount: number;
}

const GROUP_ORDER = [
  { id: "feat", title: "Features" },
  { id: "fix", title: "Bug Fixes" },
  { id: "perf", title: "Performance" },
  { id: "docs", title: "Documentation" },
  { id: "refactor", title: "Refactoring" },
  { id: "test", title: "Tests" },
  { id: "build", title: "Build System" },
  { id: "ci", title: "Continuous Integration" },
  { id: "chore", title: "Chores" },
  { id: "revert", title: "Reverts" },
  { id: "other", title: "Other Changes" },
] as const;

const TYPE_TO_GROUP: Record<string, string> = {
  feat: "feat",
  fix: "fix",
  perf: "perf",
  docs: "docs",
  refactor: "refactor",
  test: "test",
  build: "build",
  ci: "ci",
  chore: "chore",
  revert: "revert",
};

const MAX_COMMITS = 5_000;
const COMMIT_MARKER = /^commit ([0-9a-f]{7,40})$/i;
const ONELINE = /^([0-9a-f]{7,40})\s+(.+)$/i;

function toCommit(subject: string, hash: string | undefined, bodyText?: string): ChangelogCommit {
  const parsed = parseConventionalCommit(subject);
  const footerBreaking = bodyText?.match(/(^|\n)BREAKING[ -]CHANGE:\s*([^\n]+)/);
  const breaking = parsed.breaking || Boolean(footerBreaking);
  const group = parsed.type && TYPE_TO_GROUP[parsed.type] ? TYPE_TO_GROUP[parsed.type] : "other";

  return {
    ...(hash ? { hash } : {}),
    type: group,
    ...(parsed.scope ? { scope: parsed.scope } : {}),
    description: parsed.description || subject,
    breaking,
    ...(parsed.breakingDescription || footerBreaking?.[2]
      ? { breakingDescription: parsed.breakingDescription ?? footerBreaking?.[2]?.trim() }
      : {}),
    raw: subject,
  };
}

function parseCommitLog(log: string): ChangelogCommit[] {
  const normalized = log.replace(/\r\n/g, "\n").trim();
  if (!normalized) throw new Error("Paste git log output first.");
  const lines = normalized.split("\n");
  const commits: ChangelogCommit[] = [];

  if (lines.some((line) => COMMIT_MARKER.test(line.trim()))) {
    let index = 0;
    while (index < lines.length && commits.length < MAX_COMMITS) {
      const marker = lines[index].trim().match(COMMIT_MARKER);
      if (!marker) {
        index += 1;
        continue;
      }
      const hash = marker[1];
      index += 1;

      while (index < lines.length && lines[index].trim() !== "") index += 1;
      while (index < lines.length && lines[index].trim() === "") index += 1;

      const messageLines: string[] = [];
      while (index < lines.length && !COMMIT_MARKER.test(lines[index].trim())) {
        messageLines.push(lines[index].replace(/^\s{2,4}/, ""));
        index += 1;
      }

      const firstContent = messageLines.findIndex((line) => line.trim());
      if (firstContent < 0) continue;
      const subject = messageLines[firstContent].trim();
      const bodyText = messageLines.slice(firstContent).join("\n").trim();
      commits.push(toCommit(subject, hash, bodyText));
    }
    return commits;
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const oneline = line.match(ONELINE);
    if (oneline) {
      commits.push(toCommit(oneline[2].trim(), oneline[1]));
    } else {
      commits.push(toCommit(line.replace(/^[*\-]\s+/, ""), undefined));
    }
    if (commits.length >= MAX_COMMITS) break;
  }
  return commits;
}

function renderEntry(commit: ChangelogCommit): string {
  const scope = commit.scope ? `**${commit.scope}:** ` : "";
  const hash = commit.hash ? ` (${commit.hash.slice(0, 7)})` : "";
  return `- ${scope}${commit.description}${hash}`;
}

/**
 * Convert pasted `git log` output into grouped Markdown.
 * Supports one-line and full log formats; input is bounded and never executed.
 */
export function generateChangelog(log: string): ChangelogResult {
  assertGitInput(log, "Git log");
  const commits = parseCommitLog(log);
  if (!commits.length) throw new Error("No commits were found in the pasted log.");

  const breaking = commits.filter((commit) => commit.breaking);
  const parts: string[] = ["# Changelog", ""];

  if (breaking.length) {
    parts.push("## Breaking Changes");
    for (const commit of breaking) {
      const detail = commit.breakingDescription ? ` — ${commit.breakingDescription}` : "";
      parts.push(`${renderEntry(commit)}${detail}`);
    }
    parts.push("");
  }

  for (const group of GROUP_ORDER) {
    const entries = commits.filter((commit) => commit.type === group.id);
    if (!entries.length) continue;
    parts.push(`## ${group.title}`);
    for (const commit of entries) parts.push(renderEntry(commit));
    parts.push("");
  }

  return {
    markdown: `${parts.join("\n").trimEnd()}\n`,
    commitCount: commits.length,
    breakingCount: breaking.length,
  };
}
