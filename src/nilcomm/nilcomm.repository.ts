import { Effect as E, pipe } from "effect";
import type { UUID } from "mongodb";
import {
  type DataCollectionNotFoundError,
  DatabaseError,
} from "#/common/errors";
import { type DocumentBase, checkDataCollectionExists } from "#/common/mongo";
import type { AppBindingsWithNilcomm } from "#/env";
import type { QueryDocument } from "#/queries/queries.types";

type Address = string;
type StoreId = UUID;
type ShareBytes = number[];

type SecretShareDocument = DocumentBase & {
  share: string;
};

type SecretShareDocumentProjection = Pick<SecretShareDocument, "_id" | "share">;

export type CommitRevealResult = Record<Address, ShareBytes>;

export function runCommitRevealAggregation(
  ctx: AppBindingsWithNilcomm,
  query: QueryDocument,
  variables: StoreId[],
): E.Effect<CommitRevealResult, DatabaseError | DataCollectionNotFoundError> {
  const { log } = ctx;

  // ref commit-reveal.query.json
  const pipeline = query.pipeline;

  const storeIds = Object.values(variables);
  // @ts-expect-error a temporary workaround (hopefully), until we have merged improved coercion support
  pipeline[0].$match._id.$in = storeIds;

  return pipe(
    checkDataCollectionExists<DocumentBase>(ctx, query.schema.toString()),
    E.flatMap((collection) =>
      E.tryPromise({
        try: () =>
          collection
            .aggregate<SecretShareDocumentProjection>(pipeline)
            .toArray(),
        catch: (cause) =>
          new DatabaseError({
            cause,
            message: "commit-reveal.query.json aggregation failed",
          }),
      }),
    ),
    E.map((listOfShares) => {
      const sharesMap = new Map(
        listOfShares.map((document) => [
          document._id.toString(),
          [...Buffer.from(document.share, "base64")],
        ]),
      );

      const result: CommitRevealResult = {};
      for (const [storeId, share] of sharesMap.entries()) {
        if (!share) {
          log.warn(`Missing share for storeId=${storeId}`);
        }
        result[storeId] = share;
      }
      return result;
    }),
  );
}
