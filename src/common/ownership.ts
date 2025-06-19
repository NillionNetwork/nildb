import { Effect as E, pipe } from "effect";
import type { UUID } from "mongodb";
import type { BuilderDocument } from "#/builders/builders.types";
import { ResourceAccessDeniedError, RevokeAccessError } from "#/common/errors";
import type { UserDocument } from "#/users/users.types";

export function enforceQueryOwnership(
  builder: BuilderDocument,
  query: UUID,
): E.Effect<void, ResourceAccessDeniedError> {
  return pipe(
    E.succeed(builder.queries.some((s) => s.toString() === query.toString())),
    E.flatMap((isAuthorized) => {
      return isAuthorized
        ? E.succeed(void 0)
        : E.fail(
            new ResourceAccessDeniedError({
              type: "query",
              id: query.toString(),
              user: builder._id,
            }),
          );
    }),
  );
}

export function enforceCollectionOwnership(
  builder: BuilderDocument,
  collection: UUID,
): E.Effect<void, ResourceAccessDeniedError> {
  return pipe(
    E.succeed(
      builder.collections.some((s) => s.toString() === collection.toString()),
    ),
    E.flatMap((isAuthorized) => {
      return isAuthorized
        ? E.succeed(void 0)
        : E.fail(
            new ResourceAccessDeniedError({
              type: "collection",
              id: collection.toString(),
              user: builder._id,
            }),
          );
    }),
  );
}

export function enforceDataOwnership(
  user: UserDocument,
  document: UUID,
  collection: UUID,
): E.Effect<void, ResourceAccessDeniedError> {
  return pipe(
    E.succeed(
      user.data.some(
        (s) =>
          s.document.toString() === document.toString() &&
          s.collection.toString() === collection.toString(),
      ),
    ),
    E.flatMap((isAuthorized) => {
      return isAuthorized
        ? E.succeed(void 0)
        : E.fail(
            new ResourceAccessDeniedError({
              type: "collection",
              id: document.toString(),
              user: user._id,
            }),
          );
    }),
  );
}

export function checkRevokeAccess(
  builder: BuilderDocument,
  document: UUID,
): E.Effect<void, RevokeAccessError> {
  return pipe(
    E.succeed(
      builder.collections.some((s) => s.toString() === document.toString()),
    ),
    E.flatMap((isOwner) => {
      return !isOwner
        ? E.succeed(void 0)
        : E.fail(
            new RevokeAccessError({
              type: "collection",
              id: document.toString(),
            }),
          );
    }),
  );
}
