import { StatusCodes } from "http-status-codes";
import { describe, expect } from "vitest";
import type { LogLevelInfo } from "#/admin/admin.types";
import { createTestFixtureExtension } from "./fixture/it";

describe("log level management", () => {
  const { it, beforeAll, afterAll } = createTestFixtureExtension();
  beforeAll(async (_c) => {});
  afterAll(async (_c) => {});

  it("should return the current log level", async ({ c }) => {
    const { root, bindings } = c;

    const response = await root.getLogLevel();
    expect(response.status).toBe(StatusCodes.OK);

    const result = (await response.json()) as LogLevelInfo;
    expect(result).toHaveProperty("level");
    expect(result.level).toEqual(bindings.log.level);
    expect(result).toHaveProperty("levelValue");
    expect(result.levelValue).toEqual(bindings.log.levelVal);
  });

  it("can set the log level", async ({ c }) => {
    const { root, bindings } = c;

    const request = {
      level: "warn",
    } as const;

    const response = await root.setLogLevel(request);
    expect(response.status).toBe(StatusCodes.OK);
    expect(bindings.log.level).toEqual(request.level);
  });
});
