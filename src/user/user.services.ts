import { Effect as E } from "effect";
import type { UpdateResult, UUID } from "mongodb";
import type {
  CollectionNotFoundError,
  DatabaseError,
  DataValidationError,
  DocumentNotFoundError,
} from "#/common/errors";
import { type Did, Uuid } from "#/common/types";
import type { DataDocument } from "#/data/data.repository";
import * as DataRepository from "#/data/data.repository";
import type { AppBindings } from "#/env";
import {
  type AddPermissionsRequest,
  type DeletePermissionsRequest,
  type Permissions,
  PermissionsSchema,
  type ReadPermissionsRequest,
  type UpdatePermissionsRequest,
} from "#/user/user.types";
import type { UserDocument } from "./user.repository";
import * as UserRepository from "./user.repository";

export function find(
  ctx: AppBindings,
  did: Did,
): E.Effect<
  UserDocument,
  DocumentNotFoundError | CollectionNotFoundError | DatabaseError
> {
  return UserRepository.findById(ctx, did);
}

export function listUserData(
  ctx: AppBindings,
  did: Did,
): E.Effect<
  DataDocument[],
  | DocumentNotFoundError
  | CollectionNotFoundError
  | DatabaseError
  | DataValidationError
> {
  const groupBySchema = (user: UserDocument): Record<string, UUID[]> => {
    return user.data.reduce<Record<string, UUID[]>>((acc, ref) => {
      const schema = ref.schema.toString();
      if (!acc[schema]) {
        acc[schema] = [];
      }
      acc[schema].push(ref.id);
      return acc;
    }, {});
  };

  const readAllDataCollections = (
    references: Record<string, UUID[]>,
  ): E.Effect<
    DataDocument[],
    CollectionNotFoundError | DatabaseError | DataValidationError
  > => {
    return E.forEach(Object.entries(references), ([schema, ids]) =>
      DataRepository.findMany(ctx, Uuid.parse(schema), { _id: { $in: ids } }),
    ).pipe(E.map((arrays) => arrays.flat()));
  };

  return find(ctx, did).pipe(
    E.map((user) => groupBySchema(user)),
    E.flatMap((collections) => readAllDataCollections(collections)),
  );
}

export function readPermissions(
  ctx: AppBindings,
  request: ReadPermissionsRequest,
): E.Effect<
  Permissions[],
  CollectionNotFoundError | DatabaseError | DataValidationError
> {
  return DataRepository.findMany(ctx, request.schema, {
    _id: request.documentId,
  }).pipe(
    E.map((documents) =>
      documents.flatMap((document) =>
        document._perms.map((perms) => PermissionsSchema.parse(perms)),
      ),
    ),
  );
}

export function addPermissions(
  ctx: AppBindings,
  request: AddPermissionsRequest,
): E.Effect<
  UpdateResult,
  CollectionNotFoundError | DatabaseError | DataValidationError
> {
  return UserRepository.addPermissions(
    ctx,
    request.schema,
    request.documentId,
    request.permissions,
  );
}

export function updatePermissions(
  ctx: AppBindings,
  request: UpdatePermissionsRequest,
): E.Effect<
  UpdateResult,
  CollectionNotFoundError | DatabaseError | DataValidationError
> {
  return UserRepository.updatePermissions(
    ctx,
    request.schema,
    request.documentId,
    request.permissions,
  );
}

export function deletePermissions(
  ctx: AppBindings,
  request: DeletePermissionsRequest,
): E.Effect<
  UpdateResult,
  CollectionNotFoundError | DatabaseError | DataValidationError
> {
  return UserRepository.deletePermissions(
    ctx,
    request.schema,
    request.documentId,
    request.did,
  );
}
