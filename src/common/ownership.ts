import { Effect as E, pipe } from "effect";
import type { UUID } from "mongodb";
import type { OrganizationAccountDocument } from "#/accounts/accounts.mapper";
import { ResourceAccessDeniedError } from "#/common/errors";

export function enforceQueryOwnership(
  account: OrganizationAccountDocument,
  query: UUID,
): E.Effect<void, ResourceAccessDeniedError> {
  return pipe(
    E.succeed(account.queries.some((s) => s.toString() === query.toString())),
    E.flatMap((isAuthorized) => {
      return isAuthorized
        ? E.succeed(void 0)
        : E.fail(
            new ResourceAccessDeniedError({
              type: "query",
              id: query.toString(),
              user: account._id,
            }),
          );
    }),
  );
}

export function enforceSchemaOwnership(
  account: OrganizationAccountDocument,
  schema: UUID,
): E.Effect<void, ResourceAccessDeniedError> {
  return pipe(
    E.succeed(account.schemas.some((s) => s.toString() === schema.toString())),
    E.flatMap((isAuthorized) => {
      return isAuthorized
        ? E.succeed(void 0)
        : E.fail(
            new ResourceAccessDeniedError({
              type: "schema",
              id: schema.toString(),
              user: account._id,
            }),
          );
    }),
  );
}
