/**
 * Code Station: Network, DevOps & Cloud Engine
 * 100% In-browser bit-arithmetic, DER/ASN.1 parsing, and config generation.
 */

/** ----------------------------------------------------
 * 1. CIDR Subnet Calculator
 * --------------------------------------------------- */
export interface CidrResult {
  ip: string;
  cidr: number;
  netmask: string;
  wildcardMask: string;
  networkAddress: string;
  broadcastAddress: string;
  firstUsableHost: string;
  lastUsableHost: string;
  totalHosts: number;
  usableHosts: number;
  ipClass: "A" | "B" | "C" | "D" | "E";
  scope: "Private (RFC 1918)" | "Public" | "Loopback" | "Link-Local" | "Carrier-Grade NAT" | "Reserved";
  binaryIp: string;
  binaryNetmask: string;
  hexIp: string;
}

function ipToLong(ip: string): number {
  const parts = ip.trim().split(".");
  if (parts.length !== 4) throw new Error(`Invalid IPv4 address: ${ip}`);
  let num = 0;
  for (const part of parts) {
    const octet = parseInt(part, 10);
    if (isNaN(octet) || octet < 0 || octet > 255) {
      throw new Error(`Invalid octet ${part} in IP ${ip}`);
    }
    num = (num << 8) | octet;
  }
  return num >>> 0;
}

function longToIp(long: number): string {
  return [
    (long >>> 24) & 255,
    (long >>> 16) & 255,
    (long >>> 8) & 255,
    long & 255,
  ].join(".");
}

function toBinaryString(long: number): string {
  const s = (long >>> 0).toString(2).padStart(32, "0");
  return `${s.slice(0, 8)}.${s.slice(8, 16)}.${s.slice(16, 24)}.${s.slice(24, 32)}`;
}

export function calculateCidr(input: string): CidrResult {
  const trimmed = input.trim();
  const [ipPart, maskPart] = trimmed.split("/");

  if (!ipPart) throw new Error("Please provide an IP address");

  const ipLong = ipToLong(ipPart);

  let cidr = 24;
  if (maskPart !== undefined) {
    if (maskPart.includes(".")) {
      // Netmask provided as dotted quad e.g. 255.255.255.0
      const maskLong = ipToLong(maskPart);
      const bin = (maskLong >>> 0).toString(2);
      if (/^1*0*$/.test(bin)) {
        cidr = (bin.match(/1/g) || []).length;
      } else {
        throw new Error(`Invalid netmask: ${maskPart}`);
      }
    } else {
      const parsedCidr = parseInt(maskPart, 10);
      if (isNaN(parsedCidr) || parsedCidr < 0 || parsedCidr > 32) {
        throw new Error("CIDR prefix must be between 0 and 32");
      }
      cidr = parsedCidr;
    }
  }

  const netmaskLong = cidr === 0 ? 0 : (~0 << (32 - cidr)) >>> 0;
  const wildcardLong = ~netmaskLong >>> 0;
  const networkLong = (ipLong & netmaskLong) >>> 0;
  const broadcastLong = (networkLong | wildcardLong) >>> 0;

  const totalHosts = Math.pow(2, 32 - cidr);
  let usableHosts = 0;
  let firstUsableLong = networkLong;
  let lastUsableLong = broadcastLong;

  if (cidr === 32) {
    usableHosts = 1;
    firstUsableLong = networkLong;
    lastUsableLong = networkLong;
  } else if (cidr === 31) {
    // RFC 3021 point-to-point links
    usableHosts = 2;
    firstUsableLong = networkLong;
    lastUsableLong = broadcastLong;
  } else {
    usableHosts = totalHosts - 2;
    firstUsableLong = networkLong + 1;
    lastUsableLong = broadcastLong - 1;
  }

  const firstOctet = (ipLong >>> 24) & 255;
  let ipClass: CidrResult["ipClass"] = "A";
  if (firstOctet >= 240) ipClass = "E";
  else if (firstOctet >= 224) ipClass = "D";
  else if (firstOctet >= 192) ipClass = "C";
  else if (firstOctet >= 128) ipClass = "B";

  let scope: CidrResult["scope"] = "Public";
  if (firstOctet === 127) scope = "Loopback";
  else if (firstOctet === 10) scope = "Private (RFC 1918)";
  else if (firstOctet === 172 && ((ipLong >>> 16) & 255) >= 16 && ((ipLong >>> 16) & 255) <= 31) scope = "Private (RFC 1918)";
  else if (firstOctet === 192 && ((ipLong >>> 16) & 255) === 168) scope = "Private (RFC 1918)";
  else if (firstOctet === 169 && ((ipLong >>> 16) & 255) === 254) scope = "Link-Local";
  else if (firstOctet === 100 && ((ipLong >>> 16) & 255) >= 64 && ((ipLong >>> 16) & 255) <= 127) scope = "Carrier-Grade NAT";
  else if (firstOctet >= 240) scope = "Reserved";

  return {
    ip: longToIp(ipLong),
    cidr,
    netmask: longToIp(netmaskLong),
    wildcardMask: longToIp(wildcardLong),
    networkAddress: longToIp(networkLong),
    broadcastAddress: longToIp(broadcastLong),
    firstUsableHost: longToIp(firstUsableLong),
    lastUsableHost: longToIp(lastUsableLong),
    totalHosts,
    usableHosts,
    ipClass,
    scope,
    binaryIp: toBinaryString(ipLong),
    binaryNetmask: toBinaryString(netmaskLong),
    hexIp: "0x" + (ipLong >>> 0).toString(16).padStart(8, "0").toUpperCase(),
  };
}

