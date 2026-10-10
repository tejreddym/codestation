import { describe, expect, it } from "vitest";
import {
  calculateCidr,
  convertIp,
  searchPorts,
  generateGitignore,
  generateDockerfile,
  dockerRunToCompose,
  parseSemver,
  compareSemver,
} from "./engine";

describe("network and devops engine", () => {
  describe("calculateCidr", () => {
    it("calculates subnet for standard /24 CIDR", () => {
      const res = calculateCidr("192.168.1.50/24");
      expect(res.ip).toBe("192.168.1.50");
      expect(res.cidr).toBe(24);
      expect(res.netmask).toBe("255.255.255.0");
      expect(res.wildcardMask).toBe("0.0.0.255");
      expect(res.networkAddress).toBe("192.168.1.0");
      expect(res.broadcastAddress).toBe("192.168.1.255");
      expect(res.firstUsableHost).toBe("192.168.1.1");
      expect(res.lastUsableHost).toBe("192.168.1.254");
      expect(res.totalHosts).toBe(256);
      expect(res.usableHosts).toBe(254);
      expect(res.ipClass).toBe("C");
      expect(res.scope).toBe("Private (RFC 1918)");
    });

    it("calculates subnet for /32 host", () => {
      const res = calculateCidr("10.0.0.1/32");
      expect(res.usableHosts).toBe(1);
      expect(res.firstUsableHost).toBe("10.0.0.1");
      expect(res.lastUsableHost).toBe("10.0.0.1");
    });

    it("throws on invalid IP or CIDR", () => {
      expect(() => calculateCidr("999.1.1.1/24")).toThrow();
      expect(() => calculateCidr("192.168.1.1/35")).toThrow();
    });
  });

  describe("convertIp", () => {
    it("converts IPv4 to mapped and 6to4 addresses", () => {
      const res = convertIp("192.168.1.1");
      expect(res.inputType).toBe("IPv4");
      expect(res.ipv4Mapped).toBe("::ffff:192.168.1.1");
      expect(res.sixToFour).toBe("2002:c0a8:0101::1");
      expect(res.reverseDns).toBe("1.1.168.192.in-addr.arpa");
    });

    it("expands compressed IPv6", () => {
      const res = convertIp("2001:db8::1");
      expect(res.inputType).toBe("IPv6");
      expect(res.expanded).toBe("2001:0db8:0000:0000:0000:0000:0000:0001");
      expect(res.canonical).toBe("2001:db8::1");
    });
  });

  describe("searchPorts", () => {
    it("finds ports by number and name", () => {
      const ssh = searchPorts("22");
      expect(ssh.some((p) => p.service.includes("SSH"))).toBe(true);

      const db = searchPorts("postgres");
      expect(db.some((p) => p.port === 5432)).toBe(true);
    });
  });

  describe("generateGitignore", () => {
    it("merges selected presets", () => {
      const ignore = generateGitignore(["Node", "macOS"]);
      expect(ignore).toContain("node_modules/");
      expect(ignore).toContain(".DS_Store");
    });
  });

  describe("generateDockerfile", () => {
    it("generates multi-stage Node Dockerfile", () => {
      const df = generateDockerfile({
        language: "node",
        version: "20-alpine",
        port: 3000,
        multiStage: true,
        nonRoot: true,
      });
      expect(df).toContain("FROM node:20-alpine AS builder");
      expect(df).toContain("FROM node:20-alpine AS runner");
      expect(df).toContain("USER node");
      expect(df).toContain("EXPOSE 3000");
    });
  });

  describe("dockerRunToCompose", () => {
    it("converts docker run command to docker-compose.yml", () => {
      const cmd = "docker run -d --name web -p 8080:80 -v /data:/app -e ENV=prod nginx:alpine";
      const compose = dockerRunToCompose(cmd);
      expect(compose).toContain('version: "3.8"');
      expect(compose).toContain("web:");
      expect(compose).toContain("image: nginx:alpine");
      expect(compose).toContain('- "8080:80"');
      expect(compose).toContain("- /data:/app");
      expect(compose).toContain("- ENV=prod");
    });
  });

  describe("semver functions", () => {
    it("parses valid semver and determines increments", () => {
      const parsed = parseSemver("1.2.3");
      expect(parsed.major).toBe(1);
      expect(parsed.minor).toBe(2);
      expect(parsed.patch).toBe(3);
      expect(parsed.nextMajor).toBe("2.0.0");
      expect(parsed.nextMinor).toBe("1.3.0");
      expect(parsed.nextPatch).toBe("1.2.4");
    });

    it("compares versions correctly", () => {
      expect(compareSemver("2.0.0", "1.9.9")).toBe(1);
      expect(compareSemver("1.2.3", "1.2.3")).toBe(0);
      expect(compareSemver("1.2.0", "1.2.1")).toBe(-1);
    });
  });
});
