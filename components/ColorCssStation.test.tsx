// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { colorTools } from "@/config/color-tools";
import { getStation } from "@/config/stations";
import { tools } from "@/config/tools";
import ColorCssStation from "./ColorCssStation";

afterEach(cleanup);

beforeEach(() => {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});

describe("Color & CSS station controls", () => {
  it("registers all seven tools in the central station and catalog", () => {
    expect(colorTools).toHaveLength(7);
    expect(getStation("color-css")).toMatchObject({ toolCount: 7, toolList: colorTools.map(tool => tool.id) });
    expect(tools.filter(tool => tool.category === "Color & CSS").map(tool => tool.id)).toEqual(colorTools.map(tool => tool.id));
  });

  it.each(colorTools)("$id renders its declared controls and produces a result", async tool => {
    const { container } = render(<ColorCssStation toolId={tool.id} />);

    for (const field of tool.localContract.fields) {
      const control = screen.getByLabelText(field.label);
      expect(control.getAttribute("id")).toBe(`color-${tool.id}-${field.name}`);
      expect(control.getAttribute("data-field")).toBe(field.name);
    }

    if (tool.id === "color-picker") {
      expect(screen.getByLabelText("Color").getAttribute("type")).toBe("color");
    }

    fireEvent.click(screen.getByRole("button", { name: tool.localContract.action }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Result ready."));
    expect(screen.getByRole("button", { name: "Copy" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(container.querySelector("pre")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("keeps converter target choices compatible and reports invalid input accessibly", async () => {
    render(<ColorCssStation toolId="color-converter" />);
    const target = screen.getByLabelText("Output Format");
    expect(Array.from((target as HTMLSelectElement).options).map(option => option.value)).toEqual(["RGB", "HSL"]);

    fireEvent.change(screen.getByLabelText("Color"), { target: { value: "not-a-color" } });
    fireEvent.click(screen.getByRole("button", { name: "Convert" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Use HEX, RGB/RGBA, or HSL/HSLA sRGB syntax.");
    expect(screen.getByLabelText("Color").getAttribute("aria-invalid")).toBe("true");
  });

  it("keeps editable palette exports synchronized and exposes generator add controls", async () => {
    render(<ColorCssStation toolId="palette-generator" />);
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Result ready."));
    const first = screen.getByLabelText("--palette-1") as HTMLInputElement;
    fireEvent.change(first, { target: { value: "#000000" } });
    expect(first.value).toBe("#000000");
    expect(screen.getAllByRole("button", { name: "Copy color" })).toHaveLength(5);

    cleanup();
    render(<ColorCssStation toolId="css-gradient-generator" />);
    expect(screen.getByRole("button", { name: "Add stop" })).toBeTruthy();
    cleanup();
    render(<ColorCssStation toolId="box-shadow-generator" />);
    expect(screen.getByRole("button", { name: "Add layer" })).toBeTruthy();
  });
});
