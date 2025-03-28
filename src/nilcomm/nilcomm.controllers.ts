import { Effect as E, pipe } from "effect";
import {
  ExchangeName,
  QueueName,
  RoutingKey,
  defaultConsumeOptions,
  parseAmqpMessage,
  runMessageConsume,
} from "#/common/amqp";
import type { AppBindingsWithNilcomm } from "#/env";
import {
  type DappCommandStartQueryExecution,
  DappCommandStartQueryExecutionSchema,
  type DappCommandStoreSecret,
  DappCommandStoreSecretSchema,
} from "#/nilcomm/nilcomm.types";
import * as NilCommService from "./nilcomm.service";

export async function consumeDappCommandStoreSecret(
  ctx: AppBindingsWithNilcomm,
): Promise<void> {
  const {
    log,
    mq: { channel },
  } = ctx;

  const exchange = ExchangeName.Commands;
  const queue = QueueName.nilDbCommandStoreSecret;
  const key = RoutingKey.commandDappStoreSecret;

  const result = await channel.consume(
    queue,
    (msg) => {
      if (msg === null) {
        log.error(
          `Amqp message is null: exchange=${exchange}, queue=${queue}, key=${key}`,
        );
        return;
      }

      return pipe(
        parseAmqpMessage<DappCommandStoreSecret>(
          msg,
          DappCommandStoreSecretSchema,
        ),
        E.flatMap((body) => NilCommService.processDappStoreSecret(ctx, body)),
        runMessageConsume(ctx, msg, exchange, queue, key),
      );
    },
    defaultConsumeOptions,
  );

  log.info(
    `Consuming exchange=${exchange}, queue=${queue}, key=${key} ,tag=${result.consumerTag}`,
  );
}

export async function consumeDappCommandStartQueryExecution(
  ctx: AppBindingsWithNilcomm,
): Promise<void> {
  const {
    log,
    mq: { channel },
  } = ctx;

  const exchange = ExchangeName.Commands;
  const queue = QueueName.nilDbCommandStartQueryExecution;
  const key = RoutingKey.commandDappStartQueryExecution;

  const result = await channel.consume(
    queue,
    (msg) => {
      if (msg === null) {
        log.error(
          `Amqp message is null: exchange=${exchange}, queue=${queue}, key=${key}`,
        );
        return;
      }

      return pipe(
        parseAmqpMessage<DappCommandStartQueryExecution>(
          msg,
          DappCommandStartQueryExecutionSchema,
        ),
        E.flatMap((body) =>
          NilCommService.processDappStartQueryExecution(ctx, body),
        ),
        runMessageConsume(ctx, msg, exchange, queue, key),
      );
    },
    defaultConsumeOptions,
  );

  log.info(
    `Consuming exchange=${exchange}, queue=${queue}, key=${key} ,tag=${result.consumerTag}`,
  );
}
