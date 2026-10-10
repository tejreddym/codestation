import { localDefinition, type LocalField, type LocalDefinition } from "./local-contract";

export const networkToolIds = [
  "cidr-calculator",
  "ipv4-to-ipv6",
  "cert-inspector",
  "port-reference",
  "gitignore-generator",
  "dockerfile-generator",
  "docker-run-to-compose",
  "semver-calculator",
] as const;

export type NetworkToolId = (typeof networkToolIds)[number];

const ipInput: LocalField = {
  name: "input",
  label: "IP & CIDR (e.g. 192.168.1.0/24)",
  control: "text",
};

const certInput: LocalField = {
  name: "input",
  label: "X.509 PEM Certificate",
  control: "textarea",
};

const queryInput: LocalField = {
  name: "query",
  label: "Port or Service Search",
  control: "text",
  optional: true,
};

const dockerCmdInput: LocalField = {
  name: "input",
  label: "Docker Run Command",
  control: "textarea",
};

const semverInput: LocalField = {
  name: "version1",
  label: "SemVer Version (e.g. 1.2.3)",
  control: "text",
};

const notice =
  "100% in-browser network and devops processing. IP addresses, certificates, commands, and configurations are calculated client-side and never sent to any remote server.";

const define = (
  id: NetworkToolId,
  title: string,
  fields: LocalField[],
  outputs: string[],
  defaults: Record<string, unknown> = {},
  extra: string[] = []
): LocalDefinition<NetworkToolId> =>
  localDefinition(id, title, "Network & DevOps", fields, outputs, defaults, [notice, ...extra], "Calculate");

export const networkTools: readonly LocalDefinition<NetworkToolId>[] = [
  define(
    "cidr-calculator",
    "CIDR Subnet Calculator",
    [ipInput],
    ["Subnet mask", "Usable IP range", "Broadcast address", "Total hosts", "Binary representation"],
    { input: "192.168.1.0/24" }
  ),
  define(
    "ipv4-to-ipv6",
    "IPv4 ⇄ IPv6 Converter",
    [{ name: "input", label: "IP Address (IPv4 or IPv6)", control: "text" }],
    ["IPv4-mapped address", "6to4 notation", "Expanded notation", "Compressed notation", "Reverse DNS pointer"],
    { input: "192.168.1.1" }
  ),
  define(
    "cert-inspector",
    "SSL / TLS Certificate Inspector",
    [certInput],
    ["Subject Common Name", "Issuer", "Validity period", "Days until expiry", "Subject Alt Names"],
    {
      input:
        "-----BEGIN CERTIFICATE-----\nMIICojCCAYoCCQDF1s123...\n-----END CERTIFICATE-----",
    }
  ),
  define(
    "port-reference",
    "Common Ports Reference Directory",
    [queryInput],
    ["Port number", "Protocol", "Service name", "Category", "Description"],
    { query: "" }
  ),
  define(
    "gitignore-generator",
    ".gitignore Generator",
    [{ name: "presets", label: "Select Presets", control: "text" }],
    ["Consolidated .gitignore rules"],
    { presets: "Node,macOS,VSCode" }
  ),
  define(
    "dockerfile-generator",
    "Dockerfile Generator",
    [
      { name: "language", label: "Runtime / Framework", control: "select", options: ["Node.js", "Python", "Go", "Rust", "Static Nginx"] },
      { name: "version", label: "Version Tag", control: "text" },
      { name: "port", label: "Exposed Port", control: "text" },
    ],
    ["Production-hardened multi-stage Dockerfile"],
    { language: "Node.js", version: "20-alpine", port: "3000" }
  ),
  define(
    "docker-run-to-compose",
    "Docker Run to Compose",
    [dockerCmdInput],
    ["Valid docker-compose.yml file"],
    {
      input: "docker run -d --name web -p 8080:80 -v /data:/usr/share/nginx/html --restart always nginx:alpine",
    }
  ),
  define(
    "semver-calculator",
    "SemVer Calculator & Comparator",
    [semverInput, { name: "version2", label: "Comparison Version (Optional)", control: "text", optional: true }],
    ["Parsed SemVer parts", "Next Major", "Next Minor", "Next Patch", "Comparison result"],
    { version1: "1.2.3", version2: "2.0.0" }
  ),
];

export const getNetworkDefinition = (id: string) => networkTools.find((tool) => tool.id === id);
export const isNetworkToolId = (id: string): id is NetworkToolId => (networkToolIds as readonly string[]).includes(id);
