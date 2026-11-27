// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import PwaInstallPrompt from "./PwaInstallPrompt";

describe("PwaInstallPrompt", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("remains hidden until beforeinstallprompt fires, triggers install, and persists dismissal", async () => {
    const { rerender } = render(<PwaInstallPrompt />);
    expect(screen.queryByTestId("pwa-install-banner")).toBeNull();

    const promptMock = vi.fn().mockResolvedValue(undefined);
    const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
      prompt: promptMock,
      userChoice: Promise.resolve({ outcome: "accepted" as const }),
    });

    await act(async () => {
      window.dispatchEvent(event);
    });

    const banner = screen.getByTestId("pwa-install-banner");
    expect(banner).toBeDefined();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Install App" }));
    });
    expect(promptMock).toHaveBeenCalledTimes(1);

    // Re-fire event and dismiss cleanly -> persisted to localStorage
    await act(async () => {
      window.dispatchEvent(
        Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
          prompt: vi.fn().mockResolvedValue(undefined),
          userChoice: Promise.resolve({ outcome: "dismissed" as const }),
        })
      );
    });
    fireEvent.click(screen.getByRole("button", { name: "Dismiss install prompt" }));
    expect(screen.queryByTestId("pwa-install-banner")).toBeNull();
    expect(localStorage.getItem("code-station-install-dismissed-v1")).toBe("1");

    // Stays hidden across remount once dismissed
    rerender(<PwaInstallPrompt key="remounted" />);
    expect(screen.queryByTestId("pwa-install-banner")).toBeNull();
  });
});
