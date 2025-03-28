import { describe } from "vitest";
import type { AboutNode } from "#/system/system.services";
import { createTestFixtureExtension } from "./fixture/it";

describe("system.test.ts", () => {
  const { it, beforeAll, afterAll } = createTestFixtureExtension();
  beforeAll(async (_ctx) => {});
  afterAll(async (_ctx) => {});

  it("responds to health checks", async ({ expect, admin }) => {
    const response = await admin.health();
    expect(response.ok).toBeTruthy();
  });

  it("reports app version", async ({ expect, bindings, admin }) => {
    const response = await admin.about();
    expect(response.ok).toBeTruthy();

    const result = (await response.json()) as unknown as AboutNode;
    expect(result.build.version).toBe("0.0.0");
    expect(result.did).toBe(bindings.node.keypair.toDidString());
    expect(result.publicKey).toBe(bindings.node.keypair.publicKey("hex"));
  });
});
