import { describe, it, expect } from "vitest";
import { auditEnv, formatEnvAuditReport } from "./env-audit";

describe("auditEnv scanner", () => {
  it("detects live AWS and Stripe secrets", () => {
    const env = `
PORT=3000
AWS_KEY=AKIAIOSFODNN7EXAMPLE
STRIPE_KEY=sk_live_51Abcdef1234567890abcdef123456
OPENAI_KEY=sk-proj-abc1234567890def1234567890ghij123
`;
    const res = auditEnv(env);
    expect(res.isSecure).toBe(false);
    expect(res.stats.critical).toBe(2); // AWS + Stripe
    expect(res.stats.high).toBe(1); // OpenAI
    expect(res.findings.some((f) => f.key === "AWS_KEY" && f.severity === "CRITICAL")).toBe(true);
    expect(res.findings.some((f) => f.key === "STRIPE_KEY" && f.severity === "CRITICAL")).toBe(true);
    expect(res.findings.some((f) => f.key === "OPENAI_KEY" && f.severity === "HIGH")).toBe(true);
  });

  it("detects private key patterns including test keys", () => {
    const env = `PRIVATE_KEY="-----BEGIN TEST KEY-----"\nRSA_KEY="-----BEGIN RSA PRIVATE KEY-----"`;
    const res = auditEnv(env);
    expect(res.findings.filter(f => f.category === "SECRET_LEAK" && f.severity === "CRITICAL").length).toBe(2);
    expect(res.findings[0].maskedValue).toBe("•••••[PRIVATE KEY]•••••");
  });

  it("detects database connection string credentials", () => {
    const env = `DATABASE_URL=postgres://app_user:secretpassword123@db.example.invalid:5432/production`;
    const res = auditEnv(env);
    expect(res.findings.some(f => f.key === "DATABASE_URL" && f.severity === "HIGH")).toBe(true);
    expect(res.findings[0].maskedValue).toContain("••••••••");
  });

  it("detects secrets in JSON format", () => {
    const jsonConfig = JSON.stringify({
      PORT: "3000",
      STRIPE_SECRET: "sk_live_51Abcdef1234567890abcdef123456",
    });
    const res = auditEnv(jsonConfig);
    expect(res.isSecure).toBe(false);
    expect(res.stats.critical).toBe(1);
    expect(res.findings[0].key).toBe("STRIPE_SECRET");
  });

  it("detects weak passwords and duplicate keys", () => {
    const env = `
DATABASE_PASSWORD=password
DB_HOST=localhost
DATABASE_PASSWORD=newpassword
`;
    const res = auditEnv(env);
    expect(res.findings.some((f) => f.category === "WEAK_VALUE")).toBe(true);
    expect(res.findings.some((f) => f.category === "DUPLICATE_KEY")).toBe(true);
  });

  it("diffs against .env.example", () => {
    const env = `
PORT=8080
DATABASE_URL=postgres://user:pass@localhost:5432/db
EXTRA_VAR=something
`;
    const example = `
PORT=3000
DATABASE_URL=
REQUIRED_SECRET=
`;
    const res = auditEnv(env, example);
    expect(res.findings.some((f) => f.category === "MISSING_VAR" && f.key === "REQUIRED_SECRET")).toBe(true);
    expect(res.findings.some((f) => f.category === "EXTRA_VAR" && f.key === "EXTRA_VAR")).toBe(true);
  });

  it("respects ignore rules", () => {
    const env = `
PUBLIC_KEY=AKIAIOSFODNN7EXAMPLE
SECRET_KEY=AKIAIOSFODNN7EXAMPLE
`;
    const res = auditEnv(env, { ignoreRules: ["PUBLIC_*"] });
    expect(res.findings.length).toBe(1);
    expect(res.findings[0].key).toBe("SECRET_KEY");
  });

  it("formats a human-readable CLI report", () => {
    const env = `API_KEY=sk_live_123456789012345678901234`;
    const res = auditEnv(env);
    const report = formatEnvAuditReport(res);
    expect(report).toContain("CODE STATION ENVIRONMENT AUDIT REPORT");
    expect(report).toContain("[CRITICAL]");
    expect(report).toContain("Live Stripe Secret Key detected");
  });
});
