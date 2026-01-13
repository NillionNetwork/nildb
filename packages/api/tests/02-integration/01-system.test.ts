import { describe } from "vitest";

import { PathsV1 } from "@nillion/nildb-types";

import { createTestFixtureExtension } from "../fixture/it.js";

describe("system.test.js", () => {
  const { it, beforeAll, afterAll } = createTestFixtureExtension();
  beforeAll(async (_c) => {});
  afterAll(async (_c) => {});

  it("responds to health checks", async ({ c }) => {
    const { system, expect } = c;
    const result = await system.health();
    expect(result.ok).toBe(true);
  });

  it("reports app version", async ({ c }) => {
    const { expect, bindings, system } = c;

    const result = await system.about();
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Test setup failed");
    expect(result.data.public_key).toBe(bindings.node.publicKey);
  });

  it("serves /openapi.json", async ({ c }) => {
    const { expect, app } = c;
    const response = await app.request(PathsV1.system.openApiJson);
    const body = await response.json();

    expect(body).toHaveProperty("openapi", "3.1.0");
  });

  it("should return the current log level", async ({ c }) => {
    const { system, bindings, expect } = c;

    const result = await system.getLogLevel();
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Test setup failed");
    expect(result.data.data).toEqual(bindings.log.level);
  });

  it("can set the log level", async ({ c }) => {
    const { system, bindings, expect } = c;

    const request = {
      level: "warn",
    } as const;

    const result = await system.setLogLevel(request);
    expect(result.ok).toBe(true);
    expect(bindings.log.level).toEqual(request.level);
  });

  it("starts with maintenance mode disabled", async ({ c }) => {
    const { expect, system } = c;
    const result = await system.about();
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Test setup failed");
    expect(result.data.maintenance.active).toBe(false);
  });

  it("can start maintenance mode", async ({ c }) => {
    const { system, expect } = c;
    const result = await system.startMaintenance();
    expect(result.ok).toBe(true);
  });

  it("reports maintenance mode is active", async ({ c }) => {
    const { expect, system } = c;
    const result = await system.about();
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Test setup failed");
    expect(result.data.maintenance.active).toBe(true);
  });

  it("reports system unavailable to requests", async ({ c }) => {
    const { expect, builder } = c;
    const result = await builder.getProfile();
    expect(result.ok).toBe(false);
  });

  it("can stop maintenance mode", async ({ c }) => {
    const { system, expect } = c;
    const result = await system.stopMaintenance();
    expect(result.ok).toBe(true);
  });

  it("reports maintenance mode is inactive after stop", async ({ c }) => {
    const { expect, system } = c;
    const result = await system.about();
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Test setup failed");
    expect(result.data.maintenance.active).toBe(false);
  });
});
