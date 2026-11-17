"use client";

import { useState } from "react";
import { getNetworkDefinition, type NetworkToolId } from "@/config/network-tools";
import {
  calculateCidr,
  convertIp,
  inspectCertificate,
  searchPorts,
  generateGitignore,
  generateDockerfile,
  dockerRunToCompose,
  parseSemver,
  compareSemver,
  GITIGNORE_PRESETS,
  type CidrResult,
  type IpConversionResult,
  type CertInspectionResult,
} from "@/lib/tools/network/engine";
import { Button } from "./ui/Button";
import { Callout } from "./ui/Callout";
import { Checkbox, Select, Textarea, TextInput } from "./ui/controls";
import { DataTable } from "./ui/DataTable";
import { EmptyState } from "./ui/EmptyState";
import { Field } from "./ui/Field";
import { Panel } from "./ui/Panel";
import { StatusLine } from "./ui/StatusLine";
import { ToolLayout } from "./ui/ToolLayout";
import { downloadBlob } from "./ui/useDownload";
import { useCopy } from "./ui/useCopy";
import ui from "./ui/ui.module.css";
import styles from "./NetworkStation.module.css";

interface NetworkStationProps {
  toolId: NetworkToolId;
}

type Row = [label: string, value: string];

const PORT_CATEGORIES = ["All", "Web", "Database", "Mail", "Remote Access", "Network & Infrastructure", "Dev & Cloud"];
const CIDR_PREFIXES = ["/8", "/16", "/24", "/26", "/28", "/30", "/32"];
const DOCKER_LANGUAGES = [
  ["node", "Node.js"],
  ["python", "Python"],
  ["go", "Go (Golang)"],
  ["rust", "Rust"],
  ["nginx", "Static Nginx"],
] as const;

