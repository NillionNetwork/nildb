import { StatusCodes } from "http-status-codes";
import { Temporal } from "temporal-polyfill";
import { describe, expect } from "vitest";
import { expectErrorResponse } from "./fixture/assertions";
import { createTestFixtureExtension } from "./fixture/it";

describe("node maintenance window management", () => {
  const { it, beforeAll, afterAll } = createTestFixtureExtension();
  beforeAll(async (_ctx) => {});
  afterAll(async (_ctx) => {});

  const start = Temporal.Now.instant();
  const end = start.add({ hours: 1 });
  const maintenanceWindow = {
    start: new Date(start.epochMilliseconds),
    end: new Date(end.epochMilliseconds),
  };

  it("rejects if start or end dates are invalid", async ({ expect, admin }) => {
    // End is less than start
    const invalidMaintenanceWindow = {
      start: maintenanceWindow.start,
      end: new Date(start.subtract({ hours: 2 }).epochMilliseconds),
    };

    let response = await admin.setMaintenanceWindow(invalidMaintenanceWindow);
    expect(response.status).toBe(StatusCodes.BAD_REQUEST);

    let error = await expectErrorResponse(response);
    expect(error.errors).includes("DataValidationError");

    // End is same as start
    invalidMaintenanceWindow.end = invalidMaintenanceWindow.start;

    response = await admin.setMaintenanceWindow(invalidMaintenanceWindow);
    expect(response.status).toBe(StatusCodes.BAD_REQUEST);

    error = await expectErrorResponse(response);
    expect(error.errors).includes("DataValidationError");

    // End is less than now
    invalidMaintenanceWindow.end = new Date(
      Temporal.Now.instant().subtract({
        minutes: 1,
      }).epochMilliseconds,
    );

    response = await admin.setMaintenanceWindow(invalidMaintenanceWindow);
    expect(response.status).toBe(StatusCodes.BAD_REQUEST);

    error = await expectErrorResponse(response);
    expect(error.errors).includes("DataValidationError");
  });

  it("can set a maintenance window", async ({ admin }) => {
    const response = await admin.setMaintenanceWindow({
      start: maintenanceWindow.start,
      end: maintenanceWindow.end,
    });
    expect(response.status).toBe(StatusCodes.OK);
  });

  it("should return maintenance window details at `/about` when node is in maintenance", async ({
    expect,
    admin,
  }) => {
    const response = await admin.about();
    expect(response.status).toBe(StatusCodes.OK);

    const result = (await response.json()) as {
      maintenance: { start: string; end: string };
    };

    const { start: expectedStart, end: expectedEnd } = maintenanceWindow;

    const actualStart = new Date(result.maintenance.start).getUTCSeconds();
    expect(actualStart).toEqual(expectedStart.getUTCSeconds());

    const actualEnd = new Date(result.maintenance.end).getUTCSeconds();
    expect(actualEnd).toEqual(expectedEnd.getUTCSeconds());
  });

  it("can delete a maintenance window", async ({ expect, admin }) => {
    const response = await admin.deleteMaintenanceWindow();
    expect(response.status).toBe(StatusCodes.NO_CONTENT);
  });
});
