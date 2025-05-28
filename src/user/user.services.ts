import { Effect as E } from "effect";
import type { UUID } from "mongodb";
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

export function updateData() {}

export function deleteData() {}

export function addPermission() {}

export function removePermission() {}