/** ----------------------------------------------------
 * 2. IPv4 ⇄ IPv6 Converter
 * --------------------------------------------------- */
export interface IpConversionResult {
  inputType: "IPv4" | "IPv6";
  canonical: string;
  expanded?: string;
  compressed?: string;
  ipv4Mapped?: string;
  sixToFour?: string;
  hex: string;
  reverseDns: string;
}

export function convertIp(input: string): IpConversionResult {
  const trimmed = input.trim();
  if (trimmed.includes(".")) {
    // IPv4
    const long = ipToLong(trimmed);
    const hex = (long >>> 0).toString(16).padStart(8, "0");
    const h1 = hex.slice(0, 4);
    const h2 = hex.slice(4, 8);
    const ipv4Mapped = `::ffff:${trimmed}`;
    const sixToFour = `2002:${h1}:${h2}::1`;
    const octets = trimmed.split(".").reverse();
    const reverseDns = `${octets.join(".")}.in-addr.arpa`;

    return {
      inputType: "IPv4",
      canonical: trimmed,
      ipv4Mapped,
      sixToFour,
      hex: "0x" + hex.toUpperCase(),
      reverseDns,
    };
  }

  // IPv6
  if (!trimmed.includes(":")) throw new Error("Invalid IP address");

  // Expand IPv6
  let parts = trimmed.split(":");
  if (trimmed.includes("::")) {
    const [left, right] = trimmed.split("::");
    const leftParts = left ? left.split(":") : [];
    const rightParts = right ? right.split(":") : [];
    const missing = 8 - (leftParts.length + rightParts.length);
    const middle = Array(missing).fill("0");
    parts = [...leftParts, ...middle, ...rightParts];
  }

  if (parts.length !== 8) throw new Error("Invalid IPv6 structure");

  const normalized = parts.map((p) => p.padStart(4, "0").toLowerCase());
  const expanded = normalized.join(":");

  // Compress standard RFC 5952
  // Find longest run of zeros
  let longestStart = -1;
  let longestLen = 0;
  let curStart = -1;
  let curLen = 0;

  for (let i = 0; i < normalized.length; i++) {
    if (normalized[i] === "0000") {
      if (curStart === -1) {
        curStart = i;
        curLen = 1;
      } else {
        curLen++;
      }
      if (curLen > longestLen) {
        longestStart = curStart;
        longestLen = curLen;
      }
    } else {
      curStart = -1;
      curLen = 0;
    }
  }

  let compressed = "";
  if (longestLen > 1) {
    const before = normalized.slice(0, longestStart).map((p) => parseInt(p, 16).toString(16)).join(":");
    const after = normalized.slice(longestStart + longestLen).map((p) => parseInt(p, 16).toString(16)).join(":");
    compressed = `${before}::${after}`;
    if (compressed.startsWith("::") && compressed.endsWith("::")) compressed = "::";
  } else {
    compressed = normalized.map((p) => parseInt(p, 16).toString(16)).join(":");
  }

  // Reverse DNS for IPv6 (nibble format)
  const nibbles = normalized.join("").split("").reverse();
  const reverseDns = `${nibbles.join(".")}.ip6.arpa`;

  return {
    inputType: "IPv6",
    canonical: compressed,
    expanded,
    compressed,
    hex: expanded.replace(/:/g, "").toUpperCase(),
    reverseDns,
  };
}

