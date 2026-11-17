import { assertGitInput } from "./limits";

export interface GitFlag {
  flag: string;
  value?: string;
}

export interface GitCommandExplanation {
  command: string;
  subcommand: string;
  flags: GitFlag[];
  risks: string[];
  summary: string;
  note: string;
}

const SUBCOMMAND_SUMMARIES: Record<string, string> = {
  add: "Stage file content for the next commit.",
  am: "Apply mailbox-formatted patches to the working tree and history.",
  apply: "Apply a patch without creating commits.",
  bisect: "Find the commit that introduced a change by binary search.",
  blame: "Show the last commit that changed each line.",
  branch: "List, create, or delete branches.",
  checkout: "Switch branches or restore working-tree files.",
  "cherry-pick": "Replay an existing commit on the current branch.",
  clean: "Remove untracked files from the working tree.",
  clone: "Copy a repository into a new directory.",
  commit: "Record staged changes as a new commit.",
  config: "Read or write repository and user configuration.",
  diff: "Compare file content between commits, the index, and the working tree.",
  fetch: "Download objects and refs from a remote without merging.",
  gc: "Clean up unnecessary files and optimize the local repository.",
  log: "Show commit history.",
  merge: "Join two or more development histories.",
  mv: "Move or rename a tracked file.",
  pull: "Fetch from a remote and integrate the result.",
  push: "Update remote refs with local commits.",
  rebase: "Reapply commits on top of another base.",
  reflog: "Show the local reference update history.",
  remote: "Manage the set of tracked repositories.",
  reset: "Move the current branch pointer and optionally update the index or working tree.",
  restore: "Restore working-tree or staged files from another source.",
  revert: "Create a new commit that undoes an earlier commit.",
  rm: "Remove files from the working tree and the index.",
  show: "Show objects such as commits, tags, and trees.",
  stash: "Save and restore unfinished working-tree changes.",
  status: "Show the working-tree and index state.",
  switch: "Switch branches.",
  tag: "Create, list, or delete tags.",
  worktree: "Manage multiple working trees attached to the same repository.",
};

const DESTRUCTIVE_NOTE = "Static explanation only. Code Station never executes Git commands or touches your repository.";

function tokenize(command: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;

  for (let index = 0; index < command.length; index += 1) {
    const char = command[index];
    if (quote) {
      if (char === quote) {
        quote = null;
      } else if (char === "\\" && quote === '"' && index + 1 < command.length) {
        current += command[index + 1];
        index += 1;
      } else {
        current += char;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
    } else if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
    } else {
      current += char;
    }
  }

  if (quote) throw new Error("Command contains an unclosed quote.");
  if (current) tokens.push(current);
  return tokens;
}

function hasShort(flags: readonly GitFlag[], letter: string): boolean {
  return flags.some(({ flag }) => /^-[^-]/.test(flag) && flag.slice(1).includes(letter));
}

function hasLong(flags: readonly GitFlag[], name: string): boolean {
  return flags.some(({ flag }) => flag === `--${name}`);
}

/**
 * Explain a Git command from its text alone.
 * The parser is structural: it never spawns a process or reads a repository.
 */
export function explainGitCommand(command: string): GitCommandExplanation {
  assertGitInput(command, "Command");
  const trimmed = command.trim();
  if (!trimmed) throw new Error("Enter a Git command to explain.");

  let tokens = tokenize(trimmed);
  if (tokens[0] === "$") tokens = tokens.slice(1);
  if (tokens[0]?.toLowerCase() === "git") tokens = tokens.slice(1);
  if (!tokens.length) throw new Error("Enter a Git subcommand after `git`.");

  const subcommand = tokens[0].startsWith("-") ? "" : tokens[0].toLowerCase();
  const flagTokens = tokens.slice(1).filter((token) => token.startsWith("-"));
  const flags: GitFlag[] = flagTokens.map((token) => {
    const equals = token.indexOf("=");
    return equals > 0 ? { flag: token.slice(0, equals), value: token.slice(equals + 1) } : { flag: token };
  });

  const risks: string[] = [];
  const summary = subcommand
    ? SUBCOMMAND_SUMMARIES[subcommand] ?? `Git subcommand "${subcommand}".`
    : "The command starts with an option rather than a subcommand.";

  if (subcommand === "reset" && hasLong(flags, "hard")) {
    risks.push("`reset --hard` discards uncommitted changes in tracked files. Commits stay recoverable through the reflog.");
  }

  if (subcommand === "clean" && hasShort(flags, "f")) {
    risks.push(
      hasShort(flags, "d")
        ? "`clean -f -d` permanently deletes untracked files and directories. Git cannot recover them."
        : "`clean -f` permanently deletes untracked files. Git cannot recover them."
    );
  }

  if (subcommand === "push") {
    if (hasShort(flags, "f") || hasLong(flags, "force")) {
      risks.push("A forced push rewrites remote history and can overwrite teammates' commits. Prefer `--force-with-lease`.");
    } else if (hasLong(flags, "force-with-lease")) {
      risks.push("`--force-with-lease` can rewrite remote history, but refuses when the remote changed unexpectedly.");
    }
  }

  if (subcommand === "branch" && hasShort(flags, "D")) {
    risks.push("`branch -D` deletes a branch even when it is not merged. Its commits may become unreachable once reflogs expire.");
  }

  if (subcommand === "rebase") {
    risks.push("Rebasing rewrites commit history. Avoid rebasing commits that other people already share.");
  }

  return { command: trimmed, subcommand, flags, risks, summary, note: DESTRUCTIVE_NOTE };
}

/** Human-readable projection for the station UI. */
export function formatGitCommandExplanation(explanation: GitCommandExplanation): string {
  const flagText = explanation.flags.length
    ? explanation.flags.map(({ flag, value }) => (value === undefined ? flag : `${flag}=${value}`)).join(", ")
    : "None";
  const riskText = explanation.risks.length
    ? explanation.risks.map((risk) => `- ${risk}`).join("\n")
    : "- No configured destructive pattern detected.";
  return [
    `Command: ${explanation.command}`,
    `Subcommand: ${explanation.subcommand || "(option only)"}`,
    `Summary: ${explanation.summary}`,
    `Flags: ${flagText}`,
    "Risks:",
    riskText,
    `Note: ${explanation.note}`,
  ].join("\n");
}
