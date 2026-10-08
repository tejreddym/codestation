// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiTools, type ApiToolId } from "@/config/api-tools";
import * as conversions from "@/lib/tools/api/curl";
import * as local from "@/lib/tools/api/local";
import * as requests from "@/lib/tools/api/request";
import { ApiError, type ApiResult, type ApiValues } from "@/lib/tools/api/types";
import ApiStation from "./ApiStation";

const conversionIds = new Set(["curl-to-fetch", "fetch-to-curl", "curl-to-axios", "curl-to-python-requests"]);
const structured = new Set(["entries", "headers", "parameters", "fields", "arguments", "selectedFields"]);
const run = (id: ApiToolId, values: ApiValues) => conversionIds.has(id) ? conversions.convertApi(id, values) : local.localApi(id, values);
const definition = (id: ApiToolId) => apiTools.find(tool => tool.id === id)!;
const labeled = (label: string) => screen.getByLabelText(new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?: \\(optional\\))?$`));
const field = (id: ApiToolId, name: string) => labeled(definition(id).apiContract.fields.find(item => item.name === name)!.label);
const set = (id: ApiToolId, name: string, value: string) => fireEvent.change(field(id, name), { target: { value } });
const send = (id: ApiToolId) => fireEvent.click(screen.getByRole("button", { name: definition(id).apiContract.action }));
const load = () => fireEvent.click(screen.getByRole("button", { name: "Load example" }));
const response = (status = 200, body = "✓ hello 世界"): ApiResult => ({ text: JSON.stringify({ status, body }), copyText: body, data: { status, ok: status < 400, body, headers: { "content-type": "text/plain" }, durationMs: 12 } });

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); document.documentElement.removeAttribute("data-theme"); });

describe.each(["light", "dark"])("API %s theme controls (DOM, not visual acceptance)", theme => {
  it.each(apiTools)("$id exact fields, explicit action, Copy/Clear and no hidden request", async tool => {
    document.documentElement.dataset.theme = theme;
    const user = userEvent.setup(); const clipboard = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    const xhr = vi.spyOn(XMLHttpRequest.prototype, "send"); const storage = vi.spyOn(Storage.prototype, "setItem"); const log = vi.spyOn(console, "log");
    const tester = vi.spyOn(requests, "executeApiRequest").mockResolvedValue(response());
    const { container } = render(<ApiStation toolId={tool.id} />); const contract = tool.apiContract;
    expect(container.querySelectorAll("form input,form textarea,form select").length).toBe(contract.fields.filter(item => !structured.has(item.control)).length);
    for (const input of contract.fields) {
      if (structured.has(input.control)) expect(screen.getByRole("group", { name: input.label })).toBeTruthy();
      else {
        const control = labeled(input.label);
        expect(control.id).toBe(`api-${tool.id}-${input.name}`);
        if (input.control === "password" || input.name === "password" || input.name === "token") {
          expect(control.getAttribute("type")).toBe("password"); expect(control.getAttribute("autocomplete")).toBe("off");
        }
        if (input.control === "textarea") expect(control.tagName).toBe("TEXTAREA");
      }
    }
    expect(tester).not.toHaveBeenCalled();
    const example = screen.getByRole("button", { name: "Load example" }); example.focus(); await user.keyboard("{Enter}");
    expect(tester).not.toHaveBeenCalled();
    const action = screen.getByRole("button", { name: contract.action }); action.focus(); await user.keyboard("{Enter}");
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe(tool.id === "api-request-tester" ? "Success. Response received." : "Result ready."));
    const next = tool.id === "api-request-tester" ? response() : await run(tool.id, { ...contract.defaults, ...contract.example });
    if (contract.copy) {
      if (tool.id === "rest-api-request-builder") {
        for (const [name, value] of [["Copy cURL", next.data?.curl], ["Copy Fetch", next.data?.fetch]] as const) {
          const copy = screen.getByRole("button", { name }); copy.focus(); await user.keyboard("{Enter}"); expect(clipboard).toHaveBeenLastCalledWith(value);
        }
      } else {
        const copy = screen.getByRole("button", { name: tool.id === "api-request-tester" ? "Copy Response" : `Copy ${contract.outputs.join(" · ")}` });
        const copyField = (contract as { copyField?: string }).copyField;
        const copySource = copyField ? next.data?.[copyField] : undefined;
        copy.focus(); await user.keyboard("{Enter}"); expect(clipboard).toHaveBeenLastCalledWith(next.copyText ?? (typeof copySource === "string" ? copySource : copySource !== undefined ? JSON.stringify(copySource, null, 2) : next.text));
      }
    } else expect(screen.queryByRole("button", { name: /^Copy/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Download/ })).toBeNull();
    const clear = screen.getByRole("button", { name: "Clear" }); clear.focus(); await user.keyboard("{Enter}");
    for (const input of contract.fields) if (!structured.has(input.control)) expect((labeled(input.label) as HTMLInputElement).value).toBe(contract.defaults[input.name] ?? "");
    expect(container.querySelector("pre")).toBeNull(); expect(screen.queryByRole("alert")).toBeNull(); expect(screen.getByRole("status").textContent).toBe("");
    expect(fetch).not.toHaveBeenCalled(); expect(xhr).not.toHaveBeenCalled(); expect(storage).not.toHaveBeenCalled(); expect(log).not.toHaveBeenCalled();
    expect(tester).toHaveBeenCalledTimes(tool.id === "api-request-tester" ? 1 : 0);
  });
});

describe("API structured rows", () => {
  const cases = apiTools.flatMap(tool => tool.apiContract.fields.filter(input => structured.has(input.control)).map(input => ({ tool, input })));
  it.each(cases)("$tool.id $input.name keyboard add/remove, labels and focus", async ({ tool, input }) => {
    const nouns: Record<string, string> = { entries: "header", headers: "header", parameters: "parameter", fields: "field", arguments: "argument", selectedFields: "selected field" };
    const fields: Record<string, string[]> = { entries: ["name", "value"], headers: ["name", "value"], parameters: ["key", "value"], fields: ["key", "value type", "value"], arguments: ["name", "value type", "value"], selectedFields: [""] };
    const user = userEvent.setup(); render(<ApiStation toolId={tool.id} />);
    const group = screen.getByRole("group", { name: input.label }); const noun = nouns[input.control]; const title = noun[0].toUpperCase() + noun.slice(1);
    const add = within(group).getByRole("button", { name: `Add ${noun}` }); add.focus(); await user.keyboard("{Enter}");
    for (const name of fields[input.control]) expect(within(group).getByLabelText(`${title} 1${name ? ` ${name}` : ""}`)).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(within(group).getByLabelText(`${title} 1${fields[input.control][0] ? ` ${fields[input.control][0]}` : ""}`)));
    const remove = within(group).getByRole("button", { name: `Remove ${noun} 1` }); remove.focus(); await user.keyboard("{Enter}");
    await waitFor(() => expect(document.activeElement).toBe(add)); expect(within(group).queryAllByRole("textbox")).toHaveLength(0);
  });
  it("keeps repeated query keys and empty values in REST generation", async () => {
    const id = "rest-api-request-builder"; const user = userEvent.setup(); render(<ApiStation toolId={id} />); set(id, "url", "https://example.com/");
    for (let index = 1; index <= 2; index++) {
      await user.click(screen.getByRole("button", { name: "Add parameter" }));
      fireEvent.change(screen.getByLabelText(`Parameter ${index} key`), { target: { value: "tag" } }); fireEvent.change(screen.getByLabelText(`Parameter ${index} value`), { target: { value: index === 1 ? "✓ 世界" : "" } });
    }
    send(id); expect((await screen.findByLabelText("cURL value")).textContent).toContain("tag=%E2%9C%93+%E4%B8%96%E7%95%8C&tag=");
  });
  it("changes a typed JSON field and completely clears structured data", async () => {
    const id = apiTools.find(tool => tool.apiContract.fields.some(input => input.control === "fields"))!.id;
    const user = userEvent.setup(); render(<ApiStation toolId={id} />); await user.click(screen.getByRole("button", { name: "Add field" }));
    fireEvent.change(screen.getByLabelText("Field 1 key"), { target: { value: "message" } }); fireEvent.change(screen.getByLabelText("Field 1 value"), { target: { value: "✓ 世界 🛰️" } });
    send(id); await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Result ready.")); expect(screen.getByLabelText(`${definition(id).apiContract.outputs.join(" · ")} value`).textContent).toContain("✓ 世界 🛰️");
    await user.selectOptions(screen.getByLabelText("Field 1 value type"), "Null"); expect((screen.getByLabelText("Field 1 value") as HTMLInputElement).disabled).toBe(true);
    await user.click(screen.getByRole("button", { name: "Clear" })); expect(screen.queryByLabelText("Field 1 key")).toBeNull();
  });
});

describe("API validation, inert output and privacy", () => {
  it.each(apiTools.filter(tool => tool.id !== "api-request-tester"))("$id empty action finishes locally with a result or an associated error", async tool => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch); render(<ApiStation toolId={tool.id} />); send(tool.id);
    await waitFor(() => expect(["Result ready.", "Check the input error."]).toContain(screen.getByRole("status").textContent));
    if (screen.getByRole("status").textContent === "Check the input error.") {
      const alert = screen.getByRole("alert"); expect(alert.textContent).not.toBe(""); await waitFor(() => expect(document.activeElement).not.toBe(document.body));
    } else expect(screen.getByLabelText(`${tool.apiContract.outputs.join(" · ")} value`)).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each(apiTools)("$id invalid field is associated, focused and clears on edit", async tool => {
    const input = tool.apiContract.fields[0];
    const engine = tool.id === "api-request-tester" ? vi.spyOn(requests, "executeApiRequest") : conversionIds.has(tool.id) ? vi.spyOn(conversions, "convertApi") : vi.spyOn(local, "localApi");
    engine.mockImplementationOnce(() => { throw new ApiError("Invalid input.", input.name); });
    const { container } = render(<ApiStation toolId={tool.id} />); send(tool.id);
    const alert = await screen.findByRole("alert"); const control = container.querySelector<HTMLElement>(`[data-api-field="${input.name}"]`)!;
    expect(control.getAttribute("aria-describedby")).toContain(alert.id); await waitFor(() => expect(document.activeElement).toBe(control));
    if (structured.has(input.control)) fireEvent.click(control); else fireEvent.change(control, { target: { value: input.control === "select" ? input.options?.at(-1) : "edited" } });
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it.each(["curl-to-fetch", "curl-to-axios", "curl-to-python-requests", "fetch-to-curl"] as const)("%s preserves Unicode in local generated code", async id => {
    render(<ApiStation toolId={id} />);
    set(id, id === "fetch-to-curl" ? "code" : "command", id === "fetch-to-curl" ? 'fetch("https://example.com/", {method: "POST", body: "✓ 世界 🛰️"})' : "curl -X POST 'https://example.com/' --data-raw '✓ 世界 🛰️'");
    send(id); expect((await screen.findByLabelText(`${definition(id).apiContract.outputs.join(" · ")} value`)).textContent).toContain("✓ 世界 🛰️");
  });
  it.each(apiTools.filter(tool => !conversionIds.has(tool.id) && tool.id !== "api-request-tester"))("$id Unicode survives its tool-specific local inputs", async tool => {
    const unicode = "✓ 世界 🛰️";
    const user = userEvent.setup(); const { container } = render(<ApiStation toolId={tool.id} />); load();
    switch (tool.id) {
      case "http-header-builder": fireEvent.change(screen.getByLabelText("Header 1 value"), { target: { value: unicode } }); break;
      case "http-header-parser": set(tool.id, "raw", `X-Unicode: ${unicode}`); break;
      case "rest-api-request-builder": set(tool.id, "method", "POST"); set(tool.id, "bodyType", "Text"); set(tool.id, "body", unicode); break;
      case "http-request-builder": set(tool.id, "body", unicode); break;
      case "json-request-body-builder": await user.selectOptions(screen.getByLabelText("Field 1 value type"), "String"); fireEvent.change(screen.getByLabelText("Field 1 value"), { target: { value: unicode } }); break;
      case "api-response-formatter": set(tool.id, "body", JSON.stringify({ message: unicode })); set(tool.id, "format", "JSON"); break;
      case "graphql-formatter": set(tool.id, "query", `query Q { user(name: "${unicode}") { id } }`); break;
      case "graphql-query-builder":
        await user.click(screen.getByRole("button", { name: "Add argument" }));
        const index = container.querySelectorAll('[data-remove="arguments"]').length;
        fireEvent.change(screen.getByLabelText(`Argument ${index} name`), { target: { value: "message" } }); fireEvent.change(screen.getByLabelText(`Argument ${index} value`), { target: { value: unicode } }); break;
      case "graphql-variables-formatter": set(tool.id, "json", JSON.stringify({ message: unicode })); break;
      case "basic-auth-header-generator": set(tool.id, "username", unicode); break;
      case "bearer-token-header-generator": set(tool.id, "token", unicode.replace(/ /g, "")); break;
      default: throw new Error(`Add a Unicode user-flow vector for ${tool.id}`);
    }
    send(tool.id); await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Result ready."));
    if (tool.id === "basic-auth-header-generator") expect(container.textContent).toContain("Basic ");
    else expect(container.querySelector("pre")?.textContent).toContain(tool.id === "bearer-token-header-generator" ? unicode.replace(/ /g, "") : unicode);
  });
  it.each([
    ["curl-to-fetch", "command", "curl --cert private.pem https://example.com/"],
    ["curl-to-axios", "command", "curl --cert private.pem https://example.com/"],
    ["curl-to-python-requests", "command", "curl --cert private.pem https://example.com/"],
    ["fetch-to-curl", "code", "fetch(privateUrl, {body: steal()})"],
    ["http-header-parser", "raw", "not a header"],
    ["rest-api-request-builder", "url", "not a URL"],
    ["api-response-formatter", "body", "{invalid"],
    ["graphql-formatter", "query", "query Q { user("],
    ["graphql-query-builder", "rootField", "bad field"],
    ["bearer-token-header-generator", "token", ""],
  ] as const)("%s rejects actual malformed input without network/execution", async (id, name, value) => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch); render(<ApiStation toolId={id} />); load();
    if (id === "api-response-formatter") set(id, "format", "JSON");
    set(id, name, value); send(id); expect((await screen.findByRole("alert")).textContent).not.toBe(""); expect(screen.getByRole("status").textContent).toBe("Check the input error."); expect(fetch).not.toHaveBeenCalled();
  });
  it("REST output is inert text and both copies are the exact visible code", async () => {
    const user = userEvent.setup(); const clipboard = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(); const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    const { container } = render(<ApiStation toolId="rest-api-request-builder" />); load(); set("rest-api-request-builder", "method", "POST"); set("rest-api-request-builder", "bodyType", "Text"); set("rest-api-request-builder", "body", "<img src=https://example.com/private onerror=alert(1)> ✓"); send("rest-api-request-builder");
    const curl = await screen.findByLabelText("cURL value"); const fetchCode = screen.getByLabelText("Fetch value");
    await user.click(screen.getByRole("button", { name: "Copy cURL" })); expect(clipboard).toHaveBeenLastCalledWith(curl.textContent);
    await user.click(screen.getByRole("button", { name: "Copy Fetch" })); expect(clipboard).toHaveBeenLastCalledWith(fetchCode.textContent);
    expect(curl.textContent).toContain("<img src="); expect(container.querySelector("img,iframe,script")).toBeNull(); expect(fetch).not.toHaveBeenCalled();
  });
  it("nested errors associate the exact structured control", async () => {
    vi.spyOn(local, "localApi").mockImplementationOnce(() => { throw new ApiError("Invalid header value.", "headers[0].value"); });
    const user = userEvent.setup(); render(<ApiStation toolId="rest-api-request-builder" />); await user.click(screen.getByRole("button", { name: "Add header" })); send("rest-api-request-builder");
    const alert = await screen.findByRole("alert"); const input = screen.getByLabelText("Header 1 value"); expect(input.getAttribute("aria-invalid")).toBe("true"); expect(input.getAttribute("aria-describedby")).toContain(alert.id); expect(document.activeElement).toBe(input);
  });
  it("clipboard failure leaves the selectable local output", async () => {
    const user = userEvent.setup(); vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied")); render(<ApiStation toolId="curl-to-fetch" />); load(); send("curl-to-fetch");
    await user.click(await screen.findByRole("button", { name: `Copy ${definition("curl-to-fetch").apiContract.outputs.join(" · ")}` })); expect(screen.getByRole("status").textContent).toContain("Could not copy"); expect(screen.getByLabelText(`${definition("curl-to-fetch").apiContract.outputs.join(" · ")} value`)).toBeTruthy();
  });
  it("secret fields are masked and never written to storage, logs or a request", async () => {
    const tools = apiTools.filter(tool => tool.apiContract.fields.some(input => input.name === "password" || input.name === "token"));
    const storage = vi.spyOn(Storage.prototype, "setItem"); const fetch = vi.fn(); vi.stubGlobal("fetch", fetch); const log = vi.spyOn(console, "log"); const error = vi.spyOn(console, "error");
    for (const tool of tools) {
      const { container, unmount } = render(<ApiStation toolId={tool.id} />); load();
      for (const input of tool.apiContract.fields.filter(item => item.name === "password" || item.name === "token")) {
        set(tool.id, input.name, "s3cret-✓-世界"); expect(field(tool.id, input.name).getAttribute("type")).toBe("password"); expect(field(tool.id, input.name).getAttribute("autocomplete")).toBe("off");
      }
      send(tool.id); await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Result ready."));
      fireEvent.click(screen.getByRole("button", { name: "Clear" })); expect(container.textContent).not.toContain("s3cret"); expect(container.querySelector("pre")).toBeNull(); unmount();
    }
    expect(storage).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled(); expect(log).not.toHaveBeenCalled(); expect(error).not.toHaveBeenCalled();
  });
  it("oversized input is retained, associated and rejected without execution", async () => {
    const engine = vi.spyOn(conversions, "convertApi"); render(<ApiStation toolId="curl-to-fetch" />); set("curl-to-fetch", "command", "x".repeat(200001)); send("curl-to-fetch");
    expect((await screen.findByRole("alert")).textContent).toContain("limit"); expect((field("curl-to-fetch", "command") as HTMLTextAreaElement).value).toHaveLength(200001); expect(document.activeElement).toBe(field("curl-to-fetch", "command")); expect(engine).not.toHaveBeenCalled();
  });
});

describe("API tester direct requests and cancellation", () => {
  it("uses the real direct engine with one mocked endpoint request and no proxy/retry", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("✓ 世界\r\n", { status: 418, headers: { "Content-Type": "text/plain", "X-Test": "local" } })); vi.stubGlobal("fetch", fetch);
    const user = userEvent.setup(); const clipboard = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    render(<ApiStation toolId="api-request-tester" />); load(); set("api-request-tester", "url", "https://example.com/explicit?existing=1"); send("api-request-tester");
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("HTTP error 418. Response received."));
    expect(fetch).toHaveBeenCalledOnce(); expect(String(fetch.mock.calls[0][0])).toMatch(/^https:\/\/example\.com\/explicit\?/); expect(fetch.mock.calls[0][1].credentials).toBe("omit"); expect(fetch.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    await user.click(screen.getByRole("button", { name: "Copy Response" })); expect(clipboard).toHaveBeenLastCalledWith("✓ 世界\r\n");
  });
  it.each(["Network or CORS error", "Aborted"])("recognizes the engine-returned %s state without offering a response copy", async state => {
    vi.spyOn(requests, "executeApiRequest").mockResolvedValueOnce({ text: state, data: { state, statusCode: null, responseBody: "" } });
    render(<ApiStation toolId="api-request-tester" />); load(); send("api-request-tester");
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe(state === "Aborted" ? "Aborted. Request cancelled." : "Network/CORS error.")); expect(screen.queryByRole("button", { name: "Copy Response" })).toBeNull();
  });
  it("does not auto-send on mount, examples, changes or Clear", () => {
    const engine = vi.spyOn(requests, "executeApiRequest").mockResolvedValue(response()); render(<ApiStation toolId="api-request-tester" />); load(); set("api-request-tester", "url", "https://example.com/private"); fireEvent.click(screen.getByRole("button", { name: "Clear" })); expect(engine).not.toHaveBeenCalled();
  });
  it.each([200, 404, 500])("shows Sending then the %s outcome and copies response bytes only", async status => {
    const user = userEvent.setup(); const clipboard = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(); let resolve!: (value: ApiResult) => void;
    const engine = vi.spyOn(requests, "executeApiRequest").mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    render(<ApiStation toolId="api-request-tester" />); load(); send("api-request-tester"); await waitFor(() => expect(engine).toHaveBeenCalledOnce()); expect(screen.getByRole("status").textContent).toBe("Sending…");
    expect(screen.getByRole("button", { name: "Sending…" }).getAttribute("disabled")).not.toBeNull(); expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
    expect(engine.mock.calls[0][1]).toBeInstanceOf(AbortSignal); await act(async () => resolve(response(status, "<script>private()</script>\r\n✓ 世界")));
    expect(screen.getByRole("status").textContent).toBe(status >= 400 ? `HTTP error ${status}. Response received.` : "Success. Response received.");
    await user.click(screen.getByRole("button", { name: "Copy Response" })); expect(clipboard).toHaveBeenLastCalledWith("<script>private()</script>\r\n✓ 世界"); expect(document.querySelector("script")).toBeNull();
  });
  it("network/CORS failure is distinguishable from a received HTTP error", async () => {
    vi.spyOn(requests, "executeApiRequest").mockRejectedValueOnce(new TypeError("Failed to fetch")); render(<ApiStation toolId="api-request-tester" />); load(); send("api-request-tester");
    expect((await screen.findByRole("alert")).textContent).toContain("Network/CORS"); expect(screen.getByRole("status").textContent).toBe("Network/CORS error."); expect(screen.queryByRole("button", { name: "Copy Response" })).toBeNull();
  });
  it.each(["Cancel", "Clear", "edit", "unmount"])("%s aborts in-flight work and rejects a stale response", async operation => {
    let resolve!: (value: ApiResult) => void; const engine = vi.spyOn(requests, "executeApiRequest").mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const { unmount } = render(<ApiStation toolId="api-request-tester" />); load(); send("api-request-tester"); await waitFor(() => expect(engine).toHaveBeenCalledOnce()); const signal = engine.mock.calls[0][1];
    if (operation === "edit") set("api-request-tester", "url", "https://new.example/"); else if (operation === "unmount") unmount(); else fireEvent.click(screen.getByRole("button", { name: operation }));
    expect(signal?.aborted).toBe(true); await act(async () => resolve(response(200, "STALE_SECRET"))); expect(screen.queryByText(/STALE_SECRET/)).toBeNull();
    if (operation === "Cancel") expect(screen.getByRole("status").textContent).toBe("Aborted. Request cancelled.");
    if (operation !== "unmount") expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
  });
  it("an AbortError from the direct engine has its own state", async () => {
    vi.spyOn(requests, "executeApiRequest").mockRejectedValueOnce(new DOMException("Aborted", "AbortError")); render(<ApiStation toolId="api-request-tester" />); load(); send("api-request-tester");
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Aborted. Request cancelled.")); expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("API SSR hydration and tab order", () => {
  it.each(apiTools)("$id keeps SSR IDs and controls without secret values or hydration warnings", async tool => {
    const container = document.createElement("div"); const ui = <ApiStation toolId={tool.id} />; const markup = renderToString(ui, { identifierPrefix: "server" }); container.innerHTML = markup; document.body.append(container);
    const nodes = [...container.querySelectorAll("[id]")]; const errors = vi.spyOn(console, "error"); const recoverable = vi.fn();
    for (const input of container.querySelectorAll<HTMLInputElement>('input[type="password"]')) expect(input.value).toBe("");
    const root = hydrateRoot(container, ui, { identifierPrefix: "client", onRecoverableError: recoverable }); await act(async () => {});
    expect([...container.querySelectorAll("[id]")]).toEqual(nodes); expect(new Set(nodes.map(node => node.id)).size).toBe(nodes.length); expect(errors).not.toHaveBeenCalled(); expect(recoverable).not.toHaveBeenCalled();
    await act(async () => root.unmount()); container.remove();
  });
  it.each(apiTools)("$id all initial controls/actions are keyboard reachable", async tool => {
    const user = userEvent.setup(); const { container } = render(<ApiStation toolId={tool.id} />);
    for (const control of container.querySelectorAll<HTMLElement>("form button,form input,form textarea,form select")) { await user.tab(); expect(document.activeElement).toBe(control); }
  });
});
