// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { getCloudflareAnalyticsToken, isCloudflareAnalyticsEnabled } from "./analytics";

vi.mock("next/script", () => ({
  default: ({ id, src, ...rest }: Record<string, unknown>) => (
    <div
      data-mock-next-script={String(id)}
      data-src={String(src)}
      data-cf-beacon={typeof rest["data-cf-beacon"] === "string" ? rest["data-cf-beacon"] : ""}
    />
  ),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("Cloudflare Web Analytics configuration", () => {
  it("is disabled and renders nothing when NEXT_PUBLIC_CF_WEB_ANALYTICS_TOKEN is unset", async () => {
    vi.stubEnv("NEXT_PUBLIC_CF_WEB_ANALYTICS_TOKEN", "");
    expect(getCloudflareAnalyticsToken()).toBeNull();
    expect(isCloudflareAnalyticsEnabled()).toBe(false);

    const { default: CloudflareWebAnalytics } = await import("@/components/CloudflareWebAnalytics");
    const { container } = render(<CloudflareWebAnalytics />);
    expect(container.innerHTML).toBe("");
  });

  it("injects Cloudflare beacon script when a valid token is configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_CF_WEB_ANALYTICS_TOKEN", "cf_token_1234567890");
    expect(getCloudflareAnalyticsToken()).toBe("cf_token_1234567890");
    expect(isCloudflareAnalyticsEnabled()).toBe(true);

    const { default: CloudflareWebAnalytics } = await import("@/components/CloudflareWebAnalytics");
    const { container } = render(<CloudflareWebAnalytics />);
    const script = container.querySelector("[data-mock-next-script='cf-web-analytics']");
    expect(script).not.toBeNull();
    expect(script?.getAttribute("data-src")).toBe("https://static.cloudflareinsights.com/beacon.min.js");
    expect(script?.getAttribute("data-cf-beacon")).toBe(
      JSON.stringify({ token: "cf_token_1234567890", spa: true })
    );
  });
});
