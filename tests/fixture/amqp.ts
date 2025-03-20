import type * as amqp from "amqplib";
import { ExchangeName, QueueName, RoutingKey } from "#/common/amqp";

export async function purgeQueues(channel: amqp.Channel): Promise<void> {
  const queues = [
    QueueName.nilDbCommandStoreSecret,
    QueueName.nilCommEventSecretStored,
    QueueName.nilDbCommandStartQueryExecution,
    QueueName.nilCommEventQueryExecutionCompleted,
    QueueName.deadLetter,
  ];

  await Promise.all(
    queues.map(async (queue) => {
      // forces nack'd messages into ready state so they can be purged
      await channel.recover();
      await channel.purgeQueue(queue);
    }),
  );
}

export async function bindQueues(channel: amqp.Channel): Promise<void> {
  await channel.bindQueue(
    QueueName.nilCommEventSecretStored,
    ExchangeName.Events,
    RoutingKey.eventDappSecretStored,
  );

  await channel.bindQueue(
    QueueName.nilCommEventQueryExecutionCompleted,
    ExchangeName.Events,
    RoutingKey.eventDappQueryExecutionCompleted,
  );
}
