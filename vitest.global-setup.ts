import * as pino from "pino";
import { DockerComposeEnvironment, type StartedDockerComposeEnvironment } from "testcontainers";
import type { TestProject } from "vitest/node";

let environment: StartedDockerComposeEnvironment | undefined;

const log = pino.pino({
  transport: {
    target: "pino-pretty",
    options: {
      sync: true,
      singleLine: true,
      messageFormat: "globalSetup - {msg}",
    },
  },
});

export async function setup(_project: TestProject): Promise<void> {
  log.info("🚀 Starting containers...");

  try {
    environment = await new DockerComposeEnvironment("./packages/api/tests/docker", "docker-compose.yml").up();

    log.info("✅ Containers started successfully.");
  } catch (error) {
    log.error({ error }, "❌ Error starting containers");
    throw error;
  }
}

export async function teardown(_project: TestProject): Promise<void> {
  if (process.env.KEEP_INFRA === "true") {
    log.info("🔄 Keeping infrastructure running (KEEP_INFRA=true)");
    return;
  }

  if (!environment) {
    return;
  }

  log.info("🛑 Stopping containers...");
  try {
    await environment.down();
    log.info("✅ Containers stopped successfully.");
  } catch (error) {
    log.error({ error }, "❌ Error stopping containers");
  }
}
