// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CalendarPicker from "./CalendarPicker";
import TimePicker from "./TimePicker";
import DateTimePicker from "./DateTimePicker";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("CalendarPicker (open-source react-calendar integration)", () => {
  it("renders with DD MM YYYY format for ISO date and opens calendar dialog on click", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<CalendarPicker label="Select date" value="2026-10-02" onChange={onChange} />);

    const input = screen.getByLabelText("Select date") as HTMLInputElement;
    expect(input.value).toBe("02 10 2026");

    // Open calendar dialog
    const toggleBtn = screen.getByLabelText("Open calendar for Select date");
    await user.click(toggleBtn);

    expect(screen.getByRole("dialog", { name: /Calendar picker for Select date/ })).toBeTruthy();
    expect(screen.getByText("October 2026")).toBeTruthy();

    // Click Today button
    await user.click(screen.getByRole("button", { name: "Today" }));
    expect(onChange).toHaveBeenCalled();
  });

  it("handles direct typing of DD MM YYYY and ISO YYYY-MM-DD", () => {
    const onChange = vi.fn();
    render(<CalendarPicker label="Target date" value="" onChange={onChange} />);

    const input = screen.getByLabelText("Target date");

    // Type ISO date directly
    fireEvent.change(input, { target: { value: "2026-12-25" } });
    expect(onChange).toHaveBeenCalledWith("2026-12-25");

    // Type DD MM YYYY date
    fireEvent.change(input, { target: { value: "15 08 2026" } });
    expect(onChange).toHaveBeenCalledWith("2026-08-15");
  });
});

describe("TimePicker (open-source react-clock integration)", () => {
  it("renders with clock trigger and opens clock dialog with steppers and presets", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TimePicker label="Select time" value="14:30" onChange={onChange} />);

    const input = screen.getByLabelText("Select time") as HTMLInputElement;
    expect(input.value).toBe("14:30");

    // Open clock
    const toggleBtn = screen.getByLabelText("Open clock for Select time");
    await user.click(toggleBtn);

    expect(screen.getByRole("dialog", { name: /Clock picker for Select time/ })).toBeTruthy();

    // Click preset chip
    await user.click(screen.getByRole("button", { name: "18:00" }));
    expect(onChange).toHaveBeenCalledWith("18:00");

    // Step hour
    await user.click(screen.getByRole("button", { name: "+" }));
    expect(onChange).toHaveBeenCalled();
  });
});

describe("DateTimePicker (open-source combined Calendar + Clock)", () => {
  it("allows switching between Date & Year and Time tabs", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DateTimePicker
        label="Event date and time"
        value="2026-10-02T12:00:00"
        onChange={onChange}
      />
    );

    // Open via calendar icon
    await user.click(screen.getByLabelText("Open calendar for Event date and time"));
    expect(screen.getByText("Date & Year")).toBeTruthy();
    expect(screen.getByText("Time (Clock)")).toBeTruthy();
    expect(screen.getByText("October 2026")).toBeTruthy();

    // Switch to Time tab
    await user.click(screen.getByRole("button", { name: /Time \(Clock\)/ }));
    expect(screen.getByRole("button", { name: "12:00" })).toBeTruthy();

    // Click preset
    await user.click(screen.getByRole("button", { name: "18:00" }));
    expect(onChange).toHaveBeenCalledWith(expect.stringContaining("18:00:00"));
  });
});
