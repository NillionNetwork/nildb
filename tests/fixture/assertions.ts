import { vi } from "vitest";
import type { BuilderDocument } from "#/builders/builders.types";
import type { ApiErrorResponse, ApiSuccessResponse } from "#/common/handler";
import { CollectionName } from "#/common/mongo";
import type { UuidDto } from "#/common/types";
import type { ReadQueryRunByIdResponse } from "#/queries/queries.dto";
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

export async function expectBuilder(
  c: FixtureContext,
  _id: string,
): Promise<BuilderDocument> {
  const document = await c.bindings.db.primary
    .collection<BuilderDocument>(CollectionName.Builders)
    .findOne({ did: _id });

  assertDefined(c, document, `Builder does not exist: did=${_id}`);
  return document;
}

export async function assertDocumentCount(
  c: FixtureContext,
  collection: UuidDto,
  expected: number,
): Promise<void> {
  const count = await c.bindings.db.data
    .collection(collection)
    .countDocuments();

  c.expect(
    count,
    `Unexpected document count: collection=${collection} count=${count} expected=${expected}`,
  ).toBe(expected);
}

/**
 * Polls the API until a query run is complete and returns the run's data object.
 *
 * @param c The fixture context.
 * @param runId The ID of the query run to wait for.
 * @returns A promise that resolves with the data object from the API response.
 */
export function waitForQueryRun(
  c: FixtureContext,
  runId: UuidDto,
): Promise<ReadQueryRunByIdResponse> {
  const { expect, builder } = c;

  return vi.waitFor(
    async () => {
      const result = await builder
        .readQueryRunResults(c, runId)
        .expectSuccess();
      const runData = result.data;
      expect(runData.status).toBeOneOf(["complete", "error"]);
      return result;
    },
    {
      timeout: 5000,
      interval: 500,
    },
  );
}
