import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lock = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf8"));
const candidates = ["LICENSE", "LICENSE.md", "LICENSE.txt", "COPYING", "COPYING.md", "NOTICE", "NOTICE.md"];
const normalizeNotice = (value) => value.replace(/\r\n?/g, "\n").replace(/[ \t]+$/gm, "").trim();
const entries = [];
for (const [location, record] of Object.entries(lock.packages ?? {})) {
  if (!location.startsWith("node_modules/") || record.dev === true) continue;
  const packageDir = path.join(root, location);
  const packageFile = path.join(packageDir, "package.json");
  if (!fs.existsSync(packageFile)) continue;
  const packageJson = JSON.parse(fs.readFileSync(packageFile, "utf8"));
  const licenseFile = candidates.find((name) => fs.existsSync(path.join(packageDir, name)));
  entries.push({ name: packageJson.name ?? location.slice("node_modules/".length), version: packageJson.version ?? record.version ?? "unknown", label: packageJson.license ?? record.license ?? "unspecified", text: licenseFile ? normalizeNotice(fs.readFileSync(path.join(packageDir, licenseFile), "utf8")) : undefined, file: licenseFile });
}
entries.sort((a, b) => `${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`));
const lines = ["# Third-Party Notices", "", "Generated from the production dependency closure in `package-lock.json` and installed package license files. Run `node scripts/generate-third-party-notices.mjs` after dependency changes.", "", "License labels are metadata; where an exact license file was not found, the entry is explicitly unresolved and requires owner review.", ""];
for (const entry of entries) {
  lines.push(`## ${entry.name} ${entry.version}`, "", `Declared license: ${entry.label}`);
  if (entry.text) lines.push(`Source file: ${entry.file}`, "", "```text", entry.text, "```");
  else lines.push("", "**UNRESOLVED: no license text file was found in the installed package.**");
  lines.push("");
}
lines.push("## Project and asset gaps", "", "No root project license was found. The provenance and license of the illustrated theme toggle have not been verified. These are owner decisions, not inferred permissions.", "");
const output = `${lines.join("\n").replace(/\n+$/, "")}\n`;
fs.writeFileSync(path.join(root, "THIRD_PARTY_NOTICES.md"), output);
fs.mkdirSync(path.join(root, "public"), { recursive: true });
fs.writeFileSync(path.join(root, "public", "THIRD_PARTY_NOTICES.md"), output);
