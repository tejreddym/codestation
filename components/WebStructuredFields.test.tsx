// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import WebStructuredFields, { type WebStructuredKind } from "./WebStructuredFields";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function Editor({ kind, errorField }: { kind: WebStructuredKind; errorField?: string }) {
  const [value, setValue] = useState<unknown[]>([]);
  return <><WebStructuredFields kind={kind} name={kind} id={`editor-${kind}`} label={kind} value={value} onChange={setValue} errorField={errorField} describedBy="editor-hint" /><p id="editor-hint">Editor hint</p><output aria-label="Current value">{JSON.stringify(value)}</output></>;
}
const current = () => JSON.parse(screen.getByLabelText("Current value").textContent!);

describe("Web structured field keyboard outcomes", () => {
  it.each([
    ["parameters", "parameter", "Parameter 1 key", { key: "", value: "" }],
    ["groups", "group", "Group 1 user agent", { userAgent: "", allow: [], disallow: [] }],
    ["sitemaps", "sitemap", "Sitemap 1 URL", ""],
    ["entries", "entry", "Entry 1 URL", { url: "", lastmod: "", changefreq: "", priority: "" }],
    ["icons", "icon", "Icon 1 source", { src: "", sizes: "", type: "", purpose: "" }],
  ] as const)("%s keyboard add/remove focuses the next usable control and starts empty", async (kind, noun, label, template) => {
    const user = userEvent.setup(); render(<Editor kind={kind} />);
    expect(current()).toEqual([]); const add = screen.getByRole("button", { name: `Add ${noun}` }); add.focus(); await user.keyboard("{Enter}");
    expect(current()).toEqual([template]); await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText(label)));
    const remove = screen.getByRole("button", { name: `Remove ${noun} 1` }); remove.focus(); await user.keyboard("{Enter}");
    expect(current()).toEqual([]); await waitFor(() => expect(document.activeElement).toBe(add));
  });
  it("keeps ordered duplicate and empty query parameters without coercion", async () => {
    const user = userEvent.setup(); render(<Editor kind="parameters" />);
    for (let index = 1; index <= 3; index++) {
      await user.click(screen.getByRole("button", { name: "Add parameter" })); fireEvent.change(screen.getByLabelText(`Parameter ${index} key`), { target: { value: "a" } });
      fireEvent.change(screen.getByLabelText(`Parameter ${index} value`), { target: { value: index === 2 ? "" : `0${index}` } });
    }
    expect(current()).toEqual([{ key: "a", value: "01" }, { key: "a", value: "" }, { key: "a", value: "03" }]);
    await user.click(screen.getByRole("button", { name: "Remove parameter 2" })); expect(current()).toEqual([{ key: "a", value: "01" }, { key: "a", value: "03" }]);
  });
  it("edits nested robot paths separately and resets removed groups", async () => {
    const user = userEvent.setup(); render(<Editor kind="groups" />); await user.click(screen.getByRole("button", { name: "Add group" }));
    fireEvent.change(screen.getByLabelText("Group 1 user agent"), { target: { value: "*" } });
    for (const directive of ["allow", "disallow"]) {
      const add = screen.getByRole("button", { name: `Add group 1 ${directive} path` }); add.focus(); await user.keyboard("{Enter}");
      await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText(`Group 1 ${directive} path 1`)));
      fireEvent.change(screen.getByLabelText(`Group 1 ${directive} path 1`), { target: { value: `/${directive}` } });
    }
    expect(current()).toEqual([{ userAgent: "*", allow: ["/allow"], disallow: ["/disallow"] }]);
    const remove = screen.getByRole("button", { name: "Remove group 1 allow path 1" }); remove.focus(); await user.keyboard("{Enter}");
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Add group 1 allow path" })));
    expect(current()).toEqual([{ userAgent: "*", allow: [], disallow: ["/disallow"] }]);
    await user.click(screen.getByRole("button", { name: "Remove group 1" })); await user.click(screen.getByRole("button", { name: "Add group" })); expect(current()).toEqual([{ userAgent: "", allow: [], disallow: [] }]);
  });
  it("maps bracket-style errors to the exact nested control", async () => {
    const user = userEvent.setup(); render(<Editor kind="entries" errorField="entries[0].priority" />); await user.click(screen.getByRole("button", { name: "Add entry" }));
    expect(screen.getByLabelText("Entry 1 priority").getAttribute("aria-invalid")).toBe("true"); expect(screen.getByLabelText("Entry 1 priority").getAttribute("aria-describedby")).toBe("editor-hint"); expect(screen.getByLabelText("Entry 1 URL").getAttribute("aria-invalid")).toBeNull();
  });
  it("offers an explicit unspecified sitemap change frequency and preserves source strings", async () => {
    const user = userEvent.setup(); render(<Editor kind="entries" />); await user.click(screen.getByRole("button", { name: "Add entry" }));
    await user.selectOptions(screen.getByLabelText("Entry 1 change frequency"), "monthly"); fireEvent.change(screen.getByLabelText("Entry 1 priority"), { target: { value: "0.50" } });
    expect(current()[0]).toMatchObject({ changefreq: "monthly", priority: "0.50" }); await user.selectOptions(screen.getByLabelText("Entry 1 change frequency"), ""); expect(current()[0].changefreq).toBe("");
  });
});
