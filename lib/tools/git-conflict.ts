export type ConflictStrategy = "analyze" | "ours" | "theirs" | "both";

export interface ConflictHunk {
  hunkIndex: number;
  startLine: number;
  endLine: number;
  oursBranch: string;
  theirsBranch: string;
  oursLines: string[];
  theirsLines: string[];
  baseLines?: string[];
}

export interface ConflictResolutionResult {
  hasConflicts: boolean;
  conflictCount: number;
  unresolvedCount: number;
  hunks: ConflictHunk[];
  resolvedContent?: string;
  summary: string;
}

export function parseAndResolveGitConflicts(
  content: string,
  strategy: ConflictStrategy = "analyze"
): ConflictResolutionResult {
  // Normalize mixed line endings (\r\n -> \n)
  const normalized = content.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const hunks: ConflictHunk[] = [];

  let inConflict = false;
  let inBase = false;
  let inTheirs = false;

  let currentHunkStart = 0;
  let currentOursBranch = "";
  let currentTheirsBranch = "";
  let currentOursLines: string[] = [];
  let currentBaseLines: string[] = [];
  let currentTheirsLines: string[] = [];

  const outputLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Conflict start: <<<<<<< branch_name
    if (line.startsWith("<<<<<<<")) {
      if (inConflict) {
        throw new Error(`Malformed Git conflict: Nested <<<<<<< marker at line ${i + 1}`);
      }
      inConflict = true;
      inBase = false;
      inTheirs = false;
      currentHunkStart = i + 1;
      currentOursBranch = line.slice(7).trim() || "HEAD";
      currentOursLines = [];
      currentBaseLines = [];
      currentTheirsLines = [];
      continue;
    }

    // Optional base marker (diff3 format): ||||||| base
    if (inConflict && !inTheirs && line.startsWith("|||||||")) {
      inBase = true;
      continue;
    }

    // Conflict separator: =======
    if (inConflict && !inTheirs && line.startsWith("=======")) {
      inBase = false;
      inTheirs = true;
      continue;
    }

    // Orphan separator outside conflict
    if (!inConflict && (line.startsWith("=======") || line.startsWith(">>>>>>>") || line.startsWith("|||||||"))) {
      throw new Error(`Malformed Git conflict: Unexpected ${line.slice(0, 7)} marker outside of conflict block at line ${i + 1}`);
    }

    // Conflict end: >>>>>>> branch_name
    if (inConflict && inTheirs && line.startsWith(">>>>>>>")) {
      currentTheirsBranch = line.slice(7).trim() || "incoming";
      const hunk: ConflictHunk = {
        hunkIndex: hunks.length + 1,
        startLine: currentHunkStart,
        endLine: i + 1,
        oursBranch: currentOursBranch,
        theirsBranch: currentTheirsBranch,
        oursLines: currentOursLines,
        theirsLines: currentTheirsLines,
        ...(currentBaseLines.length > 0 ? { baseLines: currentBaseLines } : {}),
      };
      hunks.push(hunk);

      // Apply resolution to output
      if (strategy === "ours") {
        outputLines.push(...currentOursLines);
      } else if (strategy === "theirs") {
        outputLines.push(...currentTheirsLines);
      } else if (strategy === "both") {
        outputLines.push(...currentOursLines);
        outputLines.push(...currentTheirsLines);
      }

      inConflict = false;
      inBase = false;
      inTheirs = false;
      continue;
    }

    if (inConflict) {
      if (inTheirs) {
        currentTheirsLines.push(line);
      } else if (inBase) {
        currentBaseLines.push(line);
      } else {
        currentOursLines.push(line);
      }
    } else {
      outputLines.push(line);
    }
  }

  if (inConflict) {
    throw new Error(`Malformed Git conflict: Unclosed conflict marker starting at line ${currentHunkStart}`);
  }

  const hasConflicts = hunks.length > 0;
  const unresolvedCount = strategy === "analyze" ? hunks.length : 0;
  const resolvedContent = strategy !== "analyze" ? outputLines.join("\n") : undefined;

  let summary = "";
  if (!hasConflicts) {
    summary = "No merge conflict markers detected in input.";
  } else if (strategy === "analyze") {
    summary = `Found ${hunks.length} conflict hunk${hunks.length === 1 ? "" : "s"} (${unresolvedCount} unresolved). Inspect branches and choose a resolution strategy (ours, theirs, or both).`;
  } else {
    summary = `Successfully resolved ${hunks.length} conflict hunk${hunks.length === 1 ? "" : "s"} using "${strategy}" strategy. 0 conflicts remaining.`;
  }

  return {
    hasConflicts,
    conflictCount: hunks.length,
    unresolvedCount,
    hunks,
    resolvedContent,
    summary,
  };
}

export function formatConflictReport(result: ConflictResolutionResult): string {
  const lines: string[] = [];
  lines.push("\n=== CODE STATION GIT CONFLICT RESOLVER ===");
  lines.push(`Total Conflicts: ${result.conflictCount}`);
  lines.push(`Unresolved:      ${result.unresolvedCount}`);
  lines.push(`Status:          ${result.summary}\n`);

  if (!result.hasConflicts) {
    return lines.join("\n");
  }

  for (const hunk of result.hunks) {
    lines.push(`[Hunk #${hunk.hunkIndex}] Lines ${hunk.startLine} to ${hunk.endLine}`);
    lines.push(`  Ours (${hunk.oursBranch}):    ${hunk.oursLines.length} lines`);
    lines.push(`  Theirs (${hunk.theirsBranch}): ${hunk.theirsLines.length} lines`);
    if (hunk.baseLines) {
      lines.push(`  Base (diff3):         ${hunk.baseLines.length} lines`);
    }
    lines.push("  Preview Ours:");
    for (const l of hunk.oursLines.slice(0, 3)) {
      lines.push(`    | ${l}`);
    }
    if (hunk.oursLines.length > 3) lines.push(`    | ... (+${hunk.oursLines.length - 3} more lines)`);
    lines.push("  Preview Theirs:");
    for (const l of hunk.theirsLines.slice(0, 3)) {
      lines.push(`    | ${l}`);
    }
    if (hunk.theirsLines.length > 3) lines.push(`    | ... (+${hunk.theirsLines.length - 3} more lines)`);
    lines.push("");
  }

  return lines.join("\n");
}
