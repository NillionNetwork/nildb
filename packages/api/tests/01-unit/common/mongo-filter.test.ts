import { describe, expect, it } from "vitest";

import { DeleteDataRequest, FindDataRequest, MongoExpression, UpdateDataRequest } from "@nillion/nildb-types";

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
