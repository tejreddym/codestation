// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sqlTools } from "@/config/sql-tools";
import { runSql } from "@/lib/tools/sql/engine";
import type { SqlValues } from "@/lib/tools/sql/types";
import SqlDatabaseStation from "./SqlDatabaseStation";
class LocalWorker {
  static hold = false; static last: LocalWorker;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  terminate = vi.fn();
  constructor() { LocalWorker.last = this; }
  postMessage({ toolId, values }: { toolId: string; values: SqlValues }) {
    if (LocalWorker.hold) return;
    void runSql(toolId, values).then(result => this.onmessage?.({ data: { result } }), error => this.onmessage?.({ data: { error: (error as Error).message } }));
  }
}
beforeEach(() => { LocalWorker.hold = false; vi.stubGlobal("Worker", LocalWorker); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); document.documentElement.removeAttribute("data-theme"); });
const structured = new Set(["columns", "rows", "assignments", "conditions", "order"]);
const set = (name: string, value: string) => fireEvent.change(screen.getByLabelText(name), { target: { value } });

describe.each(["light", "dark"])("SQL %s DOM theme (not visual proof)", theme => {
  it.each(sqlTools)("$id exact fields, keyboard submit/Copy/Clear and privacy", async tool => {
    document.documentElement.dataset.theme = theme; const user = userEvent.setup(); const copy = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch); const xhr = vi.spyOn(XMLHttpRequest.prototype, "send"); const storage = vi.spyOn(Storage.prototype, "setItem"); const logs = vi.spyOn(console, "log"); const errors = vi.spyOn(console, "error");
    const { container } = render(<SqlDatabaseStation toolId={tool.id} />);
    for (const field of tool.sqlContract.fields) expect(structured.has(field.control) ? screen.getByRole("group", { name: field.label }) : screen.getByLabelText(field.label, { exact: !field.optional })).toBeTruthy();
    expect(container.querySelector('input[type=file]')).toBeNull(); expect(screen.queryByRole("button", { name: /Run SQL|Execute|Test connection/ })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Load example" })); screen.getByRole("button", { name: tool.sqlContract.action }).focus(); await user.keyboard("{Enter}");
    await screen.findByLabelText(`${tool.sqlContract.outputs[0]} value`);
    for (const label of tool.sqlContract.outputs) {
      const visible = screen.getByLabelText(`${label} value`);
      if (tool.sqlContract.copy) { screen.getByRole("button", { name: `Copy ${label}` }).focus(); await user.keyboard("{Enter}"); expect(copy).toHaveBeenLastCalledWith(visible.textContent); }
      else expect(screen.queryByRole("button", { name: `Copy ${label}` })).toBeNull();
    }
    if (tool.id === "database-connection-string-parser") expect(screen.getByLabelText("Masked password value").textContent).toBe("••••••••");
    screen.getByRole("button", { name: "Clear" }).focus(); await user.keyboard("{Enter}");
    for (const field of tool.sqlContract.fields.filter(field => !structured.has(field.control))) expect((screen.getByLabelText(field.label, { exact: !field.optional }) as HTMLInputElement).value).toBe(tool.sqlContract.defaults[field.name]);
    expect(container.querySelector("pre,svg[role=img]")).toBeNull(); expect(fetch).not.toHaveBeenCalled(); expect(xhr).not.toHaveBeenCalled(); expect(storage).not.toHaveBeenCalled(); expect(logs).not.toHaveBeenCalled(); expect(errors).not.toHaveBeenCalled();
  });
});
describe("SQL forms, structured builders and warnings", () => {
  it.each(sqlTools)("$id makes initial controls keyboard reachable in document order", async tool => {
    const user = userEvent.setup(); const { container } = render(<SqlDatabaseStation toolId={tool.id} />);
    const controls = [...container.querySelectorAll<HTMLElement>("form button:not(:disabled),form input:not(:disabled),form textarea:not(:disabled),form select:not(:disabled)")];
    for (const control of controls) { await user.tab(); expect(document.activeElement).toBe(control); }
  });
  it.each(sqlTools)("$id empty inputs return an error or the explicit supported empty value", async tool => {
    const { container } = render(<SqlDatabaseStation toolId={tool.id} />); fireEvent.click(screen.getByRole("button", { name: tool.sqlContract.action }));
    if (tool.id === "sql-validator") { expect((await screen.findByLabelText("Valid/Invalid status value")).textContent).toBe("Invalid"); expect(screen.getByLabelText("SQL text").getAttribute("aria-invalid")).toBe("true"); }
    else if (tool.id === "sql-escape-helper") expect((await screen.findByLabelText("Escaped SQL literal value")).textContent).toBe("''");
    else { const alert = await screen.findByRole("alert"); expect(alert.textContent).toBeTruthy(); expect(container.querySelector('form [aria-describedby*="-error"]')).toBeTruthy(); }
  });
  it.each(sqlTools)("$id rejects oversized input without truncating it", async tool => {
    render(<SqlDatabaseStation toolId={tool.id} />); fireEvent.click(screen.getByRole("button", { name: "Load example" }));
    const field = tool.sqlContract.fields.find(field => ["text", "textarea", "password"].includes(field.control));
    const inputLabel = field?.label ?? "Condition 1 column"; set(inputLabel, "x".repeat(200001));
    fireEvent.click(screen.getByRole("button", { name: tool.sqlContract.action })); expect((await screen.findByRole("alert")).textContent).toBeTruthy(); expect((screen.getByLabelText(inputLabel) as HTMLInputElement).value).toHaveLength(200001);
  });
  it("row builder preserves typed values when adding/removing columns and generates Unicode safely", async () => {
    const user = userEvent.setup(); render(<SqlDatabaseStation toolId="sql-insert-generator" />);
    set("Table name", "users"); await user.click(screen.getByRole("button", { name: "Add column" })); set("Column 1", "id"); await user.click(screen.getByRole("button", { name: "Add row" }));
    await user.selectOptions(screen.getByLabelText("Row 1, id type"), "Number"); set("Row 1, id value", "1");
    await user.click(screen.getByRole("button", { name: "Add column" })); set("Column 2", "name"); set("Row 1, name value", "తెలుగు O'Reilly");
    await user.click(screen.getByRole("button", { name: "Generate" })); expect((await screen.findByLabelText("SQL INSERT statement value")).textContent).toContain("తెలుగు O''Reilly");
    await user.click(screen.getByRole("button", { name: "Remove column 1" })); expect((screen.getByLabelText("Row 1, name value") as HTMLInputElement).value).toBe("తెలుగు O'Reilly");
    await user.click(screen.getByRole("button", { name: "Generate" })); expect((await screen.findByLabelText("SQL INSERT statement value")).textContent).not.toContain('"id"');
  });
  it("WHERE builder handles IN typed lists and NULL without irrelevant value/table controls", async () => {
    const user = userEvent.setup(); render(<SqlDatabaseStation toolId="sql-where-builder" />); expect(screen.queryByLabelText("Table name")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Add condition" })); set("Condition 1 column", "status"); await user.selectOptions(screen.getByLabelText("Condition 1 operator"), "IN"); set("Condition 1, value 1 value", "active");
    await user.click(screen.getByRole("button", { name: "Add value to condition 1" })); set("Condition 1, value 2 value", "pending"); await user.click(screen.getByRole("button", { name: "Generate" })); expect((await screen.findByLabelText("SQL WHERE clause value")).textContent).toContain("('active', 'pending')");
    await user.selectOptions(screen.getByLabelText("Condition 1 operator"), "IS NULL"); expect(screen.queryByLabelText("Condition 1, value 1 value")).toBeNull(); await user.click(screen.getByRole("button", { name: "Generate" })); expect((await screen.findByLabelText("SQL WHERE clause value")).textContent).toBe('WHERE "status" IS NULL');
  });
  it.each(["sql-update-generator", "sql-delete-generator"] as const)("%s prominently warns about an empty WHERE without adding one", async id => {
    render(<SqlDatabaseStation toolId={id} />); fireEvent.click(screen.getByRole("button", { name: "Load example" })); fireEvent.click(screen.getByRole("button", { name: "Remove condition 1" })); fireEvent.click(screen.getByRole("button", { name: "Generate" }));
    const warning = await screen.findByRole("alert"); expect(warning.textContent).toContain(id.includes("update") ? "This UPDATE has no WHERE clause and may affect every row." : "This DELETE has no WHERE clause and may delete every row.");
  });
  it("dialect change updates generation, invalidates output and SQL Server uses TOP", async () => {
    const user = userEvent.setup(); render(<SqlDatabaseStation toolId="sql-select-builder" />); await user.click(screen.getByRole("button", { name: "Load example" })); await user.click(screen.getByRole("button", { name: "Generate" })); await screen.findByLabelText("SQL SELECT statement value");
    await user.selectOptions(screen.getByLabelText("SQL dialect"), "SQL Server"); expect(screen.queryByLabelText("SQL SELECT statement value")).toBeNull(); await user.click(screen.getByRole("button", { name: "Generate" })); expect((await screen.findByLabelText("SQL SELECT statement value")).textContent).toContain("TOP (100)");
  });
  it("CSV download uses exactly the visible bytes, local filename and revoked URL", async () => {
    const create = vi.fn((_blob: Blob) => "blob:public-test"); const revoke = vi.fn(); const OriginalURL = URL;
    vi.stubGlobal("URL", class extends OriginalURL { static createObjectURL = create; static revokeObjectURL = revoke; }); const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(<SqlDatabaseStation toolId="sql-to-csv" />); fireEvent.click(screen.getByRole("button", { name: "Load example" })); fireEvent.click(screen.getByRole("button", { name: "Convert" })); await screen.findByLabelText("CSV text value"); fireEvent.click(screen.getByRole("button", { name: "Download CSV" }));
    expect(create).toHaveBeenCalledOnce(); expect(click).toHaveBeenCalledOnce(); const anchor = click.mock.contexts[0] as HTMLAnchorElement; expect(anchor.download).toBe("sql-inserts.csv"); expect(anchor.href).toBe("blob:public-test");
    const text = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsText(create.mock.calls[0][0]); });
    expect(text).toBe(screen.getByLabelText("CSV text value").textContent); await waitFor(() => expect(revoke).toHaveBeenCalledWith("blob:public-test"));
  });
  it("connection source stays password-masked; parser masks secrets and Clear removes all credentials", async () => {
    const { container } = render(<SqlDatabaseStation toolId="database-connection-string-parser" />); const connection = "postgresql://demo:PUBLIC_PASSWORD@host/demo?access_token=PUBLIC_TOKEN"; set("Connection string", connection); expect((screen.getByLabelText("Connection string") as HTMLInputElement).type).toBe("password");
    fireEvent.click(screen.getByRole("button", { name: "Parse" })); await screen.findByLabelText("Masked password value"); expect(container.textContent).not.toContain("PUBLIC_PASSWORD"); expect(container.textContent).not.toContain("PUBLIC_TOKEN"); expect(screen.queryByRole("button", { name: /Copy/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Clear" })); expect((screen.getByLabelText("Connection string") as HTMLInputElement).value).toBe(""); expect(container.querySelector("pre")).toBeNull();
  });
  it("ER has a visual plus full accessible structure and no invented relationships", async () => {
    const { container } = render(<SqlDatabaseStation toolId="er-diagram-generator" />); set("CREATE TABLE SQL", "CREATE TABLE users (id INTEGER PRIMARY KEY); CREATE TABLE posts (id INTEGER PRIMARY KEY, user_id INTEGER);"); fireEvent.click(screen.getByRole("button", { name: "Generate" }));
    await screen.findByRole("img", { name: "Entity relationship diagram showing declared foreign keys" }); expect(screen.getByLabelText("Foreign-key relationships value").textContent).toBe("None declared"); expect(container.querySelectorAll("svg path")).toHaveLength(0); expect(screen.getByText("Complete schema structure")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Diagram zoom"), { target: { value: "120" } }); expect(screen.getByText("120%")).toBeTruthy();
  });
  it("Clear terminates pending work and ignores late replies", async () => {
    LocalWorker.hold = true; render(<SqlDatabaseStation toolId="sql-formatter" />); set("SQL text", "SELECT 1;"); fireEvent.click(screen.getByRole("button", { name: "Format" })); await waitFor(() => expect(LocalWorker.last).toBeTruthy()); await act(async () => {}); const worker = LocalWorker.last;
    fireEvent.click(screen.getByRole("button", { name: "Clear" })); expect(worker.terminate).toHaveBeenCalled(); await act(async () => worker.onmessage?.({ data: { result: { rows: [{ label: "Formatted SQL", value: "late" }] } } })); expect(screen.queryByText("late")).toBeNull();
  });
  it("renders malicious-looking values only as text and handles clipboard denial", async () => {
    const user = userEvent.setup(); vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied")); const { container } = render(<SqlDatabaseStation toolId="sql-escape-helper" />); set("Value", "<script>alert(1)</script>"); await user.click(screen.getByRole("button", { name: "Escape" })); await user.click(await screen.findByRole("button", { name: "Copy Escaped SQL literal" })); expect(container.querySelector("script")).toBeNull(); expect(screen.getByRole("status").textContent).toContain("Could not copy");
  });
});

describe("SQL SSR hydration", () => {
  it.each(sqlTools)("$id keeps stable IDs and empty results without warnings", async tool => {
    const ui = <SqlDatabaseStation toolId={tool.id} />; const container = document.createElement("div"); container.innerHTML = renderToString(ui, { identifierPrefix: "server" }); document.body.append(container);
    const nodes = [...container.querySelectorAll("[id]")]; const errors = vi.spyOn(console, "error"); const recoverable = vi.fn(); const root = hydrateRoot(container, ui, { identifierPrefix: "client", onRecoverableError: recoverable }); await act(async () => {});
    expect([...container.querySelectorAll("[id]")]).toEqual(nodes); expect(new Set(nodes.map(node => node.id)).size).toBe(nodes.length); expect(recoverable).not.toHaveBeenCalled(); expect(errors).not.toHaveBeenCalled(); await act(async () => root.unmount()); container.remove();
  });
});
