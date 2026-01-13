import fs from "node:fs";

import { BuildInfo } from "@nildb/system/system.types";

function loadBuildInfo(): BuildInfo {
  try {
    const content = fs.readFileSync("buildinfo.json", "utf-8");
    return JSON.parse(content) as BuildInfo;
  } catch {
    // No buildinfo.json found - assume dev mode
    return {
      time: "1970-01-01T00:00:00Z",
      commit: "unknown",
      version: "0.0.0",
    };
  }
}

const buildInfo = loadBuildInfo();

export const BUILD_COMMIT = buildInfo.commit;
export const BUILD_TIME = buildInfo.time;
export const BUILD_VERSION = buildInfo.version ?? "0.0.0";
