import { Effect as E, pipe } from "effect";
import type { UUID } from "mongodb";
import * as CollectionsService from "#/collections/collections.services";
import {
  type CollectionNotFoundError,
  type DatabaseError,
  type DataValidationError,
  type DocumentNotFoundError,
  ResourceAccessDeniedError,
} from "#/common/errors";
import type { AppBindings } from "#/env";
import type { Permission, UserDocument } from "#/users/users.types";

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
              user: user.did,
            }),
          );
    }),
  );
}

export function enforceBuilderOwnership(
  requesterId: string,
  resourceOwnerId: string,
  resourceType: "collection" | "query",
  resourceId: UUID,
): E.Effect<void, ResourceAccessDeniedError> {
  if (resourceOwnerId === requesterId) {
    return E.succeed(void 0);
  }
  return E.fail(
    new ResourceAccessDeniedError({
      type: resourceType,
      id: resourceId.toString(),
      user: requesterId,
    }),
  );
}

/**
 * Builds an access-controlled filter for database queries.
 * For standard collections, verifies builder owns the collection.
 * For owned collections, augments the filter with ACL checks.
 */
export function buildAccessControlledFilter(
  ctx: AppBindings,
  builderId: string,
  collectionId: UUID,
  permission: Permission,
  originalFilter: Record<string, unknown>,
): E.Effect<
  Record<string, unknown>,
  | ResourceAccessDeniedError
  | DocumentNotFoundError
  | CollectionNotFoundError
  | DatabaseError
  | DataValidationError
> {
  return pipe(
    CollectionsService.find(ctx, { _id: collectionId }),
    E.flatMap((collection) => {
      // For standard collections, only the owner can access
      if (collection.type === "standard") {
        if (collection.owner === builderId) {
          // Owner has full access - return original filter unchanged
          return E.succeed(originalFilter);
        }
        return E.fail(
          new ResourceAccessDeniedError({
            type: "collection",
            id: collectionId.toString(),
            user: builderId,
          }),
        );
      }

      // For owned collections, augment filter with ACL check
      const aclFilter = {
        _acl: {
          $elemMatch: {
            grantee: builderId,
            [permission]: true,
          },
        },
      };

      // if the original filter is empty then we only need the acl filter
      if (Object.keys(originalFilter).length === 0) {
        return E.succeed(aclFilter);
      }

      // otherwise, we combine the original and acl filters with `$and`
      const secureFilter = {
        $and: [originalFilter, aclFilter],
      };

      return E.succeed(secureFilter);
    }),
  );
}
