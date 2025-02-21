import { StatusCodes } from "http-status-codes";
import { Temporal } from "temporal-polyfill";
import { describe, expect } from "vitest";
import type { AdminSetMaintenanceWindowRequest } from "#/admin/admin.types";
import type { AboutNode } from "#/system/system.services";
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

  it("rejects if node's DID does not match target node's DID", async ({
    expect,
    admin,
  }) => {
    const invalidMaintenanceWindow: AdminSetMaintenanceWindowRequest = {
      did: "did:nil:testnet:nillion1definitelynotanildidofthetargetnodeeee",
      start: maintenanceWindow.start,
      end: maintenanceWindow.end,
    };

    let response = await admin.setMaintenanceWindow(invalidMaintenanceWindow);
    expect(response.status).toBe(StatusCodes.BAD_REQUEST);

    response = await admin.deleteMaintenanceWindow({
      did: invalidMaintenanceWindow.did,
    });
    expect(response.status).toBe(StatusCodes.BAD_REQUEST);
  });

  it("rejects if start or end dates are invalid", async ({
    expect,
    admin,
    bindings,
  }) => {
    // End is less than start
    const invalidMaintenanceWindow = {
      did: bindings.node.identity.did,
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

  it("can set a maintenance window", async ({ admin, bindings }) => {
    const response = await admin.setMaintenanceWindow({
      did: bindings.node.identity.did,
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

    const result = (await response.json()) as AboutNode;
    expect(result).toHaveProperty("maintenance");
    expect(result?.maintenance?.start).toEqual(
      maintenanceWindow.start.toISOString(),
    );
    expect(result?.maintenance?.end).toEqual(
      maintenanceWindow.end.toISOString(),
    );
  });

  it("can delete a maintenance window", async ({ expect, admin, bindings }) => {
    const response = await admin.deleteMaintenanceWindow({
      did: bindings.node.identity.did,
    });
    expect(response.status).toBe(StatusCodes.NO_CONTENT);
  });
});
