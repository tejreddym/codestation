// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { hydrateRoot, type Root } from "react-dom/client";
import RootLayout from "@/app/layout";

vi.mock("next/link", () => ({
  default: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a>,
}));

let root: Root | undefined;
// Vitest proxies window for test code; inline scripts run in jsdom's own realm.
const scriptWindow = (globalThis as unknown as { jsdom: { window: Window } }).jsdom.window;

function mockSystemTheme(dark: boolean) {
  const matchMedia = vi.fn(() => ({ matches: dark }));
  vi.stubGlobal("matchMedia", matchMedia);
  Object.defineProperty(scriptWindow, "matchMedia", {
    configurable: true,
    value: matchMedia,
  });
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  mockSystemTheme(true);
});

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  root = undefined;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(scriptWindow, "matchMedia");
});

function serverRender() {
  // document.write executes the actual layout's prepaint script in jsdom.
  document.open();
  document.write(`<!DOCTYPE html>${renderToString(<RootLayout><main>Theme fixture</main></RootLayout>)}`);
  document.close();
}

async function hydrate() {
  const recoverableError = vi.fn();
  await act(async () => {
    root = hydrateRoot(document, <RootLayout><main>Theme fixture</main></RootLayout>, {
      onRecoverableError: recoverableError,
    });
  });
  return recoverableError;
}

describe("theme prepaint and hydration", () => {
  it.each([
    ["dark", false, "dark"],
    ["light", true, "light"],
    [null, true, "dark"],
    [null, false, "light"],
    ["invalid", true, "dark"],
  ] as const)("hydrates saved %s / system dark %s without changing prepaint %s", async (saved, systemDark, expected) => {
    if (saved) window.localStorage.setItem("code-station-theme", saved);
    mockSystemTheme(systemDark);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    serverRender();
    expect(document.documentElement.dataset.theme).toBe(expected);
    const serverMain = document.querySelector("main");
    const recoverableError = await hydrate();

    expect(document.documentElement.dataset.theme).toBe(expected);
    expect(document.querySelector("main")).toBe(serverMain);
    const button = within(document.body).getByRole("button", { name: `Switch to ${expected === "dark" ? "light" : "dark"} mode` });
    expect(button.getAttribute("aria-pressed")).toBe(String(expected === "dark"));
    expect(recoverableError).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("uses the system theme when storage is inaccessible and still supports keyboard toggling", async () => {
    window.localStorage.setItem("code-station-theme", "light");
    const blockedStorage = () => {
      throw new DOMException("Storage is unavailable", "SecurityError");
    };
    vi.spyOn(window, "localStorage", "get").mockImplementation(blockedStorage);
    vi.spyOn(scriptWindow, "localStorage", "get").mockImplementation(blockedStorage);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    serverRender();
    expect(document.documentElement.dataset.theme).toBe("dark");
    const recoverableError = await hydrate();
    const user = userEvent.setup();
    const button = within(document.body).getByRole("button", { name: "Switch to light mode" });
    button.focus();
    await user.keyboard("{Enter}");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(button.getAttribute("aria-pressed")).toBe("false");
    await user.keyboard(" ");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(recoverableError).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("keeps a toggle working when a storage write is rejected", async () => {
    serverRender();
    await hydrate();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Storage is full", "QuotaExceededError");
    });
    const user = userEvent.setup();
    await user.click(within(document.body).getByRole("button", { name: "Switch to light mode" }));
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(within(document.body).getByRole("button", { name: "Switch to dark mode" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("persists an explicit user choice when storage is available", async () => {
    serverRender();
    await hydrate();
    await userEvent.setup().click(within(document.body).getByRole("button", { name: "Switch to light mode" }));
    expect(window.localStorage.getItem("code-station-theme")).toBe("light");
  });

  it("still reports mismatches inside the page", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    serverRender();
    document.querySelector("main")!.textContent = "Unexpected server content";
    const recoverableError = await hydrate();
    expect(recoverableError).toHaveBeenCalled();
    expect(document.querySelector("main")?.textContent).toBe("Theme fixture");
  });
});
