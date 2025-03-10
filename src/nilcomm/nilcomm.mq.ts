import type { Message as AmqpMessage } from "amqplib";
import { Effect as E, pipe } from "effect";
import type { UUID } from "mongodb";
import {
  AmqpPublishMessageError,
  ExchangeName,
  RoutingKey,
} from "#/common/amqp";
import type { DataValidationError } from "#/common/errors";
import { parseToEffect } from "#/common/zod-utils";
import type { AppBindingsWithNilcomm } from "#/env";
import type { CommitRevealResult } from "#/nilcomm/nilcomm.repository";
import {
  type DappEventExecuteQueryCommandFailed,
  DappEventExecuteQueryCommandFailedSchema,
  type DappEventQueryExecutionCompleted,
  DappEventQueryExecutionCompletedSchema,
  type DappEventSecretStored,
  DappEventSecretStoredSchema,
  type DappEventStoreSecretCommandFailed,
  DappEventStoreSecretCommandFailedSchema,
} from "#/nilcomm/nilcomm.types";

export function emitSecretStoredEvent(
  ctx: AppBindingsWithNilcomm,
  storeId: UUID,
): E.Effect<void, DataValidationError | AmqpPublishMessageError> {
  const {
    log,
    mq: { channel },
  } = ctx;

  const exchange = ExchangeName.Events;
  const key = RoutingKey.eventDappSecretStored;

  return pipe(
    parseToEffect<DappEventSecretStored>(DappEventSecretStoredSchema, {
      id: storeId,
    }),
    E.map((message) =>
      channel.publish(exchange, key, Buffer.from(JSON.stringify(message))),
    ),
    E.flatMap((published) => {
      if (published) {
        return E.succeed(void 0);
      }
      const error = new AmqpPublishMessageError({ key, exchange });
      return E.fail(error);
    }),
    E.tap(() => {
      log.debug("Published secret stored event: id=%s", storeId.toString());
    }),
    E.tapError((error) =>
      E.sync(() => log.error("Failed to emit secret stored event: %O", error)),
    ),
  );
}

export function emitStoreSecretFailedEvent(
  ctx: AppBindingsWithNilcomm,
  storeId: UUID,
  cause: string,
): E.Effect<void, AmqpPublishMessageError | DataValidationError> {
  const {
    log,
    mq: { channel },
  } = ctx;

  const exchange = ExchangeName.Events;
  const key = RoutingKey.eventDappSecretStored;

  return pipe(
    parseToEffect<DappEventStoreSecretCommandFailed>(
      DappEventStoreSecretCommandFailedSchema,
      { storeId, cause },
    ),
    E.map((message) =>
      channel.publish(exchange, key, Buffer.from(JSON.stringify(message))),
    ),
    E.flatMap((published) => {
      if (published) {
        return E.succeed(void 0);
      }
      const error = new AmqpPublishMessageError({ key, exchange });
      return E.fail(error);
    }),
    E.tap(() => {
      log.debug(
        "Published secret store failed event: id=%s",
        storeId.toString(),
      );
    }),
    E.tapError((error) =>
      E.sync(() =>
        log.error("Failed to emit secret store failed event: %O", error),
      ),
    ),
  );
}

export function emitQueryExecutionCompletedEvent(
  ctx: AppBindingsWithNilcomm,
  mappingId: UUID,
  data: CommitRevealResult, // Array(1) [key=data, reason=Expected string, received array]
): E.Effect<void, DataValidationError | AmqpPublishMessageError> {
  const {
    log,
    mq: { channel },
  } = ctx;

  const exchange = ExchangeName.Events;
  const key = RoutingKey.eventDappQueryExecutionCompleted;

  return pipe(
    parseToEffect<DappEventQueryExecutionCompleted>(
      DappEventQueryExecutionCompletedSchema,
      { mappingId, data },
    ),
    E.map((message) =>
      channel.publish(exchange, key, Buffer.from(JSON.stringify(message))),
    ),
    E.flatMap((published) => {
      if (published) {
        return E.succeed(void 0);
      }
      const error = new AmqpPublishMessageError({ key, exchange });
      return E.fail(error);
    }),
    E.tap(() => {
      log.debug(
        "Published query execution completed event: id=%s",
        mappingId.toString(),
      );
    }),
    E.tapError((error) =>
      E.sync(() =>
        log.error("Failed to emit query execution completed event: %O", error),
      ),
    ),
  );
}

export function emitQueryExecutionFailedEvent(
  ctx: AppBindingsWithNilcomm,
  queryId: UUID,
  cause: string,
): E.Effect<undefined, DataValidationError | AmqpPublishMessageError> {
  const {
    log,
    mq: { channel },
  } = ctx;

  const exchange = ExchangeName.Events;
  const key = RoutingKey.eventDappSecretStored;

  return pipe(
    parseToEffect<DappEventExecuteQueryCommandFailed>(
      DappEventExecuteQueryCommandFailedSchema,
      { queryId, cause },
    ),
    E.map((message) =>
      channel.publish(exchange, key, Buffer.from(JSON.stringify(message))),
    ),
    E.flatMap((published) => {
      if (published) {
        return E.succeed(void 0);
      }
      const error = new AmqpPublishMessageError({ key, exchange });
      return E.fail(error);
    }),
    E.tap(() => {
      log.debug(
        "Published query execution failed event: id=%s",
        queryId.toString(),
      );
    }),
    E.tapError((error) =>
      E.sync(() =>
        log.error("Failed to publish query execution failed event: %O", error),
      ),
    ),
  );
}

export function ackMessageProcessedSuccessfully(
  ctx: AppBindingsWithNilcomm,
  msg: AmqpMessage,
): E.Effect<void> {
  return E.sync(() => ctx.mq.channel.ack(msg));
}

export function nackMessageProcessFailure(
  ctx: AppBindingsWithNilcomm,
  msg: AmqpMessage,
): E.Effect<void> {
  return E.sync(() => ctx.mq.channel.nack(msg, false, false));
}
