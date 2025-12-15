import type { BuilderDocument } from "@nildb/builders/builders.types";
import { createLogger } from "@nildb/common/logger";
import { Cache } from "@nillion/nildb-shared";
import { LogLevel } from "@nillion/nildb-types";
import { type Did, type Envelope, Signer } from "@nillion/nuc";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import type { LoggerProvider } from "@opentelemetry/sdk-logs";
import type { Db, MongoClient } from "mongodb";
import type { Logger } from "pino";
import { z } from "zod";
import { initAndCreateDbClients } from "./common/mongo.js";
import type { UserDocument } from "./users/users.types.js";

export const PRIVATE_KEY_LENGTH = 64;
export const PUBLIC_KEY_LENGTH = 66;

export type NilauthInstance = {
  publicKey: string;
  baseUrl: string;
};

export const FeatureFlag = {
  OPENAPI: "openapi",
  METRICS: "metrics",
  MIGRATIONS: "migrations",
  OTEL: "otel",
} as const;

export type FeatureFlag = (typeof FeatureFlag)[keyof typeof FeatureFlag];

export type AppEnv = {
  Bindings: AppBindings;
  Variables: AppVariables;
};

const NilauthInstancesSchema = z
  .string()
  .transform((value): NilauthInstance[] => {
    return value.split(",").map((entry) => {
      const trimmed = entry.trim();
      const lastSlashIndex = trimmed.lastIndexOf("/");
      if (lastSlashIndex === -1) {
        throw new Error(
          `Invalid nilauth instance format: "${trimmed}". Expected "baseUrl/publicKey"`,
        );
      }
      const baseUrl = trimmed.slice(0, lastSlashIndex);
      const publicKey = trimmed.slice(lastSlashIndex + 1);
      if (!publicKey || !baseUrl) {
        throw new Error(
          `Invalid nilauth instance format: "${trimmed}". Expected "baseUrl/publicKey"`,
        );
      }
      if (publicKey.length !== PUBLIC_KEY_LENGTH) {
        throw new Error(
          `Invalid nilauth public key length: ${publicKey.length}. Expected ${PUBLIC_KEY_LENGTH}`,
        );
      }
      return { publicKey, baseUrl };
    });
  })
  .refine((instances) => instances.length > 0, {
    message: "At least one nilauth instance is required",
  });

export const EnvVarsSchema = z.object({
  dbNamePrimary: z.string().min(4),
  dbNameData: z.string().min(4),
  dbUri: z.string().startsWith("mongodb"),
  enabledFeatures: z
    .string()
    .transform((d) => d.split(",").map((e) => e.trim())),
  logLevel: LogLevel,
  nilauthInstances: NilauthInstancesSchema,
  nodeSecretKey: z.string().length(PRIVATE_KEY_LENGTH),
  nodePublicEndpoint: z.url(),
  metricsPort: z.coerce.number().int().positive(),
  otelEndpoint: z.string().url().optional().default("http://localhost"),
  otelServiceName: z.string().min(1).optional().default("nildb"),
  otelTeamName: z.string().min(1).optional().default("nildb"),
  otelDeploymentEnv: z.string().min(1).optional().default("local"),
  otelMetricsExportIntervalMs: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .default(60000),
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
    .default(1000),
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
  migrationsComplete: boolean;
};

// Use interface merging to define expected app vars
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      APP_DB_NAME_BASE: string;
      APP_DB_URI: string;
      APP_ENABLED_FEATURES: string;
      APP_LOG_LEVEL: string;
      APP_NILAUTH_INSTANCES: string;
      APP_METRICS_PORT?: number;
      APP_NODE_SECRET_KEY: string;
      APP_NODE_PUBLIC_ENDPOINT: string;
      APP_PORT: number;
      APP_RATE_LIMIT_ENABLED?: string;
      APP_RATE_LIMIT_WINDOW_SECONDS?: string;
      APP_RATE_LIMIT_MAX_REQUESTS?: string;
      OTEL_ENDPOINT?: string;
      OTEL_SERVICE_NAME?: string;
      OTEL_TEAM_NAME?: string;
      OTEL_DEPLOYMENT_ENV?: string;
      OTEL_METRICS_EXPORT_INTERVAL_MS?: string;
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
  loggerProvider?: LoggerProvider,
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
    log: createLogger(config.logLevel, loggerProvider),
    node: {
      signer,
      did,
      publicKey,
      endpoint: config.nodePublicEndpoint,
    },
    migrationsComplete: false,
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
    nilauthInstances: process.env.APP_NILAUTH_INSTANCES,
    nodePublicEndpoint: process.env.APP_NODE_PUBLIC_ENDPOINT,
    nodeSecretKey: process.env.APP_NODE_SECRET_KEY,
    otelEndpoint: process.env.OTEL_ENDPOINT,
    otelServiceName: process.env.OTEL_SERVICE_NAME,
    otelTeamName: process.env.OTEL_TEAM_NAME,
    otelDeploymentEnv: process.env.OTEL_DEPLOYMENT_ENV,
    otelMetricsExportIntervalMs: process.env.OTEL_METRICS_EXPORT_INTERVAL_MS,
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
