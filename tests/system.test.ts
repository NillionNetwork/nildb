import { describe } from "vitest";
import type { AboutNode } from "#/system/system.services";
import { createTestFixtureExtension } from "./fixture/it";

describe("system.test.ts", () => {
  const { it, beforeAll, afterAll } = createTestFixtureExtension();
  beforeAll(async (_c) => {});
  afterAll(async (_c) => {});

  it("responds to health checks", async ({ c }) => {
    const { expect, root } = c;

    const response = await root.health();
    expect(response.ok).toBeTruthy();
  });

  it("reports app version", async ({ c }) => {
    const { expect, bindings, root } = c;

    const response = await root.about();
    expect(response.ok).toBeTruthy();

    const result = (await response.json()) as unknown as AboutNode;
    expect(result.build.version).toBe("0.0.0");
    expect(result.did).toBe(bindings.node.keypair.toDidString());
    expect(result.publicKey).toBe(bindings.node.keypair.publicKey("hex"));
  });
});
