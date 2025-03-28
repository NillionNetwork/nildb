import dockerCompose from "docker-compose";
import type { TestProject } from "vitest/node";

const MAX_RETRIES = 300;
const composeOptions = {
  cwd: "./docker",
  composeOptions: [["--project-name", "nildb-tests"]],
};

export async function setup(_project: TestProject) {
  console.log("🚀 Starting containers...");

  try {
    // Check if containers are already running
    const psResult = await dockerCompose.ps(composeOptions);
    const allServicesUp =
      psResult.data.services?.length > 0 &&
      psResult.data.services.every((service) => service.state?.includes("Up"));

    if (allServicesUp) {
      console.log("✅ Containers already running, skipping startup.");
      return;
    }

    await dockerCompose.upAll(composeOptions);
    let retry = 0;
    for (; retry < MAX_RETRIES; retry++) {
      const result = await dockerCompose.ps(composeOptions);
      if (
        result.data.services.every((service) => service.state.includes("Up"))
      ) {
        break;
      }
      await new Promise((f) => setTimeout(f, 200));
    }
    if (retry >= MAX_RETRIES) {
      console.error("❌ Error starting containers: timeout");
      process.exit(1);
    }
    // We need sleep 1 sec to be sure that the AboutResponse.started is at least 1 sec earlier than the tests start.
    await new Promise((f) => setTimeout(f, 2000));
    console.log("✅ Containers started successfully.");
  } catch (error) {
    console.error("❌ Error starting containers: ", error);
    process.exit(1);
  }
}

export async function teardown(_project: TestProject) {
  // Skip teardown if KEEP_INFRA environment variable is set
  if (process.env.KEEP_INFRA === "true") {
    console.log("🔄 Keeping infrastructure running as KEEP_INFRA=true");
    return;
  }

  console.log("🛑 Removing containers...");
  try {
    await dockerCompose.downAll(composeOptions);
    console.log("✅ Containers removed successfully.");
  } catch (error) {
    console.error("❌ Error removing containers: ", error);
    process.exit(1);
  }
}
