// @vitest-environment jsdom
import { expect, it, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import AudioStation from "./AudioStation";

afterEach(cleanup);

it("renders the Audio Station controls", () => {
  render(<AudioStation toolId="audio-trimmer" />);
  expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Audio Trimmer & Cutter");
  expect(
    screen.getByLabelText(/Select Audio File/i)
  ).toBeTruthy();
});

it.each([
  ["audio-compressor", "Audio Compressor"],
  ["audio-merger", "Audio Merger"],
  ["audio-converter", "Audio Converter"],
] as const)("renders the %s tool from the shared Audio station", (toolId, heading) => {
  render(<AudioStation toolId={toolId} />);
  expect(screen.getByRole("heading", { level: 2, name: heading })).toBeTruthy();
  expect(screen.getByLabelText(/Audio file|Add audio files/i)).toBeTruthy();
});

it("states that MP3 is unavailable in the converter and never silently substitutes it", () => {
  render(<AudioStation toolId="audio-converter" />);
  expect(screen.getByText(/MP3 encoding is not available in this release/i)).toBeTruthy();
  expect(screen.getAllByText(/never .*silently|silently .*format|silently changed/i).length).toBeGreaterThan(0);
});
