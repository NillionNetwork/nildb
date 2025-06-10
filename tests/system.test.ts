import { StatusCodes } from "http-status-codes";
import { describe } from "vitest";
import { createTestFixtureExtension } from "./fixture/it";

describe("system.test.ts", () => {
  const { it, beforeAll, afterAll } = createTestFixtureExtension();
  beforeAll(async (_c) => {});
  afterAll(async (_c) => {});

  it("responds to health checks", async ({ c }) => {
    const { admin } = c;
    await admin.health(c).expectSuccess();
  });

  it("reports app version", async ({ c }) => {
    const { expect, bindings, admin } = c;

    const { build, public_key } = await admin.about(c).expectSuccess();
    expect(build.version).toBe("0.0.0");
    expect(public_key).toBe(bindings.node.keypair.publicKey("hex"));
  });

  it("should return the current log level", async ({ c }) => {
    const { admin, bindings, expect } = c;

    const result = await admin.getLogLevel(c).expectSuccess();
    expect(result.data).toEqual(bindings.log.level);
  });

  it("can set the log level", async ({ c }) => {
    const { admin, bindings, expect } = c;

    const request = {
      level: "warn",
    } as const;

    await admin.setLogLevel(c, request).expectSuccess();
    expect(bindings.log.level).toEqual(request.level);
  });

  it("starts with maintenance mode disabled", async ({ c }) => {
    const { expect, admin } = c;
    const { maintenance } = await admin.about(c).expectSuccess();
    expect(maintenance.active).toBe(false);
  });

  it("can start maintenance mode", async ({ c }) => {
    const { admin } = c;
    await admin.startMaintenance(c).expectSuccess();
  });

  it("reports maintenance mode is active", async ({ c }) => {
    const { expect, admin } = c;
    const { maintenance } = await admin.about(c).expectSuccess();
    expect(maintenance.active).toBe(true);
  });

  it("reports system unavailable to requests", async ({ c }) => {
    const { builder } = c;
    await builder.getProfile(c).expectFailure(StatusCodes.SERVICE_UNAVAILABLE);
  });

  it("can stop maintenance mode", async ({ c }) => {
    const { admin } = c;
    await admin.stopMaintenance(c).expectSuccess();
  });

  it("reports maintenance mode is inactive after stop", async ({ c }) => {
    const { expect, admin } = c;
    const { maintenance } = await admin.about(c).expectSuccess();
    expect(maintenance.active).toBe(false);
  });
});
