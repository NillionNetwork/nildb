import { Effect as E, pipe } from "effect";
import {
  type CollectionNotFoundError,
  DatabaseError,
  type DataValidationError,
} from "#/common/errors";
import {
  CollectionName,
  checkCollectionExists,
  type DocumentBase,
} from "#/common/mongo";
import type { Did, UuidDto } from "#/common/types";
import type { AppBindings } from "#/env";

export type LogOperation =
  | { op: "write"; col: UuidDto }
  | { op: "delete"; col: UuidDto };

export type UserDocument = DocumentBase<Did> & {
  data: UuidDto[];
  log: LogOperation[];
};

export function upsert(
  ctx: AppBindings,
  userId: Did,
  data: UuidDto[],
): E.Effect<
  void,
  CollectionNotFoundError | DatabaseError | DataValidationError
> {
  return pipe(
    checkCollectionExists<UserDocument>(ctx, "primary", CollectionName.User),
    E.tryMapPromise({
      try: (collection) =>
        collection.updateOne(
          {
            _id: userId,
          },
          {
            $set: {
              _created: new Date(),
            },
            $setOnInsert: {
              _updated: new Date(),
            },
            $addToSet: {
              data: {
                $each: data,
              },
              log: {
                $each: data.map((col) => ({ op: "write", col })),
              },
            },
          },
          { upsert: true },
        ),
      catch: (cause) => new DatabaseError({ cause, message: "upsert" }),
    }),
    E.as(void 0),
  );
}

export function removeData(
  ctx: AppBindings,
  userId: Did,
  data: UuidDto[],
): E.Effect<
  void,
  CollectionNotFoundError | DatabaseError | DataValidationError
> {
  return pipe(
    checkCollectionExists<UserDocument>(ctx, "primary", CollectionName.User),
    E.tryMapPromise({
      try: (collection) =>
        collection.updateOne(
          {
            _id: userId,
          },
          {
            $set: {
              _updated: new Date(),
            },
            $pull: {
              data: {
                $in: data.map((uuid) => uuid.toString() as UuidDto),
              },
            },
            $addToSet: {
              log: {
                $each: data.map((col) => ({ op: "delete", col })),
              },
            },
          },
          { upsert: true },
        ),
      catch: (cause) => new DatabaseError({ cause, message: "remove data" }),
    }),
    E.as(void 0),
  );
}
