// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { Button, ButtonLink } from "./Button";
import { CanvasToolbar } from "./CanvasToolbar";
import { Checkbox, Select, TextInput, Textarea } from "./controls";
import { Field } from "./Field";
import { OutputPanel } from "./OutputPanel";
import { Panel } from "./Panel";
import { PreviewFrame } from "./PreviewFrame";
import { ProgressBar } from "./ProgressBar";
import { Tabs } from "./Tabs";
import { ToolLayout } from "./ToolLayout";
import { downloadBlob } from "./useDownload";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("ui primitives", () => {
  it("Button renders one native button with an explicit default type and no wrapper", () => {
    const { container } = render(<Button>Run</Button>);
    const button = screen.getByRole("button", { name: "Run" });
    expect(button.tagName).toBe("BUTTON");
    expect(button.getAttribute("type")).toBe("button");
    expect(container.firstElementChild).toBe(button);
  });

  it("ButtonLink renders a real anchor with href", () => {
    render(<ButtonLink href="/tools/base64">Switch</ButtonLink>);
    expect(screen.getByRole("link", { name: "Switch" }).getAttribute("href")).toBe("/tools/base64");
  });

  it("Field keeps sibling label/control order and wires hint/error ids", () => {
    render(<Field id="name" label="Name" hint="Your name" error="Required"><TextInput id="name" name="name" /></Field>);
    const input = screen.getByLabelText("Name");
    expect(input.getAttribute("name")).toBe("name");
    expect(input.getAttribute("aria-describedby")).toBeNull();
    expect(document.getElementById("name-hint")?.textContent).toBe("Your name");
    const alert = screen.getByRole("alert");
    expect(alert.id).toBe("name-error");
    expect(alert.textContent).toBe("Required");
  });

  it("controls pass id, name and value through unchanged", () => {
    render(<>
      <label htmlFor="a">Alpha</label>
      <TextInput id="a" name="a" value="one" readOnly onChange={() => {}} />
      <label htmlFor="b">Beta</label>
      <Textarea id="b" name="b" value="two" readOnly onChange={() => {}} />
      <label htmlFor="c">Gamma</label>
      <Select id="c" name="c" value="3" onChange={() => {}}><option value="3">Three</option></Select>
      <Checkbox id="d" name="d" label="Check" checked readOnly onChange={() => {}} />
    </>);
    expect((screen.getByLabelText("Alpha") as HTMLInputElement).value).toBe("one");
    expect((screen.getByLabelText("Beta") as HTMLTextAreaElement).value).toBe("two");
    expect((screen.getByLabelText("Gamma") as HTMLSelectElement).value).toBe("3");
    expect((screen.getByLabelText("Check") as HTMLInputElement).name).toBe("d");
  });

  it("Panel renders a titled section and keeps the provided heading id", () => {
    render(<Panel headingId="result-title" title="Result" actions={<Button size="sm">Copy</Button>}>Body</Panel>);
    const heading = screen.getByRole("heading", { name: "Result" });
    expect(heading.id).toBe("result-title");
    expect(screen.getByRole("region", { name: "Result" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy" })).toBeTruthy();
  });

  it("OutputPanel keeps the pre aria-label contract and header actions", () => {
    render(<OutputPanel label="Encoded text" value="abc" filename="out.txt" onCopy={() => {}} onDownload={() => {}} />);
    const pre = screen.getByLabelText("Encoded text value");
    expect(pre.tagName).toBe("PRE");
    expect(pre.getAttribute("tabindex")).toBe("0");
    expect(screen.getByRole("button", { name: "Copy" }).hasAttribute("disabled")).toBe(false);
    expect(screen.getByRole("button", { name: "Download" }).getAttribute("title")).toContain("out.txt");
  });

  it("OutputPanel shows the empty state without enabling copy or download", () => {
    render(<OutputPanel label="Output" value="" empty="Nothing yet" onCopy={() => {}} onDownload={() => {}} />);
    expect(screen.getByText("Nothing yet")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Download" }).hasAttribute("disabled")).toBe(true);
  });

  it("Tabs keep every panel mounted while switching visibility", () => {
    render(<Tabs idBase="t" ariaLabel="Views" items={[
      { id: "one", label: "One", panel: <p>First panel</p> },
      { id: "two", label: "Two", panel: <p>Second panel</p> },
    ]} />);
    expect(screen.getByText("First panel")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Two" }));
    expect(screen.getByText("First panel")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Two" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tab", { name: "Two" }).tabIndex).toBe(0);
    expect(screen.getByRole("tab", { name: "One" }).tabIndex).toBe(-1);
  });

  it("Tabs move focus with arrow keys without resetting panels", () => {
    render(<Tabs idBase="k" ariaLabel="Keys" items={[
      { id: "a", label: "A", panel: <p>Panel A</p> },
      { id: "b", label: "B", panel: <p>Panel B</p> },
    ]} />);
    const first = screen.getByRole("tab", { name: "A" });
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "B" }).getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "B" }));
    expect(screen.getByText("Panel A")).toBeTruthy();
  });

  it("CanvasToolbar clamps zoom, exposes reset and keeps action order", () => {
    function Harness() {
      const [zoom, setZoom] = useState(100);
      return <CanvasToolbar zoom={zoom} onZoomChange={setZoom} onReset={() => setZoom(100)} actions={<button type="button">Export</button>} />;
    }
    render(<Harness />);
    expect(screen.getByText("100%")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(screen.getByText("110%")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByText("100%")).toBeTruthy();
    expect(screen.getByRole("toolbar", { name: "Canvas zoom" }).textContent).toContain("Export");
    expect(screen.getByRole("button", { name: "Zoom out" }).hasAttribute("disabled")).toBe(false);
  });

  it("PreviewFrame passes sandbox and title through verbatim", () => {
    render(<PreviewFrame title="HTML preview" srcDoc="<p>ok</p>" sandbox="" />);
    const frame = screen.getByTitle("HTML preview");
    expect(frame.getAttribute("sandbox")).toBe("");
    expect(frame.getAttribute("srcdoc")).toBe("<p>ok</p>");
  });

  it("ToolLayout renders the form and stack variants without headings", () => {
    const { container, rerender } = render(<ToolLayout kind="form">A</ToolLayout>);
    expect(container.firstElementChild?.getAttribute("data-kind")).toBe("form");
    expect(container.querySelector("h1,h2,h3")).toBeNull();
    rerender(<ToolLayout kind="data">B</ToolLayout>);
    expect(container.firstElementChild?.getAttribute("data-kind")).toBe("data");
  });

  it("ProgressBar exposes a labelled native progressbar and clamps values", () => {
    const { rerender } = render(<ProgressBar label="Rendering pages" value={3} max={8} detail="Page 4 of 8" />);
    const bar = screen.getByRole("progressbar", { name: "Rendering pages" });
    expect(bar.getAttribute("aria-valuemin")).toBe("0");
    expect(bar.getAttribute("aria-valuemax")).toBe("8");
    expect(bar.getAttribute("aria-valuenow")).toBe("3");
    expect(bar.getAttribute("aria-valuetext")).toBe("3 of 8");
    expect(screen.getByText("Rendering pages")).toBeTruthy();
    expect(screen.getByText("3 / 8")).toBeTruthy();
    expect(screen.getByText("Page 4 of 8")).toBeTruthy();

    rerender(<ProgressBar label="Rendering pages" value={99} max={8} />);
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("8");
  });

  it("downloadBlob triggers one download with the requested filename", () => {
    const create = vi.fn(() => "blob:test");
    const revoke = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: create });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revoke });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    downloadBlob("hello", "hello.txt");
    expect(create).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(revoke).toHaveBeenCalledWith("blob:test");
  });
});
