// Calculate native GetSubstitution's length before asking String.replace to
// allocate its result. Substitution itself is always performed by the runtime.
export function replacementLength(replacement: string, match: RegExpExecArray, inputLength: number): number {
  let length = 0;
  for (let index = 0; index < replacement.length; index++) {
    if (replacement[index] !== "$" || index + 1 === replacement.length) {
      length++;
      continue;
    }
    const next = replacement[index + 1];
    if (next === "$") {
      length++;
      index++;
    } else if (next === "&") {
      length += match[0].length;
      index++;
    } else if (next === "`") {
      length += match.index;
      index++;
    } else if (next === "'") {
      length += inputLength - match.index - match[0].length;
      index++;
    } else if (next === "<" && match.groups !== undefined) {
      const end = replacement.indexOf(">", index + 2);
      if (end === -1) {
        length++;
      } else {
        length += match.groups[replacement.slice(index + 2, end)]?.length ?? 0;
        index = end;
      }
    } else if (next >= "0" && next <= "9") {
      let number = Number(next);
      const second = replacement[index + 2];
      let digits = 1;
      if (second !== undefined && second >= "0" && second <= "9") {
        const pair = number * 10 + Number(second);
        if (pair > 0 && pair < match.length) {
          number = pair;
          digits = 2;
        }
      }
      if (number > 0 && number < match.length) {
        length += match[number]?.length ?? 0;
        index += digits;
      } else {
        length++;
      }
    } else {
      length++;
    }
  }
  return length;
}
