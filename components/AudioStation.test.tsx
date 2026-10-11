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
