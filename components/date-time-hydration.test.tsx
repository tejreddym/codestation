// @vitest-environment jsdom
import { act, Suspense, useId, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { hydrateRoot, type Root } from "react-dom/client";
import { within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dateTimeTools } from "../config/date-time-tools";
import CalendarPicker from "./CalendarPicker";
import DateTimeStation from "./DateTimeStation";

const roots: Root[] = [];
const containers: HTMLElement[] = [];
beforeEach(() => vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true));

afterEach(async () => {
  for (const root of roots.splice(0)) await act(async () => root.unmount());
  for (const container of containers.splice(0)) container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function hydrate(ui: ReactNode, clientPrefix = "client-") {
  const container = document.createElement("div");
  container.innerHTML = renderToString(ui, { identifierPrefix: "server-" });
  document.body.appendChild(container);
  containers.push(container);
  const serverNodes = Array.from(container.querySelectorAll("[id]"));
  const serverIds = serverNodes.map((node) => node.id);
  const recoverable = vi.fn();
  await act(async () => {
    roots.push(hydrateRoot(container, ui, {
      identifierPrefix: clientPrefix,
      onRecoverableError: recoverable,
    }));
  });
  return { container, serverNodes, serverIds, recoverable };
}

function assertReferences(container: HTMLElement) {
  const ids = Array.from(container.querySelectorAll("[id]"), (node) => node.id);
  expect(new Set(ids).size).toBe(ids.length);
  for (const label of container.querySelectorAll<HTMLLabelElement>("label[for]")) {
    expect(label.control, `Missing control for ${label.textContent}`).not.toBeNull();
    expect(container.contains(label.control)).toBe(true);
  }
  for (const attribute of ["aria-labelledby", "aria-describedby", "list"]) {
    for (const node of container.querySelectorAll(`[${attribute}]`)) {
      for (const id of node.getAttribute(attribute)!.split(/\s+/)) {
        const target = document.getElementById(id);
        expect(target, `Missing ${attribute} target ${id}`).not.toBeNull();
        expect(container.contains(target)).toBe(true);
      }
    }
  }
}

describe("Date & Time SSR hydration IDs", () => {
  it("detects generated-ID drift when the hydration namespace differs", async () => {
    // Controlled reproduction of the observed ID symptom, not proof of the
    // underlying Next dynamic/Suspense tree cause.
    function GeneratedField() {
      const id = useId();
      return <><label htmlFor={id}>Probe</label><input id={id} /></>;
    }
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const { container } = await hydrate(<Suspense fallback={null}><GeneratedField /></Suspense>);
    expect(errors.mock.calls.flat().join(" ")).toMatch(/hydration|hydrated/i);
    expect(container.querySelector("input")!.id).toContain("server-");
  });

  it.each(dateTimeTools)("hydrates $id with namespace-independent relationships and working events", async (tool) => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const { container, serverNodes, serverIds, recoverable } = await hydrate(
      <Suspense fallback={null}><DateTimeStation toolId={tool.id} /></Suspense>,
    );
    expect(serverIds.length).toBeGreaterThan(2);
    expect(serverIds.every((id) => id.startsWith(`date-time-${tool.id}-`))).toBe(true);
    expect(Array.from(container.querySelectorAll("[id]"), (node) => node.id)).toEqual(serverIds);
    serverNodes.forEach((node) => expect(document.getElementById(node.id)).toBe(node));
    assertReferences(container);
    expect(within(container).getByRole("form").getAttribute("aria-labelledby")).toBe(`date-time-${tool.id}-input`);
    expect(within(container).getByRole("region", { name: tool.dateTimeContract.outputLabel })).toBeTruthy();

    const user = userEvent.setup();
    await user.click(within(container).getByRole("button", { name: /Load example|Example zone/ }));
    await user.click(container.querySelector<HTMLButtonElement>('button[type="submit"]')!);
    expect(within(container).queryByRole("alert")).toBeNull();
    await waitFor(() => expect(container.querySelector("pre")?.textContent).toBeTruthy());
    assertReferences(container);
    await user.click(within(container).getByRole("button", { name: "Clear" }));
    expect(container.querySelector("pre")).toBeNull();
    expect(recoverable).not.toHaveBeenCalled();
    expect(errors).not.toHaveBeenCalled();
  });

  it("keeps IDs unique across tools with shared station implementations", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const { container, recoverable } = await hydrate(<>
      {dateTimeTools.map((tool) => <DateTimeStation key={tool.id} toolId={tool.id} />)}
    </>);
    assertReferences(container);
    expect(recoverable).not.toHaveBeenCalled();
    expect(errors).not.toHaveBeenCalled();
  });

  it("keeps conditional custom-weekend controls usable after hydration", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const { container, recoverable } = await hydrate(<DateTimeStation toolId="business-days-calculator" />);
    const user = userEvent.setup();
    const query = within(container);
    await user.click(query.getByRole("button", { name: "Load example" }));
    await user.selectOptions(query.getByLabelText("Weekend definition"), "Custom weekend");
    await user.click(query.getByRole("checkbox", { name: "Sunday" }));
    expect((query.getByRole("checkbox", { name: "Sunday" }) as HTMLInputElement).checked).toBe(true);
    assertReferences(container);
    await user.click(query.getByRole("button", { name: "Calculate business days" }));
    expect(query.getByLabelText("Business days value").textContent).toBe("8");
    expect(recoverable).not.toHaveBeenCalled();
    expect(errors).not.toHaveBeenCalled();
  });

  it("allows an explicit calendar ID and preserves unique useId fallbacks for other consumers", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const onChange = vi.fn();
    const explicit = await hydrate(<CalendarPicker id="standalone-date" label="Date" value="2026-10-02" onChange={onChange} hint="Choose a date" />);
    expect(within(explicit.container).getByLabelText("Date").id).toBe("standalone-date");
    assertReferences(explicit.container);
    const user = userEvent.setup();
    await user.click(within(explicit.container).getByRole("button", { name: "Open calendar for Date" }));
    const dialog = within(explicit.container).getByRole("dialog", { name: "Calendar picker for Date" });
    await user.click(within(dialog).getByText("3", { selector: "abbr" }));
    expect(onChange).toHaveBeenCalledWith("2026-10-03");
    expect(within(explicit.container).queryByRole("dialog")).toBeNull();
    assertReferences(explicit.container);
    const fallback = await hydrate(<>
      <CalendarPicker label="First date" value="" onChange={() => {}} />
      <CalendarPicker label="Second date" value="" onChange={() => {}} />
    </>, "server-");
    assertReferences(fallback.container);
    expect(within(fallback.container).getByLabelText("First date").id).not.toBe(within(fallback.container).getByLabelText("Second date").id);
    expect(explicit.recoverable).not.toHaveBeenCalled();
    expect(fallback.recoverable).not.toHaveBeenCalled();
    expect(errors).not.toHaveBeenCalled();
  });
});
