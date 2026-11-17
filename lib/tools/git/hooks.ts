import { assertGitInput } from "./limits";

export const GIT_HOOK_TYPES = ["pre-commit", "commit-msg", "pre-push", "pre-rebase"] as const;
export type GitHookType = (typeof GIT_HOOK_TYPES)[number];

export interface GitHooksInput {
  hook: GitHookType;
  commands: string;
  failFast?: boolean;
}

export interface GitHooksResult {
  filename: string;
  script: string;
  installInstructions: string;
  commandCount: number;
}

const MAX_COMMANDS = 200;
const MAX_COMMAND_LENGTH = 500;

function argumentPrelude(hook: GitHookType): string[] {
  switch (hook) {
    case "commit-msg":
      return [
        'MESSAGE_FILE="${1:-}"',
        'if [ -z "$MESSAGE_FILE" ]; then',
        '  echo "commit-msg: missing commit message file argument." >&2',
        "  exit 1",
        "fi",
      ];
    case "pre-push":
      return ['REMOTE="${1:-}"', 'URL="${2:-}"'];
    case "pre-rebase":
      return ['UPSTREAM="${1:-}"', 'BRANCH="${2:-}"'];
    default:
      return [];
  }
}

/** Generate a reviewable shell hook without executing or evaluating it. */
export function generateGitHook(input: GitHooksInput): GitHooksResult {
  assertGitInput(input.commands ?? "", "Commands");
  const hook = input.hook ?? "pre-commit";
  if (!(GIT_HOOK_TYPES as readonly string[]).includes(hook)) {
    throw new Error(`Choose one of: ${GIT_HOOK_TYPES.join(", ")}.`);
  }

  const commands = (input.commands ?? "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+$/, ""))
    .filter((line) => line.trim());

  if (commands.length > MAX_COMMANDS) {
    throw new Error(`Use at most ${MAX_COMMANDS} hook commands.`);
  }
  for (const line of commands) {
    if (line.length > MAX_COMMAND_LENGTH) {
      throw new Error(`A hook command exceeds ${MAX_COMMAND_LENGTH} characters.`);
    }
    if (line.startsWith("#!")) throw new Error("Remove the shebang; the generator writes the script header.");
  }

  const header = [
    "#!/bin/sh",
    `# Git ${hook} hook generated locally by Code Station.`,
    "# Review every command before installing. Code Station does not run this script.",
    ...(input.failFast === false ? [] : ["set -e"]),
  ];
  const prelude = argumentPrelude(hook);
  const body = commands.length
    ? commands
    : ["# Add one command per line in the generator to fill this hook."];

  const script = [...header, "", ...(prelude.length ? [...prelude, ""] : []), ...body, ""].join("\n");

  const installInstructions = [
    `Save the script as .git/hooks/${hook}, then make it executable:`,
    `chmod +x .git/hooks/${hook}`,
    `The hook applies to the local clone only and is not committed by default.`,
  ].join("\n");

  return { filename: hook, script, installInstructions, commandCount: commands.length };
}
