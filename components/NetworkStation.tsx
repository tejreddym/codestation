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
import styles from "./NetworkStation.module.css";

interface NetworkStationProps {
  toolId: NetworkToolId;
}

export default function NetworkStation({ toolId }: NetworkStationProps) {
  const definition = getNetworkDefinition(toolId)!;
  const initialInput = (definition.localContract.defaults.input as string) || "";

  // Tool state
  const [input, setInput] = useState(initialInput);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

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

  function copyText(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  function downloadText(content: string, filename: string) {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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

  return (
    <div className={styles.container}>
      {/* 1. CIDR Subnet Calculator */}
      {toolId === "cidr-calculator" && (
        <div className={styles.panel}>
          <div className={styles.headingRow}>
            <span className={styles.panelTitle}>Subnet Configuration</span>
          </div>

          <div className={styles.field}>
            <label htmlFor="cidr-input">IPv4 Address &amp; CIDR Prefix</label>
            <input
              id="cidr-input"
              type="text"
              className={styles.input}
              value={input}
              onChange={(e) => handleCidrChange(e.target.value)}
              placeholder="e.g. 192.168.1.0/24"
            />
          </div>

          <div className={styles.chipGroup}>
            {["/8", "/16", "/24", "/26", "/28", "/30", "/32"].map((p) => (
              <button
                key={p}
                type="button"
                className={styles.chip}
                onClick={() => {
                  const base = input.split("/")[0] || "192.168.1.0";
                  handleCidrChange(`${base}${p}`);
                }}
              >
                {p}
              </button>
            ))}
          </div>

          {error && <div className={styles.errorBanner}>{error}</div>}

          {cidrResult && (
            <div className={styles.resultsGrid}>
              <div className={styles.statCard}>
                <span className={styles.statLabel}>Network Address</span>
                <span className={styles.statValue}>{cidrResult.networkAddress}</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statLabel}>Subnet Mask</span>
                <span className={styles.statValue}>{cidrResult.netmask}</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statLabel}>Wildcard Mask</span>
                <span className={styles.statValue}>{cidrResult.wildcardMask}</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statLabel}>Broadcast Address</span>
                <span className={styles.statValue}>{cidrResult.broadcastAddress}</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statLabel}>Usable Host Range</span>
                <span className={styles.statValue}>
                  {cidrResult.firstUsableHost} — {cidrResult.lastUsableHost}
                </span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statLabel}>Usable Hosts</span>
                <span className={styles.statValue}>
                  {cidrResult.usableHosts.toLocaleString()} of {cidrResult.totalHosts.toLocaleString()}
                </span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statLabel}>Class &amp; Scope</span>
                <span className={styles.statValue}>
                  Class {cidrResult.ipClass} · {cidrResult.scope}
                </span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statLabel}>Binary Subnet Mask</span>
                <span className={styles.statValue}>{cidrResult.binaryNetmask}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. IPv4 ⇄ IPv6 Converter */}
      {toolId === "ipv4-to-ipv6" && (
        <div className={styles.panel}>
          <div className={styles.headingRow}>
            <span className={styles.panelTitle}>IP Address Input</span>
          </div>

          <div className={styles.field}>
            <label htmlFor="ip-input">Enter IPv4 or IPv6 Address</label>
            <input
              id="ip-input"
              type="text"
              className={styles.input}
              value={input}
              onChange={(e) => handleIpChange(e.target.value)}
              placeholder="e.g. 192.168.1.1 or 2001:db8::1"
            />
          </div>

          {error && <div className={styles.errorBanner}>{error}</div>}

          {ipResult && (
            <div className={styles.resultsGrid}>
              <div className={styles.statCard}>
                <span className={styles.statLabel}>Type</span>
                <span className={styles.statValue}>{ipResult.inputType}</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statLabel}>Canonical</span>
                <span className={styles.statValue}>{ipResult.canonical}</span>
              </div>
              {ipResult.ipv4Mapped && (
                <div className={styles.statCard}>
                  <span className={styles.statLabel}>IPv4-Mapped IPv6</span>
                  <span className={styles.statValue}>{ipResult.ipv4Mapped}</span>
                </div>
              )}
              {ipResult.sixToFour && (
                <div className={styles.statCard}>
                  <span className={styles.statLabel}>6to4 Notation</span>
                  <span className={styles.statValue}>{ipResult.sixToFour}</span>
                </div>
              )}
              {ipResult.expanded && (
                <div className={styles.statCard}>
                  <span className={styles.statLabel}>Full Expanded (32 Hex)</span>
                  <span className={styles.statValue}>{ipResult.expanded}</span>
                </div>
              )}
              <div className={styles.statCard}>
                <span className={styles.statLabel}>Reverse DNS Pointer</span>
                <span className={styles.statValue}>{ipResult.reverseDns}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. Certificate Inspector */}
      {toolId === "cert-inspector" && (
        <div className={styles.panel}>
          <div className={styles.headingRow}>
            <span className={styles.panelTitle}>X.509 Certificate (PEM)</span>
          </div>

          <div className={styles.field}>
            <label htmlFor="cert-pem">Paste Certificate (-----BEGIN CERTIFICATE-----)</label>
            <textarea
              id="cert-pem"
              className={styles.textarea}
              value={input}
              onChange={(e) => handleCertInspect(e.target.value)}
              placeholder="Paste PEM certificate here..."
            />
          </div>

          {error && <div className={styles.errorBanner}>{error}</div>}

          {certResult && (
            <div className={styles.resultsGrid}>
              <div className={styles.statCard}>
                <span className={styles.statLabel}>Status</span>
                <span className={styles.statValue}>
                  <span
                    className={`${styles.badge} ${
                      certResult.status === "Valid"
                        ? styles.badgeSuccess
                        : styles.badgeDanger
                    }`}
                  >
                    {certResult.status} ({certResult.daysRemaining} days left)
                  </span>
                </span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statLabel}>Common Name (CN)</span>
                <span className={styles.statValue}>{certResult.subject["CN"] || "N/A"}</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statLabel}>Issuer</span>
                <span className={styles.statValue}>
                  {certResult.issuer["O"] || certResult.issuer["CN"] || "N/A"}
                </span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statLabel}>Validity Period</span>
                <span className={styles.statValue}>
                  {certResult.validFrom} to {certResult.validTo}
                </span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statLabel}>Serial Number</span>
                <span className={styles.statValue}>{certResult.serialNumber}</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statLabel}>Signature Algorithm</span>
                <span className={styles.statValue}>{certResult.signatureAlgorithm}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. Ports Reference */}
      {toolId === "port-reference" && (
        <div className={styles.panel}>
          <div className={styles.headingRow}>
            <span className={styles.panelTitle}>Common Ports Directory</span>
          </div>

          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label htmlFor="port-filter">Search by Port, Service or Description</label>
              <input
                id="port-filter"
                type="text"
                className={styles.input}
                value={portQuery}
                onChange={(e) => setPortQuery(e.target.value)}
                placeholder="e.g. 443, postgres, ssh, web..."
              />
            </div>
          </div>

          <div className={styles.chipGroup}>
            {["All", "Web", "Database", "Mail", "Remote Access", "Network & Infrastructure", "Dev & Cloud"].map((cat) => (
              <button
                key={cat}
                type="button"
                className={`${styles.chip} ${selectedPortCategory === cat ? styles.chipActive : ""}`}
                onClick={() => setSelectedPortCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Port</th>
                  <th>Protocol</th>
                  <th>Service</th>
                  <th>Category</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {searchPorts(portQuery)
                  .filter((p) => selectedPortCategory === "All" || p.category === selectedPortCategory)
                  .map((p) => (
                    <tr key={`${p.port}-${p.service}`}>
                      <td><strong>{p.port}</strong></td>
                      <td>{p.protocol}</td>
                      <td>{p.service}</td>
                      <td><span className={`${styles.badge} ${styles.badgeInfo}`}>{p.category}</span></td>
                      <td>{p.description}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. .gitignore Generator */}
      {toolId === "gitignore-generator" && (
        <div className={styles.panel}>
          <div className={styles.headingRow}>
            <span className={styles.panelTitle}>Presets Selection</span>
            <div className={styles.buttonBar}>
              <button
                type="button"
                className={styles.actionButton}
                onClick={() => copyText(generateGitignore(selectedPresets), "gitignore")}
              >
                {copied === "gitignore" ? "✓ Copied" : "Copy .gitignore"}
              </button>
              <button
                type="button"
                className={styles.actionButton}
                onClick={() => downloadText(generateGitignore(selectedPresets), ".gitignore")}
              >
                Download .gitignore
              </button>
            </div>
          </div>

          <div className={styles.chipGroup}>
            {Object.keys(GITIGNORE_PRESETS).map((preset) => {
              const active = selectedPresets.includes(preset);
              return (
                <button
                  key={preset}
                  type="button"
                  className={`${styles.chip} ${active ? styles.chipActive : ""}`}
                  onClick={() => {
                    setSelectedPresets((prev) =>
                      active ? prev.filter((p) => p !== preset) : [...prev, preset]
                    );
                  }}
                >
                  {preset} {active ? "✓" : "+"}
                </button>
              );
            })}
          </div>

          <pre className={styles.codeBox} aria-label="Generated .gitignore">
            <code>{generateGitignore(selectedPresets) || "# Select presets above to generate .gitignore"}</code>
          </pre>
        </div>
      )}

      {/* 6. Dockerfile Generator */}
      {toolId === "dockerfile-generator" && (
        <div className={styles.panel}>
          <div className={styles.headingRow}>
            <span className={styles.panelTitle}>Dockerfile Builder</span>
            <div className={styles.buttonBar}>
              <button
                type="button"
                className={styles.actionButton}
                onClick={() =>
                  copyText(
                    generateDockerfile({
                      language: dockerLang,
                      version: dockerVersion,
                      port: dockerPort,
                      multiStage,
                      nonRoot,
                    }),
                    "dockerfile"
                  )
                }
              >
                {copied === "dockerfile" ? "✓ Copied" : "Copy Dockerfile"}
              </button>
              <button
                type="button"
                className={styles.actionButton}
                onClick={() =>
                  downloadText(
                    generateDockerfile({
                      language: dockerLang,
                      version: dockerVersion,
                      port: dockerPort,
                      multiStage,
                      nonRoot,
                    }),
                    "Dockerfile"
                  )
                }
              >
                Download Dockerfile
              </button>
            </div>
          </div>

          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label>Runtime / Language</label>
              <select
                className={styles.input}
                value={dockerLang}
                onChange={(e) => setDockerLang(e.target.value as any)}
              >
                <option value="node">Node.js</option>
                <option value="python">Python</option>
                <option value="go">Go (Golang)</option>
                <option value="rust">Rust</option>
                <option value="nginx">Static Nginx</option>
              </select>
            </div>
            <div className={styles.field}>
              <label>Base Version Tag</label>
              <input
                type="text"
                className={styles.input}
                value={dockerVersion}
                onChange={(e) => setDockerVersion(e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label>Exposed Port</label>
              <input
                type="number"
                className={styles.input}
                value={dockerPort}
                onChange={(e) => setDockerPort(parseInt(e.target.value, 10) || 3000)}
              />
            </div>
          </div>

          <div className={styles.chipGroup}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={multiStage}
                onChange={(e) => setMultiStage(e.target.checked)}
              />
              Multi-Stage Build (Production Optimizations)
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", cursor: "pointer", marginLeft: "1rem" }}>
              <input
                type="checkbox"
                checked={nonRoot}
                onChange={(e) => setNonRoot(e.target.checked)}
              />
              Non-Root Security User
            </label>
          </div>

          <pre className={styles.codeBox} aria-label="Generated Dockerfile">
            <code>
              {generateDockerfile({
                language: dockerLang,
                version: dockerVersion,
                port: dockerPort,
                multiStage,
                nonRoot,
              })}
            </code>
          </pre>
        </div>
      )}

      {/* 7. Docker Run to Compose */}
      {toolId === "docker-run-to-compose" && (
        <div className={styles.panel}>
          <div className={styles.headingRow}>
            <span className={styles.panelTitle}>Docker Run to Compose</span>
            <div className={styles.buttonBar}>
              <button
                type="button"
                className={styles.actionButton}
                onClick={() => copyText(dockerRunOutput, "compose")}
                disabled={!dockerRunOutput}
              >
                {copied === "compose" ? "✓ Copied" : "Copy Compose"}
              </button>
              <button
                type="button"
                className={styles.actionButton}
                onClick={() => downloadText(dockerRunOutput, "docker-compose.yml")}
                disabled={!dockerRunOutput}
              >
                Download docker-compose.yml
              </button>
            </div>
          </div>

          <div className={styles.field}>
            <label htmlFor="docker-run-input">Docker Run Command</label>
            <textarea
              id="docker-run-input"
              className={styles.textarea}
              value={input}
              onChange={(e) => handleDockerRunChange(e.target.value)}
              placeholder="e.g. docker run -d --name web -p 8080:80 nginx:alpine"
            />
          </div>

          {error && <div className={styles.errorBanner}>{error}</div>}

          {dockerRunOutput && (
            <pre className={styles.codeBox} aria-label="Generated Compose YAML">
              <code>{dockerRunOutput}</code>
            </pre>
          )}
        </div>
      )}

      {/* 8. SemVer Calculator */}
      {toolId === "semver-calculator" && (
        <div className={styles.panel}>
          <div className={styles.headingRow}>
            <span className={styles.panelTitle}>SemVer Inspector &amp; Comparator</span>
          </div>

          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label htmlFor="semver-v1">Version 1 (Target)</label>
              <input
                id="semver-v1"
                type="text"
                className={styles.input}
                value={v1}
                onChange={(e) => setV1(e.target.value)}
                placeholder="e.g. 1.2.3"
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="semver-v2">Version 2 (Comparison)</label>
              <input
                id="semver-v2"
                type="text"
                className={styles.input}
                value={v2}
                onChange={(e) => setV2(e.target.value)}
                placeholder="e.g. 2.0.0"
              />
            </div>
          </div>

          {(() => {
            try {
              const p1 = parseSemver(v1);
              let cmpText = "";
              if (v2.trim()) {
                const cmp = compareSemver(v1, v2);
                if (cmp === 0) cmpText = `${v1} is equal to ${v2}`;
                else if (cmp > 0) cmpText = `${v1} is greater than (newer than) ${v2}`;
                else cmpText = `${v1} is less than (older than) ${v2}`;
              }

              return (
                <div className={styles.resultsGrid}>
                  <div className={styles.statCard}>
                    <span className={styles.statLabel}>Major.Minor.Patch</span>
                    <span className={styles.statValue}>
                      {p1.major}.{p1.minor}.{p1.patch}
                    </span>
                  </div>
                  <div className={styles.statCard}>
                    <span className={styles.statLabel}>Next Patch (+0.0.1)</span>
                    <span className={styles.statValue}>{p1.nextPatch}</span>
                  </div>
                  <div className={styles.statCard}>
                    <span className={styles.statLabel}>Next Minor (+0.1.0)</span>
                    <span className={styles.statValue}>{p1.nextMinor}</span>
                  </div>
                  <div className={styles.statCard}>
                    <span className={styles.statLabel}>Next Major (+1.0.0)</span>
                    <span className={styles.statValue}>{p1.nextMajor}</span>
                  </div>
                  {cmpText && (
                    <div className={styles.statCard} style={{ gridColumn: "1 / -1" }}>
                      <span className={styles.statLabel}>Version Comparison</span>
                      <span className={styles.statValue}>{cmpText}</span>
                    </div>
                  )}
                </div>
              );
            } catch (err) {
              return <div className={styles.errorBanner}>{(err as Error).message}</div>;
            }
          })()}
        </div>
      )}
    </div>
  );
}
