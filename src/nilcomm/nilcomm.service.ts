import { Effect as E, pipe } from "effect";
import { UUID } from "mongodb";
import { RegisterAccountRequest } from "#/accounts/accounts.dto";
import { AccountDataMapper } from "#/accounts/accounts.mapper";
import * as AccountService from "#/accounts/accounts.services";
import type { AmqpPublishMessageError } from "#/common/amqp";
import {
  type CollectionNotFoundError,
  type DatabaseError,
  type DataValidationError,
  DocumentNotFoundError,
} from "#/common/errors";
import { CollectionName } from "#/common/mongo";
import { type Did, DidSchema } from "#/common/types";
import * as DataService from "#/data/data.services";
import type { AppBindingsWithNilcomm } from "#/env";
import type {
  DappCommandStartQueryExecution,
  DappCommandStoreSecret,
} from "#/nilcomm/nilcomm.types";
import * as QueryService from "#/queries/queries.services";
import { AddQueryRequestSchema } from "#/queries/queries.types";
import * as SchemaService from "#/schemas/schemas.services";
import { AddSchemaRequestSchema } from "#/schemas/schemas.types";
import * as NilCommMqService from "./nilcomm.mq";
import { emitQueryExecutionCompletedEvent } from "./nilcomm.mq";
import * as NilCommRepositoryService from "./nilcomm.repository";
import commitRevealQuery from "./schemas/commit-reveal.query.json" with {
  type: "json",
};
import commitRevealSchema from "./schemas/commit-reveal.schema.json" with {
  type: "json",
};

export function processDappStoreSecret(
  ctx: AppBindingsWithNilcomm,
  payload: DappCommandStoreSecret,
): E.Effect<
  void,
  | Error
  | DocumentNotFoundError
  | CollectionNotFoundError
  | DatabaseError
  | AmqpPublishMessageError
> {
  const schemaId = new UUID(commitRevealSchema._id);

  return pipe(
    E.try({
      try: () => {
        const share = payload.share
          .decrypt(ctx.config.nodeSecretKey)
          .toBase64();
        return {
          _id: payload.mappingId.toString(),
          share,
        };
      },
      catch: (cause) => Error("Share decryption failed", { cause }),
    }),
    E.flatMap((data) =>
      DataService.createRecords(ctx, ctx.node.keypair.toDidString(), schemaId, [
        data,
      ]),
    ),
    E.flatMap((_record) =>
      NilCommMqService.emitSecretStoredEvent(ctx, payload.mappingId),
    ),
    E.tapError((e) =>
      publishDappStoreSecretFailed(ctx, payload.mappingId, e.message),
    ),
  );
}

export function publishDappStoreSecretFailed(
  ctx: AppBindingsWithNilcomm,
  storeId: UUID,
  cause: string,
): E.Effect<void, AmqpPublishMessageError | DataValidationError> {
  return pipe(NilCommMqService.emitStoreSecretFailedEvent(ctx, storeId, cause));
}

export function processDappStartQueryExecution(
  ctx: AppBindingsWithNilcomm,
  payload: DappCommandStartQueryExecution,
): E.Effect<
  void,
  | Error
  | DocumentNotFoundError
  | CollectionNotFoundError
  | DatabaseError
  | AmqpPublishMessageError
> {
  const { log } = ctx;
  const queryId = payload.queryId;

  // TODO: Helper method / class?
  const nilcommPk = DidSchema.parse(`did:nil:${payload.ownerPk}`);
  return pipe(
    AccountService.find(ctx, nilcommPk as Did),
    E.flatMap((account) => QueryService.findQueries(ctx, account._id)),
    E.flatMap((queries) => {
      const query = queries.find((q) => q._id.equals(queryId));
      if (query) {
        return E.succeed(query);
      }

      log.warn(`Failed to find dapp execution query id=${queryId.toString()}`);
      return E.fail(
        new DocumentNotFoundError({
          collection: CollectionName.Queries,
          filter: {},
        }),
      );
    }),
    E.flatMap((query) =>
      NilCommRepositoryService.runCommitRevealAggregation(
        ctx,
        query,
        payload.variables,
      ),
    ),
    E.flatMap((result) =>
      emitQueryExecutionCompletedEvent(ctx, payload.mappingId, result),
    ),
    E.tapError((e) => publishDappQueryExecutionFailed(ctx, queryId, e.message)),
  );
}

export function publishDappQueryExecutionFailed(
  ctx: AppBindingsWithNilcomm,
  queryId: UUID,
  cause: string,
): E.Effect<void, AmqpPublishMessageError | DataValidationError> {
  return pipe(
    NilCommMqService.emitQueryExecutionFailedEvent(ctx, queryId, cause),
  );
}

export async function ensureNilcommAccount(
  ctx: AppBindingsWithNilcomm,
): Promise<void> {
  const { log } = ctx;

  // TODO: Helper method / class?
  const did = DidSchema.parse(`did:nil:${ctx.config.nilcommPublicKey}`) as Did;

  return pipe(
    AccountService.find(ctx, did),
    E.tap(() => {
      log.info("Nilcomm account exists");
    }),
    E.catchTag("DocumentNotFoundError", () => {
      log.info("Nilcomm account not found");
      const registerRequest = RegisterAccountRequest.parse({
        did,
        name: "nilcomm",
      });

      const schemaRequest = AddSchemaRequestSchema.parse(commitRevealSchema);
      const queryRequest = AddQueryRequestSchema.parse(commitRevealQuery);

      return pipe(
        AccountService.createAccount(
          ctx,
          AccountDataMapper.fromRegisterAccountRequest(registerRequest),
        ),
        E.flatMap(() =>
          SchemaService.addSchema(ctx, {
            ...schemaRequest,
            owner: did,
          }),
        ),
        E.flatMap(() =>
          QueryService.addQuery(ctx, {
            ...queryRequest,
            owner: did,
          }),
        ),
        E.tap(() => {
          log.info(
            "Created nilcomm account with commit-reveal schema and query",
          );
        }),
      );
    }),
    E.as(void 0),
    E.runPromise,
  );
}
