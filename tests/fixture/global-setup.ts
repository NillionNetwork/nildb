import dockerCompose from "docker-compose";

const MAX_RETRIES = 300;

export async function setup() {
  console.log("🚀 Starting containers...");
  try {
    await dockerCompose.upAll({ cwd: "./docker" });
    let retry = 0;
    for (; retry < MAX_RETRIES; retry++) {
      const result = await dockerCompose.ps({ cwd: "./docker" });
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

export async function teardown() {
  console.log("🛑 Removing containers...");
  try {
    await dockerCompose.downAll({ cwd: "./docker" });
    console.log("✅ Containers removed successfully.");
  } catch (error) {
    console.error("❌ Error removing containers: ", error);
    process.exit(1);
  }
}
