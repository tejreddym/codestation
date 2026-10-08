import type { RegexDefinition } from "./types";

interface GroupSpan {
  kind: RegexDefinition["kind"];
  number?: number;
  name?: string;
  start: number;
  end: number;
}

// This scanner supplies source locations only. Native RegExp compilation must
// succeed first; the scanner neither validates nor implements another dialect.
export function scanGroups(pattern: string): GroupSpan[] {
  const groups: GroupSpan[] = [];
  const stack: GroupSpan[] = [];
  let inClass = false;
  let captureNumber = 0;
  for (let index = 0; index < pattern.length; index++) {
    const character = pattern[index];
    if (character === "\\") {
      index++;
      continue;
    }
    if (character === "[" && !inClass) {
      inClass = true;
      continue;
    }
    if (character === "]" && inClass) {
      inClass = false;
      continue;
    }
    if (inClass) continue;
    if (character === "(") {
      const group: GroupSpan = { kind: "capturing", start: index, end: pattern.length };
      if (pattern[index + 1] !== "?") {
        group.number = ++captureNumber;
      } else if (pattern[index + 2] === ":") {
        group.kind = "non-capturing";
      } else if (pattern[index + 2] === "=" || pattern[index + 2] === "!") {
        group.kind = "lookahead";
      } else if (pattern[index + 2] === "<" && (pattern[index + 3] === "=" || pattern[index + 3] === "!")) {
        group.kind = "lookbehind";
      } else if (pattern[index + 2] === "<") {
        group.kind = "named";
        group.number = ++captureNumber;
        const nameEnd = pattern.indexOf(">", index + 3);
        group.name = pattern.slice(index + 3, nameEnd).replace(/\\u(?:\{([\da-fA-F]+)\}|([\da-fA-F]{4}))/g, (_escape, point: string | undefined, unit: string | undefined) => String.fromCodePoint(parseInt(point ?? unit!, 16)));
        // Do not inspect syntax-looking characters in an escaped group name.
        index = nameEnd;
      } else {
        // Native engines that support modifier groups treat them as noncaptures.
        group.kind = "non-capturing";
      }
      groups.push(group);
      stack.push(group);
    } else if (character === ")") {
      const group = stack.pop();
      if (group) group.end = index + 1;
    }
  }
  return groups;
}
