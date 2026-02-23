#!/usr/bin/env tsx

import { appendFileSync } from "node:fs";

import semver from "semver";

import packageJson from "../packages/nilpay-client/package.json";

interface NpmRegistryResponse {
  "dist-tags": Record<string, string>;
}

async function getNpmVersion(packageName: string, distTag: string): Promise<string> {
  const response = await fetch(`https://registry.npmjs.org/${packageName}`);
  if (response.ok) {
    const data = (await response.json()) as NpmRegistryResponse;
    return data["dist-tags"][distTag] || "0.0.0";
  }
  return "0.0.0";
}

function writeGitHubOutput(key: string, value: string): void {
  const githubOutput = process.env.GITHUB_OUTPUT;
  if (githubOutput) {
    appendFileSync(githubOutput, `${key}=${value}\n`);
  }
  console.log(`${key}=${value}`);
}

async function main(): Promise<void> {
  if (!semver.valid(packageJson.version)) {
    throw new Error(`Invalid version format: ${packageJson.version}`);
  }

  const distTag = semver.prerelease(packageJson.version) ? "next" : "latest";
  const localVersion = packageJson.version;
  const publicVersion = await getNpmVersion(packageJson.name, distTag);
  const localVersionIsHigher = semver.gt(localVersion, publicVersion);

  writeGitHubOutput("local_version_is_higher", localVersionIsHigher.toString());
  writeGitHubOutput("local_version", localVersion);
  writeGitHubOutput("published_version", publicVersion);
  writeGitHubOutput("tag", distTag);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