/** ----------------------------------------------------
 * 3. X.509 SSL/TLS Certificate Inspector
 * --------------------------------------------------- */
export interface CertInspectionResult {
  subject: Record<string, string>;
  issuer: Record<string, string>;
  validFrom: string;
  validTo: string;
  daysRemaining: number;
  status: "Valid" | "Expired" | "Not Yet Valid";
  serialNumber: string;
  signatureAlgorithm: string;
  publicKeyAlgorithm: string;
  subjectAltNames: string[];
}

// Simple pure-JS ASN.1 DER parser for certificates
class Asn1Node {
  tag: number;
  headerLen: number;
  contentLen: number;
  raw: Uint8Array;
  sub: Asn1Node[] = [];

  constructor(tag: number, headerLen: number, contentLen: number, raw: Uint8Array) {
    this.tag = tag;
    this.headerLen = headerLen;
    this.contentLen = contentLen;
    this.raw = raw;
  }
}

function parseDer(bytes: Uint8Array, offset = 0): Asn1Node {
  const tag = bytes[offset];
  let lenByte = bytes[offset + 1];
  let headerLen = 2;
  let contentLen = 0;

  if (lenByte < 0x80) {
    contentLen = lenByte;
  } else {
    const numBytes = lenByte & 0x7f;
    headerLen = 2 + numBytes;
    for (let i = 0; i < numBytes; i++) {
      contentLen = (contentLen << 8) | bytes[offset + 2 + i];
    }
  }

  const raw = bytes.subarray(offset + headerLen, offset + headerLen + contentLen);
  const node = new Asn1Node(tag, headerLen, contentLen, raw);

  // If constructed sequence (0x30), set (0x31), or context tag [0..3] (0xA0..0xA3)
  if (tag === 0x30 || tag === 0x31 || (tag >= 0xa0 && tag <= 0xa3)) {
    let subOffset = 0;
    while (subOffset < raw.length) {
      const child = parseDer(raw, subOffset);
      node.sub.push(child);
      subOffset += child.headerLen + child.contentLen;
    }
  }

  return node;
}

const OID_NAMES: Record<string, string> = {
  "2.5.4.3": "CN",
  "2.5.4.6": "C",
  "2.5.4.7": "L",
  "2.5.4.8": "ST",
  "2.5.4.10": "O",
  "2.5.4.11": "OU",
  "1.2.840.113549.1.1.1": "RSA",
  "1.2.840.113549.1.1.11": "sha256WithRSAEncryption",
  "1.2.840.113549.1.1.5": "sha1WithRSAEncryption",
  "1.2.840.10045.2.1": "EC (Elliptic Curve)",
  "1.2.840.10045.4.3.2": "ecdsa-with-SHA256",
  "2.5.29.17": "subjectAltName",
};

