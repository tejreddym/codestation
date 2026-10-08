import { describe, expect, it, vi, afterEach } from "vitest";
import { localApi } from "./local";
import { convertApi } from "./curl";
import { apiTools } from "../../../config/api-tools";
afterEach(() => vi.unstubAllGlobals());
describe("API public examples and boundaries", () => {
  it.each(apiTools.filter(tool => !tool.apiContract.sendsRequest))("$id example succeeds without any networking", async tool => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    const run = tool.id.startsWith("curl-") || tool.id === "fetch-to-curl" ? convertApi : localApi;
    const result = await run(tool.id, { ...tool.apiContract.defaults, ...tool.apiContract.example });
    expect(result.text).not.toBe(""); expect(fetch).not.toHaveBeenCalled();
    expect(result.data?.valid).not.toBe(false);
  });
  it("JSON body fields preserve even integer-like key order", async () => {
    const result = await localApi("json-request-body-builder", { fields: [{ key: "9", value: "first" }, { key: "2", value: "second" }, { key: "name", value: "third" }] });
    expect(String(result.data?.formatted).indexOf('"9"')).toBeLessThan(String(result.data?.formatted).indexOf('"2"'));
    expect(JSON.parse(String(result.data?.formatted))).toEqual({ "9": "first", "2": "second", name: "third" });
  });
  it("nested GraphQL list selection formats as an operation", async () => {
    const result = await localApi("graphql-query-builder", { rootField: "user", selectedFields: ["id", "profile { name address { city } }"] });
    expect(result.data?.query).toContain("address {");
    await expect(localApi("graphql-query-builder", { rootField: "user", selectedFields: ["id } mutation Evil { delete"] })).rejects.toThrow();
  });
  it.each(['[]', '{'])("rejects malformed/nonobject variables %s", async json => {
    expect((await localApi("graphql-variables-formatter", { json })).data?.valid).toBe(false);
  });
  it.each(["a b", "abc\tdef", "a\0b"])("rejects unsafe bearer whitespace %j", async token => {
    await expect(localApi("bearer-token-header-generator", { token })).rejects.toThrow();
  });
  it("conversion validation targets the actual source control", async () => {
    await expect(convertApi("curl-to-fetch", { command: "curl --cert secret.pem https://example.com/" })).rejects.toMatchObject({ field: "command" });
    await expect(convertApi("fetch-to-curl", { code: "fetch(dynamicUrl)" })).rejects.toMatchObject({ field: "code" });
  });
});
