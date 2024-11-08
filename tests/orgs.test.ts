import { faker } from "@faker-js/faker";
import { decode } from "hono/jwt";
import { ObjectId } from "mongodb";
import { beforeAll, describe, expect, it } from "vitest";
import type { OrgDocument } from "#/models/orgs";
import { type AppFixture, buildAppFixture } from "./fixture/app-fixture";

describe("Orgs", () => {
  let fixture: AppFixture;

  const org = {
    name: faker.company.name(),
    prefix: "zapxx",
    id: "",
    schemaName: "",
    schemaPrimaryKeys: ["wallet"],
    schema: {
      $schema: "http://json-schema.org/draft-07/schema#",
      type: "array",
      uniqueItems: true,
      items: {
        type: "object",
        properties: {
          wallet: {
            type: "string",
            description: "Unique wallet identifier",
          },
          country_code: {
            type: "string",
            description: "String code representing the user's country",
          },
          age: {
            type: "integer",
            description: "User's age",
          },
        },
        required: ["wallet", "country_code", "age"],
      },
    },
    queryName: "",
    query: [
      {
        $match: {
          country_code: "GBR",
        },
      },
      {
        $group: {
          _id: null,
          averageAge: { $avg: "$age" },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          averageAge: 1,
          count: 1,
        },
      },
    ],
  };

  beforeAll(async () => {
    fixture = await buildAppFixture();
  });

  it("can create org", async () => {
    const { data } = await fixture.users.root.createOrg({
      name: org.name,
      prefix: org.prefix,
    });

    const record = await fixture.clients.db
      .db()
      .collection("orgs")
      // @ts-ignore
      .findOne<OrgDocument>({ _id: ObjectId.createFromHexString(data._id) });

    expect(record?.name).toMatch(data.name);
    expect(record?.prefix).toMatch(data.prefix);
    expect(record?.schemas).toEqual({});
    expect(record?.queries).toEqual({});

    org.id = data._id as string;
  });

  it("can generate org api key", async () => {
    const { token } = await fixture.users.root.generateApiKey(org.id);

    const { payload } = decode(token);
    expect(payload.sub).toMatch(org.id);
    expect(payload.type).toMatch("api-key");
    fixture.users.backend.jwt = token;
  });

  it("can list schemas", async () => {
    const { data } = await fixture.users.backend.listSchemas();
    expect(data).toHaveLength(0);
  });

  it("can add schema", async () => {
    const response = await fixture.users.backend.addSchema(
      JSON.stringify({
        primaryKeys: org.schemaPrimaryKeys,
        schema: org.schema,
      }),
    );

    expect(response).toContain(org.prefix);
    expect(response).toHaveLength(17);
    org.schemaName = response;
  });

  it("can list schemas", async () => {
    const { data } = await fixture.users.backend.listSchemas();
    expect(data).toHaveLength(1);
  });

  it("can upload data", async () => {
    const name = org.schemaName;
    const data = [
      {
        wallet: "0x1",
        country_code: "GBR",
        age: 30,
      },
      {
        wallet: "0x2",
        country_code: "CAN",
        age: 31,
      },
      {
        wallet: "0x3",
        country_code: "GBR",
        age: 31,
      },
    ];

    const success = await fixture.users.backend.uploadData(name, data);
    expect(success).toBeTruthy;

    const results = fixture.clients.db.db().collection(name).find({});
    const records = await results.toArray();
    expect(records).toHaveLength(3);
  });

  it("rejects primary key collisions", async () => {
    const name = org.schemaName;
    const data = [
      {
        wallet: "0x1",
        country_code: "GBR",
        age: 30,
      },
    ];

    const success = await fixture.users.backend.uploadData(name, data);
    expect(success).toBeFalsy;

    const results = fixture.clients.db.db().collection(name).find({});
    const records = await results.toArray();
    expect(records).toHaveLength(3);
  });

  it("rejects duplicates in data payload", async () => {
    const name = org.schemaName;
    const data = [
      {
        wallet: "0x4",
        country_code: "GBR",
        age: 30,
      },
      {
        wallet: "0x4",
        country_code: "GBR",
        age: 30,
      },
    ];

    const success = await fixture.users.backend.uploadData(name, data);
    expect(success).toBeFalsy;

    const results = fixture.clients.db.db().collection(name).find({});
    const records = await results.toArray();
    expect(records).toHaveLength(3);
  });

  it("can list queries", async () => {
    const { data } = await fixture.users.backend.listQueries();
    expect(data).toHaveLength(0);
  });

  it("can upload a query", async () => {
    const id = await fixture.users.backend.addQuery(org.schemaName, org.query);
    expect(id).toHaveLength(17);
    org.queryName = id;
  });

  it("can list queries", async () => {
    const { data } = await fixture.users.backend.listQueries();
    expect(data).toHaveLength(1);
    expect(data[0].name).toMatch(org.queryName);
  });

  it("can run a query", async () => {
    const result = await fixture.users.backend.runQuery(org.queryName);

    expect(result.queryName).toMatch(org.queryName);
    expect(result.data).toEqual([
      {
        averageAge: 30.5,
        count: 2,
      },
    ]);
  });

  it("can delete a query", async () => {
    const success = await fixture.users.backend.deleteQuery(org.queryName);
    expect(success).toBeTruthy();

    const query = { [`queries.${org.queryName}`]: { $exists: true } };
    const record = await fixture.clients.db
      .db()
      .collection("orgs")
      .findOne<OrgDocument>(query);

    expect(record?.queries).toBeNull;
  });

  it("can delete schema", async () => {
    const name = org.schemaName;
    const response = await fixture.users.backend.deleteSchema(name);
    expect(response).toBeTruthy();

    const query = { [`schemas.${name}`]: { $exists: true } };

    const record = await fixture.clients.db
      .db()
      .collection("orgs")
      .findOne<OrgDocument>(query);

    expect(record?.schemas).toBeNull;
  });

  it("can delete org", async () => {
    const success = await fixture.users.root.deleteOrg(org.id);
    expect(success).toBeTruthy();

    const record = await fixture.clients.db
      .db()
      .collection("orgs")
      .findOne<OrgDocument>({ id: org.id });

    expect(record).toBeNull();
  });
});
