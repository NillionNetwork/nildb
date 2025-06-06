import type { UUID } from "mongodb";
import type { ApiErrorResponse, ApiSuccessResponse } from "#/common/handler";
import { CollectionName } from "#/common/mongo";
import type { AccountDocument, Did } from "#/common/types";
import type { FixtureContext } from "./fixture";

export function assertDefined<T>(
  c: FixtureContext,
  value: T | undefined | null,
  message?: string,
): asserts value is T {
  c.expect(
    value,
    message ?? "Expected value to be defined, but it was undefined",
  ).toBeDefined();

  c.expect(
    value,
    message ?? "Expected value to be non-null, but it was null",
  ).not.toBeNull();
}

export async function expectSuccessResponse<T>(
  c: FixtureContext,
  response: Response,
): Promise<ApiSuccessResponse<T>> {
  c.expect(
    response.ok,
    `Expected success response but got: code=${response.status}`,
  ).toBeTruthy();

  const body = (await response.json()) as ApiSuccessResponse<T>;
  c.expect(body.data).toBeDefined();
  return body;
}

export async function expectErrorResponse(
  c: FixtureContext,
  response: Response,
): Promise<ApiErrorResponse> {
  c.expect(
    response.ok,
    `Expected failure response but got: code=${response.status}`,
  ).toBeFalsy();

  const body = (await response.json()) as ApiErrorResponse;
  c.expect(body.errors).toBeDefined();
  return body;
}

export async function expectAccount<
  T extends AccountDocument = AccountDocument,
>(c: FixtureContext, did: Did): Promise<T> {
  const document = await c.bindings.db.primary
    .collection<AccountDocument>(CollectionName.Accounts)
    .findOne({ _id: did });

  assertDefined(c, document, `Account does not exist: did=${did}`);
  return document as T;
}

export async function assertDocumentCount(
  c: FixtureContext,
  collection: UUID,
  expected: number,
): Promise<void> {
  const count = await c.bindings.db.data
    .collection(collection.toString())
    .countDocuments();

  c.expect(
    count,
    `Unexpected document count: collection=${collection} count=${count} expected=${expected}`,
  ).toBe(expected);
}
