import type * as amqp from "amqplib";
import { Data, Effect as E, pipe } from "effect";
import type * as zod from "zod";
import { DataValidationError } from "#/common/errors";
import { flattenZodError } from "#/common/zod-utils";
import type { AppBindingsWithNilcomm } from "#/env";
import {
  ackMessageProcessedSuccessfully,
  nackMessageProcessFailure,
} from "#/nilcomm/nilcomm.mq";

export const ExchangeName = {
  Commands: "nil.commands",
  Events: "nil.events",
  DeadLetter: "nil.dlx",
} as const;
export type ExchangeName = (typeof ExchangeName)[keyof typeof ExchangeName];

export const QueueName = {
  deadLetter: "nil.dlx.queue",
  nilDbCommandStoreSecret: "nildb.commands.dapp.store_secret",
  nilCommEventSecretStored: "nilcomm.events.dapp.secret_stored",
  nilDbCommandStartQueryExecution: "nildb.commands.dapp.start_query_execution",
  nilCommEventQueryExecutionCompleted:
    "nilcomm.events.dapp.query_execution_completed",
} as const;
export type QueueName = (typeof QueueName)[keyof typeof QueueName];

export const RoutingKey = {
  commandDappStoreSecret: "command.dapp.store_secret",
  eventDappSecretStored: "event.dapp.secret_stored",
  commandDappStartQueryExecution: "command.dapp.start_query_execution",
  eventDappQueryExecutionCompleted: "event.dapp.query_execution_completed",
};
export type RoutingKey = (typeof RoutingKey)[keyof typeof RoutingKey];

export const defaultQueueOptions: amqp.Options.AssertQueue = {
  durable: true,
  arguments: {
    "x-dead-letter-exchange": ExchangeName.DeadLetter,
    "x-dead-letter-routing-key": QueueName.deadLetter,
    // one day in milliseconds
    "x-message-ttl": 86_400_000,
  },
};
export const defaultConsumeOptions: amqp.Options.Consume = { noAck: false };

export function parseAmqpMessage<T>(
  msg: amqp.Message,
  schema: zod.Schema,
): E.Effect<T, DataValidationError> {
  if (!Buffer.isBuffer(msg.content)) {
    return E.fail(
      new DataValidationError({
        issues: ["Message content is not a Buffer"],
        cause: msg,
      }),
    );
  }
  const content = msg.content.toString();

  return pipe(
    E.try({
      try: () => JSON.parse(content),
      catch: (cause) =>
        new DataValidationError({
          issues: [`Amqp message is not valid JSON: ${content}`],
          cause,
        }),
    }),
    E.flatMap((json) => {
      const result = schema.safeParse(json);

      return result.success
        ? E.succeed(result.data)
        : E.fail(
            new DataValidationError({
              issues: ["Amqp message failed schema validation"],
              cause: flattenZodError(result.error),
            }),
          );
    }),
  );
}

export function runMessageConsume<E>(
  ctx: AppBindingsWithNilcomm,
  msg: amqp.Message,
  exchange: ExchangeName,
  queue: QueueName,
  key: RoutingKey,
): (effect: E.Effect<void, E>) => Promise<void> {
  return (effect: E.Effect<void, E>) =>
    pipe(
      effect,
      E.tap(() => ackMessageProcessedSuccessfully(ctx, msg)),
      E.tapError(() => nackMessageProcessFailure(ctx, msg)),
      E.match({
        onSuccess: () =>
          ctx.log.debug("Message consume success: %O", {
            exchange,
            queue,
            key,
            consumeTag: msg.fields.consumerTag,
          }),
        onFailure: (error) =>
          ctx.log.error("Message consume failed: %O", {
            exchange,
            queue,
            key,
            consumerTag: msg.fields.consumerTag,
            error,
          }),
      }),
      E.runPromise,
    );
}

export class AmqpPublishMessageError extends Data.TaggedError(
  "RmqPublishMessageError",
)<{
  exchange: string;
  key: string;
}> {}

// There is a 1-1 mapping between queues and keys, if that changes this approach will need to be restructured
export async function assertMqObjects(channel: amqp.Channel): Promise<void> {
  // Assert topic exchange and queue to reroute failed messages and avoid processing loops
  await channel.assertExchange(ExchangeName.DeadLetter, "topic", {
    durable: true,
  });
  await channel.assertQueue(QueueName.deadLetter, {
    durable: true,
  }); // no properties
  await channel.bindQueue(QueueName.deadLetter, ExchangeName.DeadLetter, "#");

  // Exchanges for commands and events
  await channel.assertExchange(ExchangeName.Commands, "direct", {
    durable: true,
  });
  await channel.assertExchange(ExchangeName.Events, "topic", { durable: true });

  // Assert queues
  const queuePromises = [
    QueueName.nilDbCommandStoreSecret,
    QueueName.nilCommEventSecretStored,
    QueueName.nilDbCommandStartQueryExecution,
    QueueName.nilCommEventQueryExecutionCompleted,
  ].map((name) => channel.assertQueue(name, defaultQueueOptions));
  await Promise.all(queuePromises);

  // Register routing keys with queue
  await channel.bindQueue(
    QueueName.nilDbCommandStoreSecret,
    ExchangeName.Commands,
    RoutingKey.commandDappStoreSecret,
  );
  await channel.bindQueue(
    QueueName.nilDbCommandStartQueryExecution,
    ExchangeName.Commands,
    RoutingKey.commandDappStartQueryExecution,
  );

  // Limit concurrent messages
  await channel.prefetch(10);
}