function decodeOid(bytes: Uint8Array): string {
  if (bytes.length === 0) return "";
  const first = bytes[0];
  const parts = [Math.floor(first / 40), first % 40];
  let val = 0;
  for (let i = 1; i < bytes.length; i++) {
    const b = bytes[i];
    val = (val << 7) | (b & 0x7f);
    if ((b & 0x80) === 0) {
      parts.push(val);
      val = 0;
    }
  }
  return parts.join(".");
}

function parseName(seq: Asn1Node): Record<string, string> {
  const out: Record<string, string> = {};
  for (const set of seq.sub) {
    for (const rdn of set.sub) {
      if (rdn.sub.length >= 2) {
        const oid = decodeOid(rdn.sub[0].raw);
        const nameKey = OID_NAMES[oid] || oid;
        const textVal = new TextDecoder().decode(rdn.sub[1].raw);
        out[nameKey] = textVal;
      }
    }
  }
  return out;
}

function parseTime(node: Asn1Node): Date {
  const str = new TextDecoder().decode(node.raw);
  if (node.tag === 0x17) {
    // UTCTime YYMMDDHHMMSSZ
    const year = parseInt(str.slice(0, 2), 10);
    const fullYear = year < 50 ? 2000 + year : 1900 + year;
    const m = parseInt(str.slice(2, 4), 10) - 1;
    const d = parseInt(str.slice(4, 6), 10);
    const h = parseInt(str.slice(6, 8), 10);
    const min = parseInt(str.slice(8, 10), 10);
    const s = parseInt(str.slice(10, 12), 10) || 0;
    return new Date(Date.UTC(fullYear, m, d, h, min, s));
  } else {
    // GeneralizedTime YYYYMMDDHHMMSSZ
    const fullYear = parseInt(str.slice(0, 4), 10);
    const m = parseInt(str.slice(4, 6), 10) - 1;
    const d = parseInt(str.slice(6, 8), 10);
    const h = parseInt(str.slice(8, 10), 10);
    const min = parseInt(str.slice(10, 12), 10);
    const s = parseInt(str.slice(12, 14), 10) || 0;
    return new Date(Date.UTC(fullYear, m, d, h, min, s));
  }
}

