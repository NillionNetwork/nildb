import { StatusCodes } from "http-status-codes";
import { describe } from "vitest";
import { PathsV1 } from "#/common/paths";
import { createTestFixtureExtension } from "./fixture/it";

describe("system.test.ts", () => {
  const { it, beforeAll, afterAll } = createTestFixtureExtension();
  beforeAll(async (_c) => {});
  afterAll(async (_c) => {});

  it("responds to health checks", async ({ c }) => {
    const { system } = c;
    await system.health(c).expectSuccess();
  });

  it("reports app version", async ({ c }) => {
    const { expect, bindings, system } = c;

    const { build, public_key } = await system.about(c).expectSuccess();
    expect(build.version).toBe("0.0.0");
    expect(public_key).toBe(bindings.node.keypair.publicKey());
  });

  it("serves /openapi.json", async ({ c }) => {
    const { expect, system } = c;
    const response = await system.app.request(PathsV1.system.openApiJson);
    const body = await response.json();

    expect(body).toHaveProperty("openapi", "3.1.0");
  });

  it("should return the current log level", async ({ c }) => {
    const { system, bindings, expect } = c;

    const result = await system.getLogLevel(c).expectSuccess();
    expect(result.data).toEqual(bindings.log.level);
  });

  it("can set the log level", async ({ c }) => {
    const { system, bindings, expect } = c;

    const request = {
      level: "warn",
    } as const;

    await system.setLogLevel(c, request).expectSuccess();
    expect(bindings.log.level).toEqual(request.level);
  });

  it("starts with maintenance mode disabled", async ({ c }) => {
    const { expect, system } = c;
    const { maintenance } = await system.about(c).expectSuccess();
    expect(maintenance.active).toBe(false);
  });

  it("can start maintenance mode", async ({ c }) => {
    const { system } = c;
    await system.startMaintenance(c).expectSuccess();
  });

  it("reports maintenance mode is active", async ({ c }) => {
    const { expect, system } = c;
    const { maintenance } = await system.about(c).expectSuccess();
    expect(maintenance.active).toBe(true);
  });

  it("reports system unavailable to requests", async ({ c }) => {
    const { builder } = c;
    await builder.getProfile(c).expectFailure(StatusCodes.SERVICE_UNAVAILABLE);
  });

  it("can stop maintenance mode", async ({ c }) => {
    const { system } = c;
    await system.stopMaintenance(c).expectSuccess();
  });

  it("reports maintenance mode is inactive after stop", async ({ c }) => {
    const { expect, system } = c;
    const { maintenance } = await system.about(c).expectSuccess();
    expect(maintenance.active).toBe(false);
  });
});
