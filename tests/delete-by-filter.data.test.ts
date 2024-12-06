import { faker } from "@faker-js/faker";
import { UUID } from "mongodb";
import { beforeAll, describe, expect, it } from "vitest";
import { createUuidDto } from "#/common/types";
import type { Context } from "#/env";
import query from "./data/simple.query.json";
import schema from "./data/simple.schema.json";
import {
  type AppFixture,
  type OrganizationFixture,
  type QueryFixture,
  type SchemaFixture,
  buildFixture,
  setupOrganization,
} from "./fixture/app-fixture";
import type { TestClient } from "./fixture/client";

describe("Schemas delete by filter", () => {
  let fixture: AppFixture;
  let db: Context["db"];
  let backend: TestClient;
  let organization: OrganizationFixture;
  const collectionSize = 100;

  beforeAll(async () => {
    fixture = await buildFixture();
    db = fixture.context.db;
    backend = fixture.users.backend;
    organization = await setupOrganization(
      fixture,
      { ...schema, id: new UUID() } as SchemaFixture,
      { ...query, id: new UUID() } as unknown as QueryFixture,
    );

    const schemaId = organization.schema.id;

    const data = Array.from({ length: collectionSize - 3 }, () => ({
      _id: createUuidDto(),
      name: faker.person.fullName(),
    }));

    data.push({ _id: createUuidDto(), name: "foo" });
    data.push({ _id: createUuidDto(), name: "bar" });
    data.push({ _id: createUuidDto(), name: "bar" });

    const shuffledData = [...data].sort(() => Math.random() - 0.5);

    const _response = await backend.uploadData({
      schema: schemaId,
      data: shuffledData,
    });
  });

  it("rejects empty filter", async () => {
    const schema = organization.schema.id;
    const filter = {};
    const response = await backend.deleteData({ schema, filter });
    expect(response.body.errors).toHaveLength(1);
  });

  it("can remove a single match", async () => {
    const schema = organization.schema.id;
    const filter = { name: "foo" };
    const response = await backend.deleteData({ schema, filter }).expect(200);
    const count = await db.data.collection(schema.toString()).countDocuments();
    expect(response.body.data).toBe(1);
    expect(count).toBe(collectionSize - 1);
  });

  it("can remove multiple matches", async () => {
    const schema = organization.schema.id;
    const filter = { name: "bar" };

    const response = await backend.deleteData({ schema, filter }).expect(200);

    const count = await db.data.collection(schema.toString()).countDocuments();
    expect(response.body.data).toBe(2);
    expect(count).toBe(collectionSize - 3);
  });
});
