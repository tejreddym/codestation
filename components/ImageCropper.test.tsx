// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ImageCropper, { type Crop } from "./ImageCropper";

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function Controlled({ initial = { x: 20, y: 10, width: 40, height: 20 } }: { initial?: Crop }) {
  const [crop, setCrop] = useState(initial);
  return <ImageCropper id="crop" src="blob:local" width={80} height={40} value={crop} onChange={setCrop} />;
}

describe("Image cropper accessible intrinsic pixel selection", () => {
  it("moves and Shift-resizes by keyboard and announces exact selection", async () => {
    const user = userEvent.setup(); render(<Controlled />);
    screen.getByRole("group", { name: "Move crop selection" }).focus();
    await user.keyboard("{ArrowRight}{ArrowDown}{Shift>}{ArrowRight}{ArrowDown}{/Shift}");
    expect(screen.getByText("Selection: 41 × 21 pixels at 21, 11.")).toBeTruthy();
    screen.getByRole("button", { name: "Resize crop selection" }).focus(); await user.keyboard("{ArrowLeft}{ArrowUp}");
    expect(screen.getByText("Selection: 40 × 20 pixels at 21, 11.")).toBeTruthy();
  });
  it("clamps movement and resizing to the source and keeps positive dimensions", async () => {
    const user = userEvent.setup(); render(<Controlled initial={{ x: 0, y: 0, width: 1, height: 1 }} />);
    screen.getByRole("group", { name: "Move crop selection" }).focus();
    await user.keyboard("{ArrowLeft}{ArrowUp}{Shift>}{ArrowLeft}{ArrowUp}{/Shift}");
    expect(screen.getByText("Selection: 1 × 1 pixels at 0, 0.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Select whole image" }));
    screen.getByRole("group", { name: "Move crop selection" }).focus();
    await user.keyboard("{ArrowRight}{ArrowDown}{Shift>}{ArrowRight}{ArrowDown}{/Shift}");
    expect(screen.getByText("Selection: 80 × 40 pixels at 0, 0.")).toBeTruthy();
  });
  it("maps pointer drag and corner resize from display to intrinsic pixels", () => {
    vi.stubGlobal("PointerEvent", MouseEvent);
    const onChange = vi.fn();
    const { container } = render(<ImageCropper id="crop" src="blob:local" width={80} height={40} value={{ x: 20, y: 10, width: 40, height: 20 }} onChange={onChange} />);
    const board = container.querySelector("img")!.parentElement!;
    vi.spyOn(board, "getBoundingClientRect").mockReturnValue({ width: 160, height: 80, left: 0, top: 0 } as DOMRect);
    const selection = screen.getByRole("group", { name: "Move crop selection" });
    fireEvent.pointerDown(selection, { button: 0, clientX: 40, clientY: 20 });
    fireEvent.pointerMove(selection, { clientX: 50, clientY: 30 }); fireEvent.pointerUp(selection);
    expect(onChange).toHaveBeenLastCalledWith({ x: 25, y: 15, width: 40, height: 20 });
    const resize = screen.getByRole("button", { name: "Resize crop selection" });
    fireEvent.pointerDown(resize, { button: 0, clientX: 120, clientY: 60 });
    fireEvent.pointerMove(resize, { clientX: 130, clientY: 70 }); fireEvent.pointerUp(resize);
    expect(onChange).toHaveBeenLastCalledWith({ x: 20, y: 10, width: 45, height: 25 });
    const calls = onChange.mock.calls.length; fireEvent.pointerMove(resize, { clientX: 140, clientY: 80 }); expect(onChange).toHaveBeenCalledTimes(calls);
  });
});
