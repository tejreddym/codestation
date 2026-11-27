// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { getFocusableElements, trapModalTabFocus } from "./focusTrap";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("modal focusTrap", () => {
  it("wraps Tab from last focusable to first and Shift+Tab from first to last", () => {
    const dialog = document.createElement("div");
    dialog.tabIndex = -1;
    const btnFirst = document.createElement("button");
    btnFirst.textContent = "First";
    const inputMid = document.createElement("input");
    const btnDisabled = document.createElement("button");
    btnDisabled.disabled = true;
    const btnLast = document.createElement("button");
    btnLast.textContent = "Last";

    dialog.append(btnFirst, inputMid, btnDisabled, btnLast);
    document.body.appendChild(dialog);

    const focusables = getFocusableElements(dialog);
    expect(focusables).toEqual([btnFirst, inputMid, btnLast]);

    btnLast.focus();
    const tabForward = new KeyboardEvent("keydown", { key: "Tab", cancelable: true });
    trapModalTabFocus(tabForward, dialog);
    expect(tabForward.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(btnFirst);

    const tabBackward = new KeyboardEvent("keydown", {
      key: "Tab",
      shiftKey: true,
      cancelable: true,
    });
    trapModalTabFocus(tabBackward, dialog);
    expect(tabBackward.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(btnLast);
  });
});
