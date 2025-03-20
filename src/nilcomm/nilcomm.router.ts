import type { App } from "#/app";
import { assertMqObjects } from "#/common/amqp";
import type { AppBindings, AppBindingsWithNilcomm } from "#/env";
import * as NilCommControllers from "#/nilcomm/nilcomm.controllers";
import * as NilcommServices from "./nilcomm.service";

export async function buildNilCommRouter(
  _app: App,
  bindings: AppBindings,
): Promise<void> {
  if (!bindings.mq) {
    throw new Error("Message queue is not initialised");
  }

  const ctx = bindings as AppBindingsWithNilcomm;
  const { log } = bindings;

  await NilcommServices.ensureNilcommAccount(ctx);
  await assertMqObjects(ctx.mq.channel);

  await NilCommControllers.consumeDappCommandStoreSecret(ctx);
  await NilCommControllers.consumeDappCommandStartQueryExecution(ctx);

  log.info("Nilcomm message queues established");
}
