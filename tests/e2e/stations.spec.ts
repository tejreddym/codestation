import { test, expect } from "@playwright/test";
import { stations } from "../../config/stations";
import {
  DESKTOP_VIEWPORT,
  expectNoMobileOverflow,
  expectNoSeriousA11yViolations,
  trackRuntimeErrors,
} from "./helpers";

function chunkStations<T>(items: readonly T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

const stationBatches = chunkStations(stations, 3);

test.describe("All 30 station landing pages matrix", () => {
  test("registry exposes all 30 implemented stations", () => {
    expect(stations).toHaveLength(30);
  });

  stationBatches.forEach((batch, batchIndex) => {
    test(`station batch ${batchIndex + 1} (${batch.map((s) => s.id).join(", ")}) loads cleanly with 0 axe violations and 0 mobile overflow`, async ({
      page,
    }) => {
      test.setTimeout(60_000);
      const errors = trackRuntimeErrors(page);

      for (const station of batch) {
        await page.setViewportSize(DESKTOP_VIEWPORT);
        const res = await page.goto(station.route);
        expect(res?.status(), `HTTP 200 expected for ${station.route}`).toBe(200);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await expectNoSeriousA11yViolations(page, station.route);
        await expectNoMobileOverflow(page, station.route);
      }

      expect(errors).toEqual([]);
    });
  });
});
