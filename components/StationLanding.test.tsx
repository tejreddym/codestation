// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import StationLanding from "./StationLanding";
import { getStation, stations } from "@/config/stations";

afterEach(cleanup);

describe("shared station landing", () => {
  it("renders the Cron landing from registry-owned tools and searches locally", () => {
    render(<StationLanding stationId="cron" />);
    const station = getStation("cron")!;
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Cron Station");
    expect(screen.getByRole("status").textContent).toBe(`${station.toolCount} of ${station.toolCount} tools`);
    expect(screen.getByRole("link", { name: /Cron Validator/ }).getAttribute("href")).toBe("/tools/cron-validator");
    fireEvent.change(screen.getByRole("textbox", { name: "Search Cron tools" }), { target: { value: "validator" } });
    expect(screen.getByRole("status").textContent).toBe("1 of 6 tools");
    expect(screen.getByRole("button", { name: "Clear search" }).hasAttribute("disabled")).toBe(false);
  });

  it("exposes canonical routes for exactly the implemented station set", () => {
    expect(stations).toHaveLength(15);
    expect(stations.every(station => station.route === `/stations/${station.id}`)).toBe(true);
    expect(stations.some(station => station.name === "Developer Math")).toBe(false);
  });
});