export function inspectCertificate(pem: string): CertInspectionResult {
  const b64 = pem
    .replace(/-----BEGIN [A-Z\s]+-----/g, "")
    .replace(/-----END [A-Z\s]+-----/g, "")
    .replace(/\s+/g, "");

  if (!b64) throw new Error("No certificate payload found in PEM");

  const binaryStr = atob(b64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

  const root = parseDer(bytes);
  if (root.tag !== 0x30 || root.sub.length < 3) {
    throw new Error("Invalid X.509 certificate structure");
  }

  const tbs = root.sub[0];
  let fieldIdx = 0;

  // Version [0] is optional
  if (tbs.sub[0].tag === 0xa0) {
    fieldIdx++;
  }

  // Serial Number
  const serialNode = tbs.sub[fieldIdx++];
  const serialNumber = Array.from(serialNode.raw)
    .map((b) => b.toString(16).padStart(2, "0").toUpperCase())
    .join(":");

  // Signature algorithm in TBS
  const sigAlgoNode = tbs.sub[fieldIdx++];
  const sigOid = sigAlgoNode.sub.length > 0 ? decodeOid(sigAlgoNode.sub[0].raw) : "";
  const signatureAlgorithm = OID_NAMES[sigOid] || sigOid || "SHA256withRSA";

  // Issuer Name
  const issuerNode = tbs.sub[fieldIdx++];
  const issuer = parseName(issuerNode);

  // Validity
  const validityNode = tbs.sub[fieldIdx++];
  const notBefore = parseTime(validityNode.sub[0]);
  const notAfter = parseTime(validityNode.sub[1]);

  // Subject Name
  const subjectNode = tbs.sub[fieldIdx++];
  const subject = parseName(subjectNode);

  // Public Key Info
  const spkiNode = tbs.sub[fieldIdx++];
  const pkAlgoOid = spkiNode.sub[0]?.sub[0] ? decodeOid(spkiNode.sub[0].sub[0].raw) : "";
  const publicKeyAlgorithm = OID_NAMES[pkAlgoOid] || pkAlgoOid || "RSA Public Key";

  // Extensions (look for SANs)
  const sans: string[] = [];
  const extContainer = tbs.sub.find((n) => n.tag === 0xa3);
  if (extContainer && extContainer.sub[0]) {
    for (const ext of extContainer.sub[0].sub) {
      if (ext.sub.length >= 2) {
        const oid = decodeOid(ext.sub[0].raw);
        if (oid === "2.5.29.17") {
          // SAN octet string
          const octet = ext.sub.find((n) => n.tag === 0x04);
          if (octet) {
            try {
              const sanTree = parseDer(octet.raw);
              for (const sanItem of sanTree.sub) {
                // 0x82 is dNSName tag [2]
                sans.push(new TextDecoder().decode(sanItem.raw));
              }
            } catch {
              // ignore san parse errors
            }
          }
        }
      }
    }
  }

  const now = new Date();
  const msRemaining = notAfter.getTime() - now.getTime();
  const daysRemaining = Math.floor(msRemaining / (1000 * 60 * 60 * 24));

  let status: CertInspectionResult["status"] = "Valid";
  if (now < notBefore) status = "Not Yet Valid";
  else if (now > notAfter) status = "Expired";

  return {
    subject,
    issuer,
    validFrom: notBefore.toUTCString(),
    validTo: notAfter.toUTCString(),
    daysRemaining,
    status,
    serialNumber,
    signatureAlgorithm,
    publicKeyAlgorithm,
    subjectAltNames: sans,
  };
}

/** ----------------------------------------------------
 * 4. Common Ports Reference Directory
 * --------------------------------------------------- */
export interface PortEntry {
  port: number;
  protocol: "TCP" | "UDP" | "TCP/UDP";
  service: string;
  description: string;
  category: "Web" | "Mail" | "Database" | "Remote Access" | "Network & Infrastructure" | "Dev & Cloud";
}

export const COMMON_PORTS: readonly PortEntry[] = [
  { port: 20, protocol: "TCP", service: "FTP Data", description: "File Transfer Protocol data transfer", category: "Network & Infrastructure" },
  { port: 21, protocol: "TCP", service: "FTP Control", description: "File Transfer Protocol command control", category: "Network & Infrastructure" },
  { port: 22, protocol: "TCP", service: "SSH / SFTP", description: "Secure Shell for encrypted remote command-line login and SFTP", category: "Remote Access" },
  { port: 23, protocol: "TCP", service: "Telnet", description: "Unencrypted legacy text communications", category: "Remote Access" },
  { port: 25, protocol: "TCP", service: "SMTP", description: "Simple Mail Transfer Protocol for mail relay between MTAs", category: "Mail" },
  { port: 53, protocol: "TCP/UDP", service: "DNS", description: "Domain Name System queries and zone transfers", category: "Network & Infrastructure" },
  { port: 67, protocol: "UDP", service: "DHCP Server", description: "Dynamic Host Configuration Protocol server", category: "Network & Infrastructure" },
  { port: 68, protocol: "UDP", service: "DHCP Client", description: "Dynamic Host Configuration Protocol client", category: "Network & Infrastructure" },
  { port: 80, protocol: "TCP", service: "HTTP", description: "Hypertext Transfer Protocol unencrypted web traffic", category: "Web" },
  { port: 110, protocol: "TCP", service: "POP3", description: "Post Office Protocol version 3 for mail retrieval", category: "Mail" },
  { port: 123, protocol: "UDP", service: "NTP", description: "Network Time Protocol clock synchronization", category: "Network & Infrastructure" },
  { port: 143, protocol: "TCP", service: "IMAP", description: "Internet Message Access Protocol for email sync", category: "Mail" },
  { port: 161, protocol: "UDP", service: "SNMP", description: "Simple Network Management Protocol queries", category: "Network & Infrastructure" },
  { port: 389, protocol: "TCP/UDP", service: "LDAP", description: "Lightweight Directory Access Protocol", category: "Network & Infrastructure" },
  { port: 443, protocol: "TCP", service: "HTTPS", description: "HTTP Secure over TLS/SSL encrypted web traffic", category: "Web" },
  { port: 465, protocol: "TCP", service: "SMTPS", description: "SMTP over TLS encrypted mail submission", category: "Mail" },
  { port: 587, protocol: "TCP", service: "SMTP Submission", description: "Modern client-to-server email submission with STARTTLS", category: "Mail" },
  { port: 636, protocol: "TCP", service: "LDAPS", description: "LDAP over SSL/TLS encrypted directory access", category: "Network & Infrastructure" },
  { port: 993, protocol: "TCP", service: "IMAPS", description: "IMAP over SSL/TLS secure mail retrieval", category: "Mail" },
  { port: 995, protocol: "TCP", service: "POP3S", description: "POP3 over SSL/TLS secure mail retrieval", category: "Mail" },
  { port: 1433, protocol: "TCP", service: "MS SQL Server", description: "Microsoft SQL Server database engine", category: "Database" },
  { port: 1521, protocol: "TCP", service: "Oracle DB", description: "Oracle Database listener default port", category: "Database" },
  { port: 3000, protocol: "TCP", service: "Node / React Dev", description: "Common default port for Next.js, Vite, Express dev servers", category: "Dev & Cloud" },
  { port: 3306, protocol: "TCP", service: "MySQL / MariaDB", description: "MySQL & MariaDB database standard connection port", category: "Database" },
  { port: 5432, protocol: "TCP", service: "PostgreSQL", description: "PostgreSQL relational database default connection port", category: "Database" },
  { port: 6379, protocol: "TCP", service: "Redis", description: "Redis in-memory key-value data store", category: "Database" },
  { port: 8080, protocol: "TCP", service: "HTTP Alternate", description: "Common secondary web proxy, Spring Boot, Jenkins, Tomcat", category: "Web" },
  { port: 8443, protocol: "TCP", service: "HTTPS Alternate", description: "Secondary HTTPS SSL web server port", category: "Web" },
  { port: 9000, protocol: "TCP", service: "SonarQube / PHP-FPM", description: "SonarQube dashboard and FastCGI Process Manager", category: "Dev & Cloud" },
  { port: 9200, protocol: "TCP", service: "Elasticsearch", description: "Elasticsearch HTTP REST API endpoint", category: "Database" },
  { port: 27017, protocol: "TCP", service: "MongoDB", description: "MongoDB NoSQL document database standard port", category: "Database" },
];

export function searchPorts(query: string): PortEntry[] {
  const clean = query.trim().toLowerCase();
  if (!clean) return [...COMMON_PORTS];
  return COMMON_PORTS.filter(
    (p) =>
      p.port.toString().includes(clean) ||
      p.service.toLowerCase().includes(clean) ||
      p.description.toLowerCase().includes(clean) ||
      p.category.toLowerCase().includes(clean)
  );
}

/** ----------------------------------------------------
 * 5. .gitignore Generator
 * --------------------------------------------------- */
export const GITIGNORE_PRESETS: Record<string, string> = {
  Node: `node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*
lerna-debug.log*
.pnpm-debug.log*
dist/
build/
.env
.env.local
.env.*.local`,
  Python: `__pycache__/
*.py[cod]
*$py.class
*.so
.Python
env/
build/
develop-eggs/
dist/
downloads/
eggs/
.eggs/
lib/
lib64/
parts/
sdist/
var/
wheels/
*.egg-info/
.installed.cfg
*.egg
.env
.venv
venv/
ENV/`,
  macOS: `.DS_Store
.AppleDouble
.LSOverride
Icon
._*
.DocumentRevisions-V100
.fseventsd
.Spotlight-V100
.TemporaryItems
.Trashes
.VolumeIcon.icns`,
  Windows: `Thumbs.db
Thumbs.db:encryptable
ehthumbs.db
ehthumbs_vista.db
*.stackdump
[Dd]esktop.ini
$RECYCLE.BIN/`,
  VSCode: `.vscode/*
!.vscode/settings.json
!.vscode/tasks.json
!.vscode/launch.json
!.vscode/extensions.json
*.code-workspace`,
  NextJS: `.next/
out/
build/
dist/
next-env.d.ts`,
  Go: `bin/
pkg/
*.exe
*.exe~
*.dll
*.so
*.dylib
*.test
*.out
vendor/`,
  Rust: `/target/
**/*.rs.bk
Cargo.lock`,
  Docker: `.docker/
docker-compose.override.yml`,
};

export function generateGitignore(selectedPresets: string[]): string {
  if (selectedPresets.length === 0) return "";
  const sections = selectedPresets
    .filter((k) => GITIGNORE_PRESETS[k])
    .map((k) => `### ${k} ###\n${GITIGNORE_PRESETS[k]}`);
  return `# Generated by Code Station .gitignore Generator\n# 100% In-browser developer utility\n\n${sections.join("\n\n")}\n`;
}

/** ----------------------------------------------------
 * 6. Dockerfile Generator
 * --------------------------------------------------- */
export interface DockerfileConfig {
  language: "node" | "python" | "go" | "rust" | "nginx";
  version: string;
  port: number;
  multiStage: boolean;
  nonRoot: boolean;
}

export function generateDockerfile(config: DockerfileConfig): string {
  const { language, version, port, multiStage, nonRoot } = config;

  if (language === "node") {
    if (multiStage) {
      return `# Build stage
FROM node:${version || "20-alpine"} AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production runtime stage
FROM node:${version || "20-alpine"} AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
${nonRoot ? "USER node" : ""}
EXPOSE ${port || 3000}
CMD ["node", "dist/index.js"]
`;
    }
    return `FROM node:${version || "20-alpine"}
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
${nonRoot ? "USER node" : ""}
EXPOSE ${port || 3000}
CMD ["npm", "start"]
`;
  }

  if (language === "python") {
    return `FROM python:${version || "3.11-slim"}
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \\
    PYTHONUNBUFFERED=1

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
${nonRoot ? "RUN useradd -m appuser && chown -R appuser /app\\nUSER appuser" : ""}
EXPOSE ${port || 8000}
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "${port || 8000}"]
`;
  }

  if (language === "go") {
    return `# Build stage
FROM golang:${version || "1.22-alpine"} AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /server .

# Production distroless/scratch stage
FROM alpine:3.19
WORKDIR /app
COPY --from=builder /server /server
${nonRoot ? "RUN adduser -D appuser\\nUSER appuser" : ""}
EXPOSE ${port || 8080}
CMD ["/server"]
`;
  }

  if (language === "rust") {
    return `# Build stage
FROM rust:${version || "1.78-alpine"} AS builder
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY src ./src
RUN cargo build --release

# Runtime stage
FROM alpine:3.19
WORKDIR /app
COPY --from=builder /app/target/release/app /usr/local/bin/app
${nonRoot ? "RUN adduser -D appuser\\nUSER appuser" : ""}
EXPOSE ${port || 8080}
CMD ["app"]
`;
  }

  // Nginx / Static
  return `FROM nginx:alpine
COPY . /usr/share/nginx/html
EXPOSE ${port || 80}
CMD ["nginx", "-g", "daemon off;"]
`;
}

/** ----------------------------------------------------
 * 7. Docker Run to Compose Converter
 * --------------------------------------------------- */
export function dockerRunToCompose(command: string): string {
  const clean = command.replace(/\\\n/g, " ").trim();
  if (!clean.startsWith("docker run")) {
    throw new Error("Input must start with 'docker run'");
  }

  const tokens = clean.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
  let serviceName = "app";
  let image = "";
  const ports: string[] = [];
  const volumes: string[] = [];
  const environment: string[] = [];
  let restart = "";

  for (let i = 2; i < tokens.length; i++) {
    const token = tokens[i].replace(/^["']|["']$/g, "");
    if (token === "-p" || token === "--publish") {
      ports.push(tokens[++i]?.replace(/^["']|["']$/g, ""));
    } else if (token === "-v" || token === "--volume") {
      volumes.push(tokens[++i]?.replace(/^["']|["']$/g, ""));
    } else if (token === "-e" || token === "--env") {
      environment.push(tokens[++i]?.replace(/^["']|["']$/g, ""));
    } else if (token === "--name") {
      serviceName = tokens[++i]?.replace(/^["']|["']$/g, "");
    } else if (token === "--restart") {
      restart = tokens[++i]?.replace(/^["']|["']$/g, "");
    } else if (!token.startsWith("-") && !image) {
      image = token;
    }
  }

  if (!image) throw new Error("Could not detect image name in docker run command");

  let yaml = `version: "3.8"\n\nservices:\n  ${serviceName}:\n    image: ${image}\n`;
  if (restart) yaml += `    restart: ${restart}\n`;
  if (ports.length > 0) {
    yaml += `    ports:\n${ports.map((p) => `      - "${p}"`).join("\n")}\n`;
  }
  if (volumes.length > 0) {
    yaml += `    volumes:\n${volumes.map((v) => `      - ${v}`).join("\n")}\n`;
  }
  if (environment.length > 0) {
    yaml += `    environment:\n${environment.map((e) => `      - ${e}`).join("\n")}\n`;
  }

  return yaml;
}

/** ----------------------------------------------------
 * 8. SemVer Calculator & Comparator
 * --------------------------------------------------- */
export interface SemVerInfo {
  version: string;
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
  build?: string;
  nextMajor: string;
  nextMinor: string;
  nextPatch: string;
}

const SEMVER_REGEX = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+([0-9A-Za-z.-]+))?$/;

export function parseSemver(v: string): SemVerInfo {
  const match = v.trim().match(SEMVER_REGEX);
  if (!match) throw new Error(`Invalid SemVer format: "${v}". Expected format: MAJOR.MINOR.PATCH (e.g. 1.2.3)`);

  const major = parseInt(match[1], 10);
  const minor = parseInt(match[2], 10);
  const patch = parseInt(match[3], 10);
  const prerelease = match[4];
  const build = match[5];

  return {
    version: `${major}.${minor}.${patch}${prerelease ? `-${prerelease}` : ""}${build ? `+${build}` : ""}`,
    major,
    minor,
    patch,
    prerelease,
    build,
    nextMajor: `${major + 1}.0.0`,
    nextMinor: `${major}.${minor + 1}.0`,
    nextPatch: `${major}.${minor}.${patch + 1}`,
  };
}

export function compareSemver(v1: string, v2: string): -1 | 0 | 1 {
  const p1 = parseSemver(v1);
  const p2 = parseSemver(v2);

  if (p1.major !== p2.major) return p1.major > p2.major ? 1 : -1;
  if (p1.minor !== p2.minor) return p1.minor > p2.minor ? 1 : -1;
  if (p1.patch !== p2.patch) return p1.patch > p2.patch ? 1 : -1;

  if (p1.prerelease && !p2.prerelease) return -1;
  if (!p1.prerelease && p2.prerelease) return 1;
  if (p1.prerelease && p2.prerelease) {
    if (p1.prerelease !== p2.prerelease) return p1.prerelease > p2.prerelease ? 1 : -1;
  }

  return 0;
}
