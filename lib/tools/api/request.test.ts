import { afterEach, describe, expect, it, vi } from "vitest";
import { executeApiRequest, NETWORK_WARNING } from "./request";

afterEach(() => vi.unstubAllGlobals());

describe("explicit direct browser API tester", () => {
  it.each([200, 201, 204, 400, 401, 404, 422, 500, 503])("returns HTTP %i as response data with no retry", async status => {
    const body = status === 204 ? null : '<script>untrusted()</script>雪'; const response = new Response(body, { status, statusText: status < 400 ? "Success" : "Failure", headers: { "Content-Type": "text/plain", "X-Api": "test" } });
    const fetch = vi.fn().mockResolvedValue(response); vi.stubGlobal("fetch", fetch);
    const result = await executeApiRequest({ url: "https://example.test/api", method: "GET" });
    expect(fetch).toHaveBeenCalledTimes(1); expect(fetch).toHaveBeenCalledWith("https://example.test/api", { method: "GET", headers: [], signal: undefined, credentials: "omit" });
    expect(result.data).toMatchObject({ statusCode: status, statusText: status < 400 ? "Success" : "Failure", responseBody: body ?? "", state: "Completed", ok: status < 400 });
    expect(result.data!.responseHeaders).toContainEqual({ name: "x-api", value: "test" }); expect(result.data!.responseTime).toBeGreaterThanOrEqual(0);
  });
  it("uses exact URL/query/header/body inputs in one direct fetch", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{"ok":true}')); vi.stubGlobal("fetch", fetch); const controller = new AbortController();
    await executeApiRequest({ method: "POST", url: "https://example.test/path", parameters: [{ key: "q", value: "雪" }, { key: "q", value: "" }], headers: [{ name: "Authorization", value: "Bearer exact" }, { name: "X", value: "a" }, { name: "X", value: "b" }], bodyType: "JSON", body: '{"id":1}' }, controller.signal);
    expect(fetch).toHaveBeenCalledWith("https://example.test/path?q=%E9%9B%AA&q=", { method: "POST", headers: [["Authorization", "Bearer exact"], ["X", "a"], ["X", "b"], ["Content-Type", "application/json"]], body: '{\n  "id": 1\n}', signal: controller.signal, credentials: "omit" });
  });
  it.each(["GET", "HEAD"])("omits %s body and returns warning", async method => {
    const fetch = vi.fn().mockResolvedValue(new Response(null)); vi.stubGlobal("fetch", fetch);
    const result = await executeApiRequest({ method, url: "https://example.test", bodyType: "Text", body: "ignored" });
    expect(fetch.mock.calls[0][1]).not.toHaveProperty("body"); expect(result.warnings?.join(" ")).toContain("do not support");
  });
  it.each([new TypeError("Failed to fetch"), new Error("secret transport details")])("returns a Network or CORS error without leaking transport messages", async error => {
    const fetch = vi.fn().mockRejectedValue(error); vi.stubGlobal("fetch", fetch);
    const result = await executeApiRequest({ url: "https://example.test" });
    expect(result.data).toMatchObject({ state: "Network or CORS error", statusCode: null, responseBody: "" }); expect(result.warnings).toEqual([NETWORK_WARNING]); expect(result.text).not.toContain(error.message); expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("distinguishes AbortError and never retries", async () => {
    const fetch = vi.fn().mockRejectedValue(new DOMException("Cancelled", "AbortError")); vi.stubGlobal("fetch", fetch);
    const result = await executeApiRequest({ url: "https://example.test" }); expect(result.data).toMatchObject({ state: "Aborted", statusCode: null }); expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("does not send a request when its signal is already aborted", async () => { const controller = new AbortController(); controller.abort(); const fetch = vi.fn(); vi.stubGlobal("fetch", fetch); expect((await executeApiRequest({ url: "https://example.test" }, controller.signal)).data!.state).toBe("Aborted"); expect(fetch).not.toHaveBeenCalled(); });
  it("distinguishes an aborted signal even with a generic rejection", async () => {
    const controller = new AbortController(); const fetch = vi.fn().mockImplementation(async () => { controller.abort(); throw new TypeError("Failed"); }); vi.stubGlobal("fetch", fetch);
    expect((await executeApiRequest({ url: "https://example.test" }, controller.signal)).data!.state).toBe("Aborted"); expect(fetch).toHaveBeenCalledTimes(1);
  });
  it.each([{ url: "ftp://example.test" }, { url: "https://example.test", method: "TRACE" }, { url: "https://example.test", headers: [{ name: "X", value: "x\r\nY: 1" }] }, { url: "https://example.test", bodyType: "JSON", body: "{" }])("rejects invalid input before fetch %j", async values => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch); await expect(executeApiRequest(values)).rejects.toThrow(); expect(fetch).not.toHaveBeenCalled();
  });
  it("decodes streaming UTF-8 across chunk boundaries", async () => {
    const bytes = new TextEncoder().encode("雪🔑"); const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(bytes.slice(0, 2)); controller.enqueue(bytes.slice(2, 5)); controller.enqueue(bytes.slice(5)); controller.close(); } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(stream)));
    expect((await executeApiRequest({ url: "https://example.test" })).data!.responseBody).toBe("雪🔑");
  });
  it("rejects non-ByteString header values before fetch", async () => { const fetch = vi.fn(); vi.stubGlobal("fetch", fetch); await expect(executeApiRequest({ url: "https://example.test", headers: [{ name: "X", value: "雪" }] })).rejects.toThrow(/ByteString/); expect(fetch).not.toHaveBeenCalled(); });
  it("rejects an oversized response without silent truncation", async () => {
    const cancel = vi.fn(); const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new TextEncoder().encode("x".repeat(200_001))); }, cancel });
    const fetch = vi.fn().mockResolvedValue(new Response(stream)); vi.stubGlobal("fetch", fetch);
    await expect(executeApiRequest({ url: "https://example.test" })).rejects.toThrow(/200,000/); expect(cancel).toHaveBeenCalledTimes(1); expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("rejects the full output budget even when body alone fits", async () => { vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("x".repeat(100_000)))); await expect(executeApiRequest({ url: "https://example.test" })).rejects.toThrow(/output limit/); });
});
