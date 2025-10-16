import { type Did, type Envelope, Signer } from "@nillion/nuc";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import type { Db, MongoClient } from "mongodb";
import type { Logger } from "pino";
import { z } from "zod";
import type { BuilderDocument } from "#/builders/builders.types";
import { Cache } from "#/common/cache";
import { createLogger, LogLevel } from "#/common/logger";
import { initAndCreateDbClients } from "./common/mongo";
import type { UserDocument } from "./users/users.types";

export const PRIVATE_KEY_LENGTH = 64;
export const PUBLIC_KEY_LENGTH = 66;

export const FeatureFlag = {
  OPENAPI: "openapi",
  METRICS: "metrics",
  MIGRATIONS: "migrations",
} as const;

export type FeatureFlag = (typeof FeatureFlag)[keyof typeof FeatureFlag];

export type AppEnv = {
  Bindings: AppBindings;
  Variables: AppVariables;
};

export const EnvVarsSchema = z.object({
  dbNamePrimary: z.string().min(4),
  dbNameData: z.string().min(4),
  dbUri: z.string().startsWith("mongodb"),
  enabledFeatures: z
    .string()
    .transform((d) => d.split(",").map((e) => e.trim())),
  logLevel: LogLevel,
  nilauthBaseUrl: z.url(),
  nilauthPubKey: z.string().length(PUBLIC_KEY_LENGTH),
  nodeSecretKey: z.string().length(PRIVATE_KEY_LENGTH),
  nodePublicEndpoint: z.url(),
  metricsPort: z.coerce.number().int().positive(),
  rateLimitEnabled: z.preprocess((val) => {
    if (val === "true" || val === "1") return true;
    if (val === "false" || val === "0") return false;
    return val;
  }, z.boolean().optional().default(true)),
  rateLimitWindowSeconds: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .default(60),
  rateLimitMaxRequests: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .default(60),
  webPort: z.coerce.number().int().positive(),
});
export type EnvVars = z.infer<typeof EnvVarsSchema>;

export type AppBindings = {
  config: EnvVars;
  db: {
    client: MongoClient;
    primary: Db;
    data: Db;
  };
  cache: {
    builders: Cache<string, BuilderDocument>;
  };
  log: Logger;
  node: {
    endpoint: string;
    signer: Signer;
    did: Did;
    publicKey: string;
  };
};

// Use interface merging to define expected app vars
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      APP_DB_NAME_BASE: string;
      APP_DB_URI: string;
      APP_ENABLED_FEATURES: string;
      APP_LOG_LEVEL: string;
      APP_NILAUTH_PUBLIC_KEY: string;
      APP_NILAUTH_BASE_URL: string;
      APP_METRICS_PORT?: number;
      APP_NODE_SECRET_KEY: string;
      APP_NODE_PUBLIC_ENDPOINT: string;
      APP_PORT: number;
      APP_RATE_LIMIT_ENABLED?: string;
      APP_RATE_LIMIT_WINDOW_SECONDS?: string;
      APP_RATE_LIMIT_MAX_REQUESTS?: string;
    }
  }
}

// There are some roots where the JWT won't be present and so this type isn't correct (e.g. registration,
// health, about). However, narrowing the type here to avoid use in those edge cases would cascade to
// the majority of routes, which require auth. So the risk is accepted here to avoid the type complexity cascade.
export type AppVariables = {
  envelope: Envelope;
  builder: BuilderDocument;
  user: UserDocument;
};

export async function loadBindings(
  overrides: Partial<EnvVars> = {},
): Promise<AppBindings> {
  const config = parseConfigFromEnv(overrides);
  const privateKeyBytes = hexToBytes(config.nodeSecretKey);
  const publicKey = bytesToHex(secp256k1.getPublicKey(privateKeyBytes));
  const signer = Signer.fromPrivateKey(config.nodeSecretKey);
  const did = await signer.getDid();

  return {
    config,
    cache: {
      builders: new Cache<string, BuilderDocument>(),
    },
    db: await initAndCreateDbClients(config),
    log: createLogger(config.logLevel),
    node: {
      signer,
      did,
      publicKey,
      endpoint: config.nodePublicEndpoint,
    },
  };
}

export function parseConfigFromEnv(overrides: Partial<EnvVars>): EnvVars {
  const config = EnvVarsSchema.parse({
    dbNameData: `${process.env.APP_DB_NAME_BASE}_data`,
    dbNamePrimary: process.env.APP_DB_NAME_BASE,
    dbUri: process.env.APP_DB_URI,
    enabledFeatures: process.env.APP_ENABLED_FEATURES,
    logLevel: process.env.APP_LOG_LEVEL,
    metricsPort: process.env.APP_METRICS_PORT,
    nilauthBaseUrl: process.env.APP_NILAUTH_BASE_URL,
    nilauthPubKey: process.env.APP_NILAUTH_PUBLIC_KEY,
    nodePublicEndpoint: process.env.APP_NODE_PUBLIC_ENDPOINT,
    nodeSecretKey: process.env.APP_NODE_SECRET_KEY,
    rateLimitEnabled: process.env.APP_RATE_LIMIT_ENABLED,
    rateLimitWindowSeconds: process.env.APP_RATE_LIMIT_WINDOW_SECONDS,
    rateLimitMaxRequests: process.env.APP_RATE_LIMIT_MAX_REQUESTS,
    webPort: process.env.APP_PORT,
  });

  return {
    ...config,
    ...overrides,
  };
}

export function hasFeatureFlag(
  enabledFeatures: string[],
  flag: FeatureFlag,
): boolean {
  return enabledFeatures.includes(flag);
}
