# Security Policy

Security and user privacy are foundational to Code Station. All developer tools are engineered to run 100% locally in your browser or local MCP runtime with zero server uploads of user inputs or files.

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues, discussions, or pull requests.**

To report a suspected vulnerability privately, use either of the following channels:

1. **GitHub Security Advisories (Preferred):**
   Submit a private report directly at [github.com/tejreddym/codestation/security/advisories/new](https://github.com/tejreddym/codestation/security/advisories/new).
2. **Security Contact Email:**
   Send an encrypted or detailed report to **`security@codestation.in`**.

Please include:
- A clear description of the vulnerability and its potential impact.
- Step-by-step reproduction instructions or a minimal proof-of-concept.
- The affected URL, file path, API endpoint, or package version.
- Any suggested remediation, if known.

## Response SLA

We take every report seriously and commit to the following timeline:

- **Acknowledgement:** Within **48 hours** (2 business days) of receiving your report.
- **Triage & Severity Assessment:** Within **5 business days**, confirming whether the issue is reproducible and within scope.
- **Progress Updates:** At least every **7 days** while a fix is actively being developed and tested.
- **Coordinated Disclosure:** We ask that you give us reasonable time to deploy a patch and release an advisory before any public disclosure.

## Scope

The following surfaces are **in scope** for security reports:

1. **`codestation.in` Web Application**
   - Cross-site scripting (XSS), HTML/SVG/PDF sanitization bypasses, and DOM injection vulnerabilities.
   - Unexpected network egress or silent server transmission from client-only tool workspaces (excluding documented opt-in tools such as the API Request Tester and Markdown remote image previews).
   - Content Security Policy (CSP), Web Worker isolation, and WebMCP (`document.modelContext`) boundary issues.
2. **Razorpay Checkout & License API**
   - Server-side endpoints under `/api/create-order`, `/api/verify-payment`, `/api/v1/license/create`, and `/api/v1/license/verify`.
   - Signature verification bypasses, unauthorized license issuance/validation, secret exposure, or authentication/authorization flaws.
3. **`codestation-mcp` Local MCP Server (`codestation-mcp` npm package / `mcp/cli.ts`)**
   - Command injection, path traversal, arbitrary file access, or unsafe tool argument handling in the CLI or MCP server runtime.

### Out of Scope

- Vulnerabilities solely within third-party hosted services (e.g., Razorpay's external checkout infrastructure or Cloudflare's edge platform).
- Denial-of-service resulting from a user intentionally loading extremely large malformed files into their own local browser tab without persistence or cross-user impact.
- Findings from automated scanners without a reproducible proof of concept.
