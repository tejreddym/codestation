/** Shared, deterministic input bounds for every Git station engine. */
export const GIT_INPUT_LIMIT = 200_000;

export function assertGitInput(value: string, label = "Input"): string {
  if (typeof value !== "string") throw new Error(`${label} must be text.`);
  if (value.length > GIT_INPUT_LIMIT) {
    throw new Error(`${label} exceeds the 200 KB limit (${value.length} characters).`);
  }
  return value;
}
