import { assertMqObjects } from "#/common/amqp";
import type { ControllerOptions } from "#/common/types";
import {
  type AppBindingsWithNilcomm,
  FeatureFlag,
  hasFeatureFlag,
} from "#/env";
import * as NilCommControllers from "#/nilcomm/nilcomm.controllers";
import * as NilcommServices from "./nilcomm.service";

export async function buildNilCommRouter(
  options: ControllerOptions,
): Promise<void> {
  const { bindings } = options;
  const { log } = bindings;

  const enabled = hasFeatureFlag(
    bindings.config.enabledFeatures,
    FeatureFlag.NILCOMM,
  );

  if (!enabled) {
    log.info("The openapi feature is disabled");
    return;
  }

  if (!bindings.mq) {
    throw new Error("Message queue is not initialised");
  }

  const ctx = bindings as AppBindingsWithNilcomm;

  await NilcommServices.ensureNilcommAccount(ctx);
  await assertMqObjects(ctx.mq.channel);

  await NilCommControllers.consumeDappCommandStoreSecret(ctx);
  await NilCommControllers.consumeDappCommandStartQueryExecution(ctx);

  log.info("Nilcomm message queues established");
}