function StatList({ rows, label }: { rows: Row[]; label: string }) {
  return (
    <dl className={styles.stats} aria-label={label}>
      {rows.map(([term, value]) => (
        <div className={styles.stat} key={term}>
          <dt className={styles.statLabel}>{term}</dt>
          <dd className={`${ui.mono} ${styles.statValue}`}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function NetworkStation({ toolId }: NetworkStationProps) {
  const definition = getNetworkDefinition(toolId)!;
  const initialInput = (definition.localContract.defaults.input as string) || "";

  // Tool state
  const [input, setInput] = useState(initialInput);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const { copy } = useCopy();

  // CIDR state
  const [cidrResult, setCidrResult] = useState<CidrResult | null>(() => {
    if (toolId === "cidr-calculator") {
      try {
        return calculateCidr(initialInput || "192.168.1.0/24");
      } catch {
        return null;
      }
    }
    return null;
  });

  // IP conversion state
  const [ipResult, setIpResult] = useState<IpConversionResult | null>(() => {
    if (toolId === "ipv4-to-ipv6") {
      try {
        return convertIp(initialInput || "192.168.1.1");
      } catch {
        return null;
      }
    }
    return null;
  });

  // Certificate inspector state
  const [certResult, setCertResult] = useState<CertInspectionResult | null>(null);

  // Ports directory state
  const [portQuery, setPortQuery] = useState("");
  const [selectedPortCategory, setSelectedPortCategory] = useState("All");

  // .gitignore state
  const [selectedPresets, setSelectedPresets] = useState<string[]>(["Node", "macOS", "VSCode"]);

  // Dockerfile state
  const [dockerLang, setDockerLang] = useState<"node" | "python" | "go" | "rust" | "nginx">("node");
  const [dockerVersion, setDockerVersion] = useState("20-alpine");
  const [dockerPort, setDockerPort] = useState(3000);
  const [multiStage, setMultiStage] = useState(true);
  const [nonRoot, setNonRoot] = useState(true);

  // Docker run state
  const [dockerRunOutput, setDockerRunOutput] = useState(() => {
    if (toolId === "docker-run-to-compose") {
      try {
        return dockerRunToCompose(initialInput);
      } catch {
        return "";
      }
    }
    return "";
  });

  // SemVer state
  const [v1, setV1] = useState("1.2.3");
  const [v2, setV2] = useState("2.0.0");

  async function copyText(text: string, id: string) {
    if (!(await copy(text))) return;
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  function downloadText(content: string, filename: string) {
    downloadBlob(content, filename);
  }

  // Handle CIDR updates
  function handleCidrChange(val: string) {
    setInput(val);
    try {
      setError(null);
      setCidrResult(calculateCidr(val));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setCidrResult(null);
    }
  }

  // Handle IP conversion updates
  function handleIpChange(val: string) {
    setInput(val);
    try {
      setError(null);
      setIpResult(convertIp(val));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setIpResult(null);
    }
  }

  // Handle Cert inspect
  function handleCertInspect(pem: string) {
    setInput(pem);
    try {
      setError(null);
      setCertResult(inspectCertificate(pem));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setCertResult(null);
    }
  }

  // Handle Docker run conversion
  function handleDockerRunChange(cmd: string) {
    setInput(cmd);
    try {
      setError(null);
      setDockerRunOutput(dockerRunToCompose(cmd));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setDockerRunOutput("");
    }
  }

  const station = (() => {
    // 1. CIDR Subnet Calculator
    if (toolId === "cidr-calculator") {
      const rows: Row[] = cidrResult ? [
        ["Network Address", cidrResult.networkAddress],
        ["Subnet Mask", cidrResult.netmask],
        ["Wildcard Mask", cidrResult.wildcardMask],
        ["Broadcast Address", cidrResult.broadcastAddress],
        ["Usable Host Range", `${cidrResult.firstUsableHost} — ${cidrResult.lastUsableHost}`],
        ["Usable Hosts", `${cidrResult.usableHosts.toLocaleString()} of ${cidrResult.totalHosts.toLocaleString()}`],
        ["Class & Scope", `Class ${cidrResult.ipClass} · ${cidrResult.scope}`],
        ["Binary Subnet Mask", cidrResult.binaryNetmask],
      ] : [];
      return (
        <ToolLayout kind="form" className={styles.layout}>
          <Panel title="Subnet Configuration" padded>
            <div className={styles.form}>
              <Field id="cidr-input" label="IPv4 Address & CIDR Prefix">
                <TextInput
                  id="cidr-input"
                  type="text"
                  value={input}
                  onChange={(event) => handleCidrChange(event.target.value)}
                  placeholder="e.g. 192.168.1.0/24"
                  spellCheck={false}
                  autoComplete="off"
                />
              </Field>
              <div className={styles.chips} role="group" aria-label="CIDR prefix suggestions">
                {CIDR_PREFIXES.map((prefix) => (
                  <Button
                    key={prefix}
                    size="sm"
                    variant={input.endsWith(prefix) ? "primary" : undefined}
                    onClick={() => {
                      const base = input.split("/")[0] || "192.168.1.0";
                      handleCidrChange(`${base}${prefix}`);
                    }}
                  >
                    {prefix}
                  </Button>
                ))}
              </div>
              {error && <Callout kind="error" className={styles.alert}>{error}</Callout>}
            </div>
          </Panel>
          <Panel title="Subnet Result" padded>
            {rows.length > 0
              ? <StatList rows={rows} label="Subnet calculation result" />
              : <EmptyState>Enter an IPv4 address and CIDR prefix to see the subnet breakdown.</EmptyState>}
          </Panel>
        </ToolLayout>
      );
    }

    // 2. IPv4 ⇄ IPv6 Converter
    if (toolId === "ipv4-to-ipv6") {
      const rows: Row[] = ipResult ? [
        ["Type", ipResult.inputType],
        ["Canonical", ipResult.canonical],
        ...(ipResult.ipv4Mapped ? [["IPv4-Mapped IPv6", ipResult.ipv4Mapped] as Row] : []),
        ...(ipResult.sixToFour ? [["6to4 Notation", ipResult.sixToFour] as Row] : []),
        ...(ipResult.expanded ? [["Full Expanded (32 Hex)", ipResult.expanded] as Row] : []),
        ["Reverse DNS Pointer", ipResult.reverseDns],
      ] : [];
      return (
        <ToolLayout kind="form" className={styles.layout}>
          <Panel title="IP Address Input" padded>
            <div className={styles.form}>
              <Field id="ip-input" label="Enter IPv4 or IPv6 Address">
                <TextInput
                  id="ip-input"
                  type="text"
                  value={input}
                  onChange={(event) => handleIpChange(event.target.value)}
                  placeholder="e.g. 192.168.1.1 or 2001:db8::1"
                  spellCheck={false}
                  autoComplete="off"
                />
              </Field>
              {error && <Callout kind="error" className={styles.alert}>{error}</Callout>}
            </div>
          </Panel>
          <Panel title="Conversion Result" padded>
            {rows.length > 0
              ? <StatList rows={rows} label="IP conversion result" />
              : <EmptyState>Enter an IPv4 or IPv6 address to see its canonical forms.</EmptyState>}
          </Panel>
        </ToolLayout>
      );
    }

    // 3. Certificate Inspector
    if (toolId === "cert-inspector") {
      const rows: Row[] = certResult ? [
        ["Common Name (CN)", certResult.subject["CN"] || "N/A"],
        ["Issuer", certResult.issuer["O"] || certResult.issuer["CN"] || "N/A"],
        ["Validity Period", `${certResult.validFrom} to ${certResult.validTo}`],
        ["Serial Number", certResult.serialNumber],
        ["Signature Algorithm", certResult.signatureAlgorithm],
      ] : [];
      return (
        <ToolLayout kind="form" className={styles.layout}>
          <Panel title="X.509 Certificate (PEM)" padded>
            <div className={styles.form}>
              <Field id="cert-pem" label="Paste Certificate (-----BEGIN CERTIFICATE-----)">
                <Textarea
                  id="cert-pem"
                  className={ui.mono}
                  value={input}
                  onChange={(event) => handleCertInspect(event.target.value)}
                  placeholder="Paste PEM certificate here..."
                  spellCheck={false}
                  autoComplete="off"
                />
              </Field>
              {error && <Callout kind="error" className={styles.alert}>{error}</Callout>}
            </div>
          </Panel>
          <Panel title="Certificate Details" padded>
            {certResult ? (
              <div className={styles.form}>
                <dl className={styles.stats} aria-label="Certificate status">
                  <div className={styles.stat}>
                    <dt className={styles.statLabel}>Status</dt>
                    <dd className={styles.statValue}>
                      <span className={`${styles.badge} ${certResult.status === "Valid" ? styles.badgeSuccess : styles.badgeDanger}`}>
                        {certResult.status} ({certResult.daysRemaining} days left)
                      </span>
                    </dd>
                  </div>
                </dl>
                <StatList rows={rows} label="Certificate details" />
              </div>
            ) : <EmptyState>Paste a PEM certificate to inspect its subject, issuer and validity.</EmptyState>}
          </Panel>
        </ToolLayout>
      );
    }

    // 4. Ports Reference
    if (toolId === "port-reference") {
      const ports = searchPorts(portQuery)
        .filter((port) => selectedPortCategory === "All" || port.category === selectedPortCategory)
        .map((port) => ({
          key: `${port.port}-${port.service}`,
          cells: [
            <strong key="port">{port.port}</strong>,
            port.protocol,
            port.service,
            <span key="category" className={`${styles.badge} ${styles.badgeInfo}`}>{port.category}</span>,
            port.description,
          ],
        }));
      return (
        <ToolLayout kind="data" className={styles.layout}>
          <Panel title="Common Ports Directory" padded>
            <div className={styles.form}>
              <Field id="port-filter" label="Search by Port, Service or Description">
                <TextInput
                  id="port-filter"
                  type="text"
                  value={portQuery}
                  onChange={(event) => setPortQuery(event.target.value)}
                  placeholder="e.g. 443, postgres, ssh, web..."
                  spellCheck={false}
                  autoComplete="off"
                />
              </Field>
              <div className={styles.chips} role="group" aria-label="Port category">
                {PORT_CATEGORIES.map((category) => (
                  <Button
                    key={category}
                    size="sm"
                    variant={selectedPortCategory === category ? "primary" : undefined}
                    aria-pressed={selectedPortCategory === category}
                    onClick={() => setSelectedPortCategory(category)}
                  >
                    {category}
                  </Button>
                ))}
              </div>
              <DataTable
                caption="Common ports directory"
                columns={["Port", "Protocol", "Service", "Category", "Description"]}
                rows={ports.map((port) => port.cells)}
                empty="No ports match this search."
              />
            </div>
          </Panel>
        </ToolLayout>
      );
    }

    // 5. .gitignore Generator
    if (toolId === "gitignore-generator") {
      const generated = generateGitignore(selectedPresets);
      return (
        <ToolLayout kind="form" className={styles.layout}>
          <Panel title="Presets Selection" padded>
            <div className={styles.chips} role="group" aria-label="Preset selection">
              {Object.keys(GITIGNORE_PRESETS).map((preset) => {
                const active = selectedPresets.includes(preset);
                return (
                  <Button
                    key={preset}
                    size="sm"
                    variant={active ? "primary" : undefined}
                    aria-pressed={active}
                    onClick={() => {
                      setSelectedPresets((previous) =>
                        active ? previous.filter((item) => item !== preset) : [...previous, preset]
                      );
                    }}
                  >
                    {preset} {active ? "✓" : "+"}
                  </Button>
                );
              })}
            </div>
          </Panel>
          <Panel
            title="Generated .gitignore"
            padded
            actions={<>
              <Button size="sm" onClick={() => copyText(generated, "gitignore")}>
                {copied === "gitignore" ? "✓ Copied" : "Copy .gitignore"}
              </Button>
              <Button size="sm" onClick={() => downloadText(generated, ".gitignore")}>Download .gitignore</Button>
            </>}
          >
            <pre tabIndex={0} className={ui.output} aria-label="Generated .gitignore">
              <code>{generated || "# Select presets above to generate .gitignore"}</code>
            </pre>
          </Panel>
        </ToolLayout>
      );
    }

    // 6. Dockerfile Generator
    if (toolId === "dockerfile-generator") {
      const generated = generateDockerfile({
        language: dockerLang,
        version: dockerVersion,
        port: dockerPort,
        multiStage,
        nonRoot,
      });
      return (
        <ToolLayout kind="form" className={styles.layout}>
          <Panel title="Dockerfile Builder" padded>
            <div className={styles.form}>
              <Field id="docker-lang" label="Runtime / Language">
                <Select
                  id="docker-lang"
                  value={dockerLang}
                  onChange={(event) => setDockerLang(event.target.value as typeof dockerLang)}
                >
                  {DOCKER_LANGUAGES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </Select>
              </Field>
              <Field id="docker-version" label="Base Version Tag">
                <TextInput
                  id="docker-version"
                  type="text"
                  value={dockerVersion}
                  onChange={(event) => setDockerVersion(event.target.value)}
                  spellCheck={false}
                  autoComplete="off"
                />
              </Field>
              <Field id="docker-port" label="Exposed Port">
                <TextInput
                  id="docker-port"
                  type="number"
                  value={dockerPort}
                  onChange={(event) => setDockerPort(parseInt(event.target.value, 10) || 3000)}
                />
              </Field>
              <div className={styles.options}>
                <Checkbox
                  id="docker-multistage"
                  label="Multi-Stage Build (Production Optimizations)"
                  checked={multiStage}
                  onChange={(event) => setMultiStage(event.target.checked)}
                />
                <Checkbox
                  id="docker-nonroot"
                  label="Non-Root Security User"
                  checked={nonRoot}
                  onChange={(event) => setNonRoot(event.target.checked)}
                />
              </div>
            </div>
          </Panel>
          <Panel
            title="Generated Dockerfile"
            padded
            actions={<>
              <Button size="sm" onClick={() => copyText(generated, "dockerfile")}>
                {copied === "dockerfile" ? "✓ Copied" : "Copy Dockerfile"}
              </Button>
              <Button size="sm" onClick={() => downloadText(generated, "Dockerfile")}>Download Dockerfile</Button>
            </>}
          >
            <pre tabIndex={0} className={ui.output} aria-label="Generated Dockerfile">
              <code>{generated}</code>
            </pre>
          </Panel>
        </ToolLayout>
      );
    }

    // 7. Docker Run to Compose
    if (toolId === "docker-run-to-compose") {
      return (
        <ToolLayout kind="form" className={styles.layout}>
          <Panel title="Docker Run to Compose" padded>
            <div className={styles.form}>
              <Field id="docker-run-input" label="Docker Run Command">
                <Textarea
                  id="docker-run-input"
                  className={ui.mono}
                  value={input}
                  onChange={(event) => handleDockerRunChange(event.target.value)}
                  placeholder="e.g. docker run -d --name web -p 8080:80 nginx:alpine"
                  spellCheck={false}
                  autoComplete="off"
                />
              </Field>
              {error && <Callout kind="error" className={styles.alert}>{error}</Callout>}
            </div>
          </Panel>
          <Panel
            title="Generated Compose YAML"
            padded
            actions={<>
              <Button size="sm" onClick={() => copyText(dockerRunOutput, "compose")} disabled={!dockerRunOutput}>
                {copied === "compose" ? "✓ Copied" : "Copy Compose"}
              </Button>
              <Button size="sm" onClick={() => downloadText(dockerRunOutput, "docker-compose.yml")} disabled={!dockerRunOutput}>
                Download docker-compose.yml
              </Button>
            </>}
          >
            {dockerRunOutput
              ? <pre tabIndex={0} className={ui.output} aria-label="Generated Compose YAML">
                <code>{dockerRunOutput}</code>
              </pre>
              : <EmptyState>Paste a docker run command to generate a docker-compose.yml file.</EmptyState>}
          </Panel>
        </ToolLayout>
      );
    }

    // 8. SemVer Calculator
    let rows: Row[] = [];
    let semverError = "";
    try {
      const parsed = parseSemver(v1);
      rows = [
        ["Major.Minor.Patch", `${parsed.major}.${parsed.minor}.${parsed.patch}`],
        ["Next Patch (+0.0.1)", parsed.nextPatch],
        ["Next Minor (+0.1.0)", parsed.nextMinor],
        ["Next Major (+1.0.0)", parsed.nextMajor],
      ];
      if (v2.trim()) {
        const comparison = compareSemver(v1, v2);
        rows.push(["Version Comparison", comparison === 0
          ? `${v1} is equal to ${v2}`
          : comparison > 0
            ? `${v1} is greater than (newer than) ${v2}`
            : `${v1} is less than (older than) ${v2}`]);
      }
    } catch (err) {
      semverError = (err as Error).message;
    }
    return (
      <ToolLayout kind="form" className={styles.layout}>
        <Panel title="SemVer Inspector & Comparator" padded>
          <div className={styles.form}>
            <Field id="semver-v1" label="Version 1 (Target)">
              <TextInput
                id="semver-v1"
                type="text"
                value={v1}
                onChange={(event) => setV1(event.target.value)}
                placeholder="e.g. 1.2.3"
                spellCheck={false}
                autoComplete="off"
              />
            </Field>
            <Field id="semver-v2" label="Version 2 (Comparison)">
              <TextInput
                id="semver-v2"
                type="text"
                value={v2}
                onChange={(event) => setV2(event.target.value)}
                placeholder="e.g. 2.0.0"
                spellCheck={false}
                autoComplete="off"
              />
            </Field>
          </div>
        </Panel>
        <Panel title="Version Details" padded>
          {semverError
            ? <Callout kind="error">{semverError}</Callout>
            : (
              <dl className={styles.stats} aria-label="SemVer details">
                {rows.map(([term, value]) => (
                  <div className={term === "Version Comparison" ? `${styles.stat} ${styles.wide}` : styles.stat} key={term}>
                    <dt className={styles.statLabel}>{term}</dt>
                    <dd className={`${ui.mono} ${styles.statValue}`}>{value}</dd>
                  </div>
                ))}
              </dl>
            )}
        </Panel>
      </ToolLayout>
    );
  })();

  return (
    <div className={styles.station}>
      {station}
      <StatusLine className={styles.status}>{copied ? "Copied to clipboard." : ""}</StatusLine>
    </div>
  );
}
