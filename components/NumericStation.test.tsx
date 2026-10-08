// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import NumericStation from "./NumericStation";
import { numericTools } from "@/config/numeric-contracts";
import { getTool } from "@/config/tools";

afterEach(cleanup);

describe("NumericStation", () => {
  it.each(numericTools)("renders the declared controls and converts $id", async definition => {
    render(<NumericStation toolId={definition.id} />);
    for (const field of definition.localContract.fields) expect(screen.getByLabelText(field.label)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Convert" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Result ready."));
    expect(screen.getByRole("button", { name: "Copy" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("registers only canonical numeric identities and routes", () => {
    for (const definition of numericTools) expect(getTool(definition.slug)).toMatchObject({ id: definition.id, category: "Converters", slug: definition.slug });
  });
});
