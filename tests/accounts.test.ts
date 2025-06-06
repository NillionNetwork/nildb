import { faker } from "@faker-js/faker";
import { describe } from "vitest";
import { createTestFixtureExtension } from "./fixture/it";

describe("accounts.test.ts", () => {
  const { it, beforeAll, afterAll } = createTestFixtureExtension();

  beforeAll(async (_c) => {});
  afterAll(async (_c) => {});

  it("builder can read its profile", async ({ c }) => {
    const { builder } = c;
    const { data } = await builder.getProfile(c).expectSuccess();
    c.expect(data._id).toBe(builder.did);
  });

  it("builder can update its profile", async ({ c }) => {
    const { builder } = c;
    const newName = faker.company.name();
    await builder.updateProfile(c, { name: newName }).expectSuccess();
    const { data } = await builder.getProfile(c).expectSuccess();
    c.expect(data.name).toBe(newName);
  });
});
