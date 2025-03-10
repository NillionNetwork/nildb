import type * as amqp from "amqplib";
import { ExchangeName, QueueName } from "#/common/amqp";

export async function teardownMqObjects(channel: amqp.Channel): Promise<void> {
  const queues = [
    QueueName.nilDbCommandStoreSecret,
    QueueName.nilCommEventSecretStored,
    QueueName.nilDbCommandStartQueryExecution,
    QueueName.nilCommEventQueryExecutionCompleted,
    QueueName.deadLetter,
  ];

  await Promise.all(
    queues.map(async (queue) => {
      await channel.purgeQueue(queue);
      await channel.deleteQueue(queue);
    }),
  );

  await channel.deleteExchange(ExchangeName.DeadLetter);
  await channel.deleteExchange(ExchangeName.Commands);
  await channel.deleteExchange(ExchangeName.Events);
}
