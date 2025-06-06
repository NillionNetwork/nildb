import { Keypair, type NucTokenEnvelope } from "@nillion/nuc";
import * as amqp from "amqplib";
import type { Db, MongoClient } from "mongodb";
import type { Logger } from "pino";
import { z } from "zod";
import type { BuilderDocument } from "#/builders/builders.types";
import { Cache } from "#/common/cache";
import { createLogger, LogLevel } from "#/common/logger";
import type { Did } from "#/common/types";
import { initAndCreateDbClients } from "./common/mongo";
import type { UserDocument } from "./user/user.types";

export const PRIVATE_KEY_LENGTH = 64;
export const PUBLIC_KEY_LENGTH = 66;

export const FeatureFlag = {
  OPENAPI_SPEC: "openapi",
  PROMETHEUS_METRICS: "metrics",
  MIGRATIONS: "migrations",
  NILCOMM: "nilcomm",
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
  nilauthBaseUrl: z.string().url(),
  nilauthPubKey: z.string().length(PUBLIC_KEY_LENGTH),
  nilcommPublicKey: z.string().length(PUBLIC_KEY_LENGTH).optional(),
  nodeSecretKey: z.string().length(PRIVATE_KEY_LENGTH),
  nodePublicEndpoint: z.string().url(),
  metricsPort: z.number().int().positive(),
  mqUri: z.string().optional(),
  webPort: z.number().int().positive(),
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
    builders: Cache<Did, BuilderDocument>;
  };
  log: Logger;
  mq?: {
    channelModel: amqp.ChannelModel;
    channel: amqp.Channel;
  };
  node: {
    endpoint: string;
    keypair: Keypair;
  };
};

/**
 * Use this variant when the nilcomm feature is enabled
 */
export type AppBindingsWithNilcomm = Omit<AppBindings, "mq" | "config"> & {
  config: Required<AppBindings["config"]>;
  mq: {
    channelModel: amqp.ChannelModel;
    channel: amqp.Channel;
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
      APP_NILCHAIN_JSON_RPC: string;
      APP_NILCOMM_PUBLIC_KEY?: string;
      APP_METRICS_PORT?: number;
      APP_MQ_URI?: string;
      APP_NODE_SECRET_KEY: string;
      APP_NODE_PUBLIC_ENDPOINT: string;
      APP_PORT: number;
    }
  }
}

// There are some roots where the JWT won't be present and so this type isn't correct (e.g. registration,
// health, about). However, narrowing the type here to avoid use in those edge cases would cascade to
// the majority of routes, which require auth. So the risk is accepted here to avoid the type complexity cascade.
export type AppVariables = {
  envelope: NucTokenEnvelope;
  builder: BuilderDocument;
  user: UserDocument;
};

export async function loadBindings(
  overrides: Partial<EnvVars> = {},
): Promise<AppBindings> {
  const config = parseConfigFromEnv(overrides);

  let mq: AppBindingsWithNilcomm["mq"] | undefined;
  if (hasFeatureFlag(config.enabledFeatures, FeatureFlag.NILCOMM)) {
    if (!config.mqUri) {
      throw new TypeError(
        `The env var "APP_MQ_URI" is required when "${FeatureFlag.NILCOMM}" feature is enabled`,
      );
    }
    const channelModel = await amqp.connect(config.mqUri);
    const channel = await channelModel.createChannel();
    mq = {
      channelModel,
      channel,
    };
  }

  return {
    config,
    cache: {
      builders: new Cache<Did, BuilderDocument>(),
    },
    db: await initAndCreateDbClients(config),
    log: createLogger(config.logLevel),
    mq,
    node: {
      keypair: Keypair.from(config.nodeSecretKey),
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
    metricsPort: Number(process.env.APP_METRICS_PORT),
    mqUri: process.env.APP_MQ_URI,
    nilauthBaseUrl: process.env.APP_NILAUTH_BASE_URL,
    nilauthPubKey: process.env.APP_NILAUTH_PUBLIC_KEY,
    nilcommPublicKey: process.env.APP_NILCOMM_PUBLIC_KEY,
    nodePublicEndpoint: process.env.APP_NODE_PUBLIC_ENDPOINT,
    nodeSecretKey: process.env.APP_NODE_SECRET_KEY,
    webPort: Number(process.env.APP_PORT),
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
