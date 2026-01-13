import fs from "node:fs";

type BuildInfo = {
  time: string;
  commit: string;
};

function loadBuildInfo(): BuildInfo {
  try {
    const content = fs.readFileSync("buildinfo.json", "utf-8");
    return JSON.parse(content) as BuildInfo;
  } catch {
    // No buildinfo.json found - assume dev mode
    return {
      time: "1970-01-01T00:00:00Z",
      commit: "unknown",
    };
  }
}

const buildInfo = loadBuildInfo();

export const BUILD_COMMIT = buildInfo.commit;
export const BUILD_TIME = buildInfo.time;
