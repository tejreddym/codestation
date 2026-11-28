// @vitest-environment node
import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

interface McpEnvVar {
  name: string;
  description?: string;
  format?: string;
  isRequired?: boolean;
  isSecret?: boolean;
}

interface McpServerManifest {
  $schema: string;
  name: string;
  title?: string;
  description: string;
  version: string;
  repository?: { url: string; source: string };
  websiteUrl?: string;
  packages: Array<{
    registryType: string;
    registryBaseUrl?: string;
    identifier: string;
    version: string;
    runtimeHint?: string;
    transport: { type: string };
    environmentVariables?: McpEnvVar[];
  }>;
}

describe("Official MCP Registry Manifest (server.json)", () => {
  const rootDir = process.cwd();
  const serverJsonPath = path.join(rootDir, "server.json");
  const pkgJsonPath = path.join(rootDir, "packages/codestation-mcp/package.json");

  const serverManifest = JSON.parse(
    fs.readFileSync(serverJsonPath, "utf-8")
  ) as McpServerManifest;
  const mcpPkg = JSON.parse(
    fs.readFileSync(pkgJsonPath, "utf-8")
  ) as { name: string; mcpName?: string; version: string };

  it("matches npm package mcpName and semver version across server.json and packages/codestation-mcp", () => {
    expect(serverManifest.$schema).toBe(
      "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json"
    );
    expect(mcpPkg.mcpName).toBe("io.github.tejreddym/codestation");
    expect(serverManifest.name).toBe(mcpPkg.mcpName);
    expect(serverManifest.name).toMatch(/^[a-zA-Z0-9.-]+\/[a-zA-Z0-9._-]+$/);

    expect(serverManifest.packages.length).toBeGreaterThanOrEqual(1);
    expect(serverManifest.version).toBe(mcpPkg.version);
    expect(serverManifest.packages[0].version).toBe(mcpPkg.version);
    expect(serverManifest.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("enforces official MCP Registry schema limits and package/transport fields", () => {
    expect(serverManifest.description.length).toBeGreaterThan(0);
    expect(serverManifest.description.length).toBeLessThanOrEqual(100);
    expect(serverManifest.title).toBe("Code Station MCP");
    expect(serverManifest.repository).toEqual({
      url: "https://github.com/tejreddym/codestation",
      source: "github",
    });
    expect(serverManifest.websiteUrl).toBe("https://codestation.in/docs");

    const npmPkg = serverManifest.packages[0];
    expect(npmPkg.registryType).toBe("npm");
    expect(npmPkg.identifier).toBe("codestation-mcp");
    expect(npmPkg.transport).toEqual({ type: "stdio" });

    const envVars = npmPkg.environmentVariables ?? [];
    const licenseVar = envVars.find((v) => v.name === "CODESTATION_LICENSE_KEY");
    const stationsVar = envVars.find((v) => v.name === "CODESTATION_MCP_STATIONS");

    expect(licenseVar).toBeDefined();
    expect(licenseVar?.isRequired).toBe(false);
    expect(licenseVar?.isSecret).toBe(true);

    expect(stationsVar).toBeDefined();
    expect(stationsVar?.isRequired).toBe(false);
    expect(stationsVar?.isSecret).toBe(false);
  });
});
