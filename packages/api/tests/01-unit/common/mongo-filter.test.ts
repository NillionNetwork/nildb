import { describe, expect, it } from "vitest";

import {
  DeleteDataRequest,
  FindDataRequest,
  MongoExpression,
  MongoUpdateExpression,
  UpdateDataRequest,
  UpdateUserDataRequest,
} from "@nillion/nildb-types";

const collection = "11111111-1111-4111-8111-111111111111";

describe("MongoExpression", () => {
  it("accepts an ordinary filter", () => {
    expect(MongoExpression.safeParse({ name: "alice", age: { $gt: 30 } }).success).toBe(true);
  });

  it.each([
    ["$where", { $where: "while(true){}" }],
    ["$function", { $expr: { $function: { body: "function(){}", args: [], lang: "js" } } }],
    ["$accumulator", { $accumulator: { init: "function(){}" } }],
  ])("rejects %s", (_name, filter) => {
    expect(MongoExpression.safeParse(filter).success).toBe(false);
  });

  it("rejects a server-side js operator nested inside $and", () => {
    const filter = { $and: [{ name: "alice" }, { $where: "sleep(10000)" }] };

    expect(MongoExpression.safeParse(filter).success).toBe(false);
  });

  it("rejects a server-side js operator nested deep in an array", () => {
    const filter = { $or: [{ $and: [{ x: 1 }, { $nor: [{ $where: "1" }] }] }] };

    expect(MongoExpression.safeParse(filter).success).toBe(false);
  });
});

describe("data requests", () => {
  it("rejects $where on find", () => {
    expect(FindDataRequest.safeParse({ collection, filter: { $where: "1" } }).success).toBe(false);
  });

  it("rejects $where on update, in the filter and in the update document", () => {
    expect(
      UpdateDataRequest.safeParse({ collection, filter: { $where: "1" }, update: { $set: { a: 1 } } }).success,
    ).toBe(false);
    expect(UpdateDataRequest.safeParse({ collection, filter: { a: 1 }, update: { $where: "1" } }).success).toBe(false);
  });

  it("rejects $where on delete but keeps the non-empty filter rule", () => {
    expect(DeleteDataRequest.safeParse({ collection, filter: { $where: "1" } }).success).toBe(false);
    expect(DeleteDataRequest.safeParse({ collection, filter: {} }).success).toBe(false);
    expect(DeleteDataRequest.safeParse({ collection, filter: { a: 1 } }).success).toBe(true);
  });
});

describe("MongoUpdateExpression", () => {
  it.each(["_id", "_owner", "_acl", "_created", "_updated"])("rejects updates to %s", (field) => {
    expect(MongoUpdateExpression.safeParse({ $set: { [field]: "attacker" } }).success).toBe(false);
    expect(MongoUpdateExpression.safeParse({ $unset: { [`${field}.nested`]: "" } }).success).toBe(false);
  });

  it("rejects renaming a field into protected metadata", () => {
    expect(MongoUpdateExpression.safeParse({ $rename: { name: "_owner" } }).success).toBe(false);
  });

  it("allows updates to application data", () => {
    expect(MongoUpdateExpression.safeParse({ $set: { name: "alice", "profile.age": 30 } }).success).toBe(true);
  });

  it("protects both builder and user update requests", () => {
    expect(UpdateDataRequest.safeParse({ collection, filter: { name: "alice" }, update: { $set: { _acl: [] } } }).success).toBe(false);
    expect(
      UpdateUserDataRequest.safeParse({
        collection,
        document: "22222222-2222-4222-8222-222222222222",
        update: { $set: { _owner: "did:key:zattacker" } },
      }).success,
    ).toBe(false);
  });
});
