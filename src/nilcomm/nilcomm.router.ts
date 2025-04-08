import { assertMqObjects } from "#/common/amqp";
import type { AppBindingsWithNilcomm } from "#/env";
import * as NilCommControllers from "#/nilcomm/nilcomm.controllers";
import * as NilcommServices from "./nilcomm.service";
import type { ControllerOptions } from "#/common/types";

export async function buildNilCommRouter(
  options: ControllerOptions,
): Promise<void> {
  const { bindings } = options;

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
