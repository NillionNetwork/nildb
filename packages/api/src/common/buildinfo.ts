import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type BuildInfo = {
  time: string;
  commit: string;
};

function loadBuildInfo(): BuildInfo {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const buildInfoPath = path.join(__dirname, "../../../buildinfo.json");
    const content = fs.readFileSync(buildInfoPath, "utf-8");
    return JSON.parse(content) as BuildInfo;
  } catch {
    return {
      time: "1970-01-01T00:00:00Z",
      commit: "dev",
    };
  }
}

const buildInfo = loadBuildInfo();

export const BUILD_COMMIT = buildInfo.commit;
export const BUILD_TIME = buildInfo.time;
