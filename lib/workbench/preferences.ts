export type Preferences = { favorites: string[]; recent: string[]; rememberRecent: boolean; autoDetect: boolean; autoOpenSingle: boolean };
export const preferenceKey = "code-station-workbench-v1";
export const defaultPreferences: Preferences = { favorites: [], recent: [], rememberRecent: true, autoDetect: false, autoOpenSingle: true };
export function parsePreferences(raw: string | null, allowed: ReadonlySet<string>): Preferences {
  try {
    const value = JSON.parse(raw ?? "null");
    if (!value || typeof value !== "object") return { ...defaultPreferences };
    const list = (key: string, limit: number) => Array.isArray(value[key]) ? [...new Set<string>(value[key].filter((id: unknown) => typeof id === "string" && allowed.has(id)))].slice(0, limit) : [];
    return { favorites: list("favorites", 100), recent: list("recent", 12), rememberRecent: value.rememberRecent !== false, autoDetect: value.autoDetect === true, autoOpenSingle: value.autoOpenSingle !== false };
  } catch { return { ...defaultPreferences }; }
}
