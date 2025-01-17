import type { Db, MongoClient } from "mongodb";
import type { Logger } from "pino";
import { z } from "zod";
import type { AccountDocument, RootAccountDocument } from "#/admin/repository";
import { Cache } from "#/common/cache";
import { Identity } from "#/common/identity";
import type { NilDid } from "#/common/nil-did";
import { createLogger } from "#/middleware/logger";
import { initAndCreateDbClients } from "./common/mongo";

export const PRIVATE_KEY_LENGTH = 64;
export const PUBLIC_KEY_LENGTH = 66;

const ConfigSchema = z.object({
  dbNamePrimary: z.string().min(4),
  dbNameData: z.string().min(4),
  dbUri: z.string().startsWith("mongodb"),
  env: z.enum(["testnet", "mainnet"]),
  logLevel: z.enum(["debug", "info", "warn", "error"]),
  nodeSecretKey: z.string().min(PRIVATE_KEY_LENGTH),
  nodePublicEndpoint: z.string().url(),
  rootAccountSecretKey: z.string().min(PRIVATE_KEY_LENGTH),
  metricsPort: z.number().int().positive(),
  webPort: z.number().int().positive(),
});
export type Config = z.infer<typeof ConfigSchema>;

export interface Context {
  config: Config;
  db: {
    client: MongoClient;
    primary: Db;
    data: Db;
  };
  cache: {
    accounts: Cache<NilDid, AccountDocument>;
  };
  log: Logger;
  node: {
    endpoint: string;
    identity: Identity;
  };
}

export async function createContext(): Promise<Context> {
  const config = ConfigSchema.parse({
    dbNamePrimary: process.env.APP_DB_NAME_PRIMARY,
    dbNameData: process.env.APP_DB_NAME_DATA,
    dbUri: process.env.APP_DB_URI,
    env: process.env.APP_ENV,
    logLevel: process.env.APP_LOG_LEVEL,
    nodeSecretKey: process.env.APP_NODE_SECRET_KEY,
    nodePublicEndpoint: process.env.APP_NODE_PUBLIC_ENDPOINT,
    rootAccountSecretKey: process.env.APP_ROOT_USER_SECRET_KEY,
    metricsPort: Number(process.env.APP_METRICS_PORT),
    webPort: Number(process.env.APP_PORT),
  });

  const node = {
    identity: Identity.fromSk(config.nodeSecretKey),
    root: Identity.fromSk(config.rootAccountSecretKey),
    endpoint: config.nodePublicEndpoint,
  };

  // Hydrate with non-expiring root account
  const accounts = new Cache<NilDid, AccountDocument>();
  const rootDocument: RootAccountDocument = {
    _id: node.root.did,
    _type: "root",
    publicKey: node.root.pk,
  };
  accounts.set(node.root.did, rootDocument, Number.MAX_SAFE_INTEGER);

  return {
    config,
    cache: {
      accounts,
    },
    db: await initAndCreateDbClients(config),
    log: createLogger(config),
    node,
  };
}
