import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { saveCachedLicense, validateLicenseKey } from "./config";

export interface SetupResult {
  target: string;
  path: string;
  status: "configured" | "error";
  message?: string;
}

function getClaudeDesktopConfigPath(): string {
  const platform = process.platform;
  if (platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "Claude", "claude_desktop_config.json");
  } else if (platform === "win32") {
    const appData = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
    return path.join(appData, "Claude", "claude_desktop_config.json");
  } else {
    return path.join(os.homedir(), ".config", "Claude", "claude_desktop_config.json");
  }
}

function getCursorGlobalConfigPath(): string {
  return path.join(os.homedir(), ".cursor", "mcp.json");
}

function getWindsurfConfigPath(): string {
  return path.join(os.homedir(), ".codeium", "windsurf", "mcp_config.json");
}

function mergeMcpConfig(filePath: string, mcpEntry: Record<string, unknown>): SetupResult {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    let config: Record<string, any> = {};
    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, "utf-8");
        config = JSON.parse(raw);
      } catch {
        config = {};
      }
    }

    if (!config.mcpServers || typeof config.mcpServers !== "object") {
      config.mcpServers = {};
    }

    config.mcpServers.codestation = mcpEntry;

    fs.writeFileSync(filePath, JSON.stringify(config, null, 2) + "\n", "utf-8");
    return { target: path.basename(filePath), path: filePath, status: "configured" };
  } catch (err) {
    return {
      target: path.basename(filePath),
      path: filePath,
      status: "error",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function runAutoSetup(licenseKey?: string): Promise<SetupResult[]> {
  const cleanKey = licenseKey?.trim();
  if (cleanKey && validateLicenseKey(cleanKey)) {
    saveCachedLicense(cleanKey, true);
  }

  const mcpEntry = {
    command: "npx",
    args: cleanKey ? ["-y", "codestation-mcp", "--key", cleanKey] : ["-y", "codestation-mcp"],
  };

  const targets = [
    { name: "Claude Desktop", path: getClaudeDesktopConfigPath() },
    { name: "Cursor IDE (Global)", path: getCursorGlobalConfigPath() },
    { name: "Windsurf / Codeium", path: getWindsurfConfigPath() },
  ];

  // If inside a project directory with .cursor, also configure local .cursor/mcp.json
  const localCursorPath = path.join(process.cwd(), ".cursor", "mcp.json");
  if (fs.existsSync(path.join(process.cwd(), ".cursor"))) {
    targets.push({ name: "Cursor IDE (Local Project)", path: localCursorPath });
  }

  const results: SetupResult[] = [];
  for (const t of targets) {
    const res = mergeMcpConfig(t.path, mcpEntry);
    res.target = t.name;
    results.push(res);
  }

  return results;
}
