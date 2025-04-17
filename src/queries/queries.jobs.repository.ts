import { Effect as E, pipe } from "effect";
import { type StrictFilter } from "mongodb";
import {
  DatabaseError,
  DocumentNotFoundError,
  type PrimaryCollectionNotFoundError,
} from "#/common/errors";
import { CollectionName, checkPrimaryCollectionExists } from "#/common/mongo";
import type { AppBindings } from "#/env";
import type { QueryJobDocument } from "./queries.types";

export function findOne(
  ctx: AppBindings,
  filter: StrictFilter<QueryJobDocument>,
): E.Effect<
  QueryJobDocument,
  DocumentNotFoundError | PrimaryCollectionNotFoundError | DatabaseError
> {
  return pipe(
    checkPrimaryCollectionExists<QueryJobDocument>(
      ctx,
      CollectionName.JobsQueries,
    ),
    E.flatMap((collection) =>
      E.tryPromise({
        try: () => collection.findOne(filter),
        catch: (cause) => new DatabaseError({ cause, message: "findOne" }),
      }),
    ),
    E.flatMap((document) =>
      document
        ? E.succeed(document)
        : E.fail(
            new DocumentNotFoundError({
              collection: CollectionName.JobsQueries,
              filter,
            }),
          ),
    ),
  );
}
