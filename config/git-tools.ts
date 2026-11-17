import { localDefinition, type LocalField, type LocalDefinition } from "./local-contract";

export const gitToolIds = [
  "conventional-commit-builder",
  "conventional-commit-validator",
  "git-command-explainer",
  "changelog-generator",
  "gitattributes-generator",
  "git-hooks-generator",
] as const;

export type GitToolId = (typeof gitToolIds)[number];

const notice =
  "Git station tools format, validate, and explain text locally. No repository is read, no Git command is executed, and no input is uploaded, logged, or persisted.";

const define = (
  id: GitToolId,
  title: string,
  fields: LocalField[],
  outputs: string[],
  defaults: Record<string, unknown>,
  action: string,
  keywords: string[],
  relatedTools: string[]
): LocalDefinition<GitToolId> => {
  const definition = localDefinition(id, title, "Git & Version Control", fields, outputs, defaults, [notice], action);
  return {
    ...definition,
    keywords: [...new Set([...definition.keywords, ...keywords])],
    relatedTools,
  };
};

export const gitTools: readonly LocalDefinition<GitToolId>[] = [
  define(
    "conventional-commit-builder",
    "Conventional Commit Builder",
    [
      {
        name: "type",
        label: "Commit type",
        control: "select",
        options: ["feat", "fix", "docs", "style", "refactor", "perf", "test", "build", "ci", "chore", "revert"],
      },
      { name: "scope", label: "Scope (optional)", control: "text", optional: true },
      { name: "description", label: "Short description", control: "text" },
      { name: "body", label: "Body (optional)", control: "textarea", optional: true },
      { name: "footer", label: "Footer (optional)", control: "textarea", optional: true },
      { name: "breaking", label: "Breaking change", control: "checkbox", optional: true },
      { name: "breakingDescription", label: "Breaking change note (optional)", control: "text", optional: true },
    ],
    ["Formatted conventional commit message", "Review hints"],
    {
      type: "feat",
      scope: "",
      description: "add a concise summary",
      body: "",
      footer: "",
      breaking: false,
      breakingDescription: "",
    },
    "Build",
    ["git commit", "commit message", "conventional commits", "feat", "fix", "breaking change", "scope", "semantic commit"],
    ["conventional-commit-validator", "changelog-generator", "git-hooks-generator"]
  ),
  define(
    "conventional-commit-validator",
    "Conventional Commit Validator",
    [
      {
        name: "message",
        label: "Commit message",
        control: "textarea",
      },
    ],
    ["Parsed type, scope and description", "Breaking change state", "Footer", "Validation errors"],
    {
      message:
        "feat(api): add cursor pagination\n\nAdds deterministic cursor pagination.\n\nBREAKING CHANGE: Response shape changed.",
    },
    "Validate",
    ["git commit", "validate commit", "conventional commits", "lint commit", "commitlint", "commit format"],
    ["conventional-commit-builder", "changelog-generator", "git-hooks-generator"]
  ),
  define(
    "git-command-explainer",
    "Git Command Explainer",
    [
      {
        name: "command",
        label: "Git command",
        control: "text",
      },
    ],
    ["Command summary", "Subcommand and flags", "Destructive-risk notes"],
    { command: "git reset --hard HEAD~1" },
    "Explain",
    ["git command", "explain git", "reset hard", "clean -fd", "force push", "rebase", "branch -D", "safe git"],
    ["conventional-commit-builder", "git-hooks-generator", "changelog-generator"]
  ),
  define(
    "changelog-generator",
    "Git Changelog Generator",
    [
      {
        name: "log",
        label: "Pasted git log output",
        control: "textarea",
      },
    ],
    ["Grouped Markdown changelog", "Breaking Changes section", "Commit and breaking-change counts"],
    {
      log: [
        "a1b2c3d feat(api): add export endpoint",
        "b2c3d4e fix: handle empty payloads",
        "c3d4e5f feat!: remove legacy route",
        "d4e5f6a docs: document the API",
      ].join("\n"),
    },
    "Generate",
    ["changelog", "release notes", "git log", "markdown changelog", "conventional commits", "breaking changes"],
    ["conventional-commit-validator", "conventional-commit-builder", "gitattributes-generator"]
  ),
  define(
    "gitattributes-generator",
    "Git Attributes Generator",
    [
      { name: "eol", label: "Line-ending policy", control: "select", options: ["auto", "lf", "crlf", "preserve"] },
      { name: "binaryGlobs", label: "Binary globs", control: "textarea", optional: true },
      { name: "linguistGlobs", label: "Linguist globs", control: "textarea", optional: true },
      {
        name: "linguistFlag",
        label: "Linguist flag",
        control: "select",
        options: ["none", "generated", "vendored", "documentation"],
      },
      { name: "exportIgnore", label: "Export-ignore patterns", control: "textarea", optional: true },
    ],
    [".gitattributes content", "Binary and linguist rules", "Export-ignore rules"],
    {
      eol: "auto",
      binaryGlobs: "*.png\n*.jpg\n*.pdf",
      linguistGlobs: "dist/**",
      linguistFlag: "generated",
      exportIgnore: "docs/**\n.github/**",
    },
    "Generate",
    ["gitattributes", "line endings", "text eol", "binary files", "linguist", "export-ignore", "git config"],
    ["git-hooks-generator", "gitignore-generator", "changelog-generator"]
  ),
  define(
    "git-hooks-generator",
    "Git Hooks Generator",
    [
      {
        name: "hook",
        label: "Hook type",
        control: "select",
        options: ["pre-commit", "commit-msg", "pre-push", "pre-rebase"],
      },
      { name: "commands", label: "Commands (one per line)", control: "textarea" },
      { name: "failFast", label: "Stop on first failure", control: "checkbox", optional: true },
    ],
    ["Shell hook script", "Install instructions"],
    { hook: "pre-commit", commands: "npm run lint\nnpm test", failFast: true },
    "Generate",
    ["git hooks", "pre-commit", "commit-msg", "pre-push", "pre-rebase", "shell script", "husky alternative"],
    ["conventional-commit-validator", "gitattributes-generator", "conventional-commit-builder"]
  ),
];

export const getGitDefinition = (id: string) => gitTools.find((tool) => tool.id === id);

export const isGitToolId = (id: string): id is GitToolId => (gitToolIds as readonly string[]).includes(id);
