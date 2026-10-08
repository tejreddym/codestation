// @vitest-environment jsdom
import { useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import ApiStructuredFields, { apiFieldMatches, type ApiStructuredKind } from "./ApiStructuredFields";

const cases: { kind: ApiStructuredKind; noun: string; cells: string[]; initial: unknown }[] = [
  { kind: "entries", noun: "header", cells: ["name", "value"], initial: { name: "X-Test", value: "✓ 世界" } },
  { kind: "headers", noun: "header", cells: ["name", "value"], initial: { name: "X-Test", value: "✓ 世界" } },
  { kind: "parameters", noun: "parameter", cells: ["key", "value"], initial: { key: "q", value: "✓ 世界" } },
  { kind: "fields", noun: "field", cells: ["key", "value type", "value"], initial: { key: "message", valueType: "String", value: "✓ 世界" } },
  { kind: "arguments", noun: "argument", cells: ["name", "value type", "value"], initial: { name: "message", valueType: "String", value: "✓ 世界" } },
  { kind: "selectedFields", noun: "selected field", cells: [""], initial: "name" },
];

function Editor({ kind, initial = [], errorField }: { kind: ApiStructuredKind; initial?: unknown[]; errorField?: string }) {
  const [values, setValues] = useState<unknown[]>(initial);
  return <><ApiStructuredFields kind={kind} name={kind} id={`api-test-${kind}`} label="Rows" value={values} onChange={setValues} errorField={errorField} describedBy="field-help" /><p id="field-help">Local field help</p><output aria-label="Current value">{JSON.stringify(values)}</output></>;
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); document.documentElement.removeAttribute("data-theme"); });

describe.each(["light", "dark"])("API structured %s DOM", theme => {
  it.each(cases)("$kind keyboard add/edit/remove and focus", async item => {
    document.documentElement.dataset.theme = theme;
    const user = userEvent.setup(); render(<Editor kind={item.kind} />); const group = screen.getByRole("group", { name: "Rows" });
    const title = item.noun[0].toUpperCase() + item.noun.slice(1);
    const add = within(group).getByRole("button", { name: `Add ${item.noun}` }); add.focus(); await user.keyboard("{Enter}");
    const first = screen.getByLabelText(`${title} 1${item.cells[0] ? ` ${item.cells[0]}` : ""}`); await waitFor(() => expect(document.activeElement).toBe(first));
    for (const cell of item.cells) {
      const control = screen.getByLabelText(`${title} 1${cell ? ` ${cell}` : ""}`);
      expect(control.getAttribute("aria-describedby")).toBe("field-help");
      if (control.tagName === "INPUT") fireEvent.change(control, { target: { value: "✓ 世界 🛰️" } });
    }
    expect(screen.getByLabelText("Current value").textContent).toContain("✓ 世界 🛰️");
    const remove = within(group).getByRole("button", { name: `Remove ${item.noun} 1` }); remove.focus(); await user.keyboard("{Enter}");
    await waitFor(() => expect(document.activeElement).toBe(add)); expect(screen.getByLabelText("Current value").textContent).toBe("[]");
  });
});

describe("API structured values", () => {
  it.each(cases)("$kind populated SSR IDs hydrate unchanged", async item => {
    const container = document.createElement("div"); const ui = <Editor kind={item.kind} initial={[item.initial]} />;
    container.innerHTML = renderToString(ui, { identifierPrefix: "server" }); document.body.append(container);
    const nodes = [...container.querySelectorAll("[id]")]; const recoverable = vi.fn(); const errors = vi.spyOn(console, "error");
    const root = hydrateRoot(container, ui, { identifierPrefix: "client", onRecoverableError: recoverable }); await act(async () => {});
    expect([...container.querySelectorAll("[id]")]).toEqual(nodes); expect(new Set(nodes.map(node => node.id)).size).toBe(nodes.length); expect(recoverable).not.toHaveBeenCalled(); expect(errors).not.toHaveBeenCalled();
    await act(async () => root.unmount()); container.remove();
  });
  it("JSON and GraphQL types match their exact engine value types", async () => {
    const user = userEvent.setup(); const { unmount } = render(<Editor kind="fields" initial={[cases[3].initial]} />);
    expect(within(screen.getByLabelText("Field 1 value type")).getAllByRole("option").map(node => node.textContent)).toEqual(["String", "Number", "Boolean", "Null", "JSON object", "JSON array"]);
    await user.selectOptions(screen.getByLabelText("Field 1 value type"), "Null"); expect((screen.getByLabelText("Field 1 value") as HTMLInputElement).disabled).toBe(true); unmount();
    render(<Editor kind="arguments" initial={[cases[4].initial]} />);
    expect(within(screen.getByLabelText("Argument 1 value type")).getAllByRole("option").map(node => node.textContent)).toEqual(["String", "Int", "Float", "Boolean", "Null", "Enum"]);
  });
  it("row removal returns focus to an adjacent row without losing values", async () => {
    const user = userEvent.setup(); render(<Editor kind="headers" initial={[{ name: "First", value: "one" }, { name: "Second", value: "two" }]} />);
    const remove = screen.getByRole("button", { name: "Remove header 1" }); remove.focus(); await user.keyboard("{Enter}");
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Remove header 1" })));
    expect((screen.getByLabelText("Header 1 name") as HTMLInputElement).value).toBe("Second"); expect(screen.getByLabelText("Current value").textContent).toBe('[{"name":"Second","value":"two"}]');
  });
  it("matches dotted/bracket errors only to the correct field and parent", () => {
    expect(apiFieldMatches("headers[0].value", "headers.0.value")).toBe(true); expect(apiFieldMatches("headers[0].value", "headers")).toBe(true);
    expect(apiFieldMatches("headers[0].value", "headers.0.name")).toBe(false); expect(apiFieldMatches("header", "headers")).toBe(false); expect(apiFieldMatches(undefined, "headers")).toBe(false);
  });
  it("nested errors mark only the relevant cell", () => {
    render(<Editor kind="headers" initial={[cases[0].initial]} errorField="headers[0].value" />);
    expect(screen.getByLabelText("Header 1 value").getAttribute("aria-invalid")).toBe("true"); expect(screen.getByLabelText("Header 1 name").getAttribute("aria-invalid")).toBeNull();
  });
  it("retains object-form selected fields and their nested selection when edited", () => {
    render(<Editor kind="selectedFields" initial={[{ name: "profile", fields: [{ name: "id" }] }]} />);
    fireEvent.change(screen.getByLabelText("Selected field 1"), { target: { value: "user" } }); expect(screen.getByLabelText("Current value").textContent).toBe('[{"name":"user","fields":[{"name":"id"}]}]');
  });
});
