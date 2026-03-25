/** biome-ignore-all lint/nursery/noImportCycles: this a cycle wrt fixture and response handler */
import { faker } from "@faker-js/faker";
import { type App, buildApp } from "@nildb/app";
import type { BuilderDocument } from "@nildb/builders/builders.types";
import type { CollectionType } from "@nildb/collections/collections.types";
import { mongoMigrateUp } from "@nildb/common/mongo";
import { CollectionName } from "@nildb/common/mongo";
import { type AppBindings, FeatureFlag, hasFeatureFlag, loadBindings } from "@nildb/env";
import type { QueryVariable } from "@nildb/queries/queries.types";
// oxlint-disable-next-line import/extensions
import { secp256k1 } from "@noble/curves/secp256k1.js";
// oxlint-disable-next-line import/extensions
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import dotenv from "dotenv";
import { ObjectId } from "mongodb";
import type { Logger } from "pino";
import type { JsonObject } from "type-fest";
import { getAddress } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

import { AdminClient, BuilderClient, UserClient } from "@nillion/nildb-client";
import { createUuidDto, NucCmd, type UuidDto } from "@nillion/nildb-types";
import { Builder, Did, type Did as NucDid, Signer } from "@nillion/nuc";

import { createTestLogger } from "./logger";

export type FixtureContext = {
  id: string;
  log: Logger;
  app: App;
  bindings: AppBindings & {
    node: {
      signer: Signer;
      did: NucDid;
      publicKey: string;
      endpoint: string;
    };
  };
  system: AdminClient;
  builder: BuilderClient;
  builderSigner: Signer;
  builderDid: string;
  /** Create a self-signed NUC invocation token for the builder */
  createToken: (command?: string) => Promise<string>;
  admin: {
    signer: Signer;
    did: string;
    /** Create a self-signed NUC invocation token for the admin */
    createToken: (command?: string) => Promise<string>;
  };
  user: UserClient;
  userSigner: Signer;
};

export type CollectionFixture = {
  id: UuidDto;
  type: CollectionType;
  name: string;
  keys: string[];
  schema: JsonObject;
};

export type QueryFixture = {
  id: UuidDto;
  name: string;
  collection: UuidDto;
  variables: Record<string, QueryVariable>;
  pipeline: JsonObject[];
};

/**
 * Insert a builder directly into the database with creditsUsd set.
 * Returns the signer, DID, and the inserted document.
 */
export async function insertTestBuilder(
  bindings: AppBindings,
  name?: string,
): Promise<{ signer: Signer; did: string }> {
  const signer = Signer.fromPrivateKey(bytesToHex(secp256k1.utils.randomSecretKey()));
  const did = Did.serialize(await signer.getDid());

  const now = new Date();
  const doc: BuilderDocument = {
    _id: new ObjectId(),
    did,
    _created: now,
    _updated: now,
    name: name ?? faker.person.fullName(),
    collections: [],
    queries: [],
    creditsUsd: 0,
    storageBytes: 0,
  };

  await bindings.db.primary.collection<BuilderDocument>(CollectionName.Builders).insertOne(doc);
  return { signer, did };
}

export async function buildFixture(
  opts: {
    collection?: CollectionFixture;
    query?: QueryFixture;
    keepDbs?: boolean;
    extraFeatures?: string[];
  } = {},
): Promise<FixtureContext> {
  dotenv.config({
    path: ["./packages/api/env.test"],
  });
  const id = new Date().toISOString().replaceAll(":", "").replaceAll(".", "_");
  const log = createTestLogger(id);

  // Use unique db names for each test
  process.env.APP_DB_NAME_BASE = `${process.env.APP_DB_NAME_BASE}_${id}`;

  const features = ["openapi", "migrations", "credits", ...(opts.extraFeatures ?? [])];
  process.env.APP_ENABLED_FEATURES = features.join(",");

  // Generate admin Ethereum account and set env var before loadBindings()
  // so that bindings.admin gets populated with the did:ethr: identity
  const adminEthPrivateKey = generatePrivateKey();
  const adminEthAccount = privateKeyToAccount(adminEthPrivateKey);
  process.env.APP_ADMIN_ADDRESS = getAddress(adminEthAccount.address);

  log.info(`Enabled features: ${process.env.APP_ENABLED_FEATURES}`);

  const bindings = await loadBindings();

  if (hasFeatureFlag(bindings.config.enabledFeatures, FeatureFlag.MIGRATIONS)) {
    await mongoMigrateUp(bindings.config.dbUri, bindings.config.dbNamePrimary);
    bindings.migrationsComplete = true;
    log.info("Ran db migrations");
  } else {
    bindings.migrationsComplete = true;
  }

  log.info("Bootstrapping test fixture");

  const { app } = await buildApp(bindings);

  const nodePrivateKeyBytes = hexToBytes(bindings.config.nodeSecretKey);
  const nodePublicKey = bytesToHex(secp256k1.getPublicKey(nodePrivateKeyBytes));
  const nodeSigner = Signer.fromPrivateKey(nodePrivateKeyBytes);
  const nodeDid = await nodeSigner.getDid();

  const node = {
    signer: nodeSigner,
    did: nodeDid,
    publicKey: nodePublicKey,
    endpoint: bindings.config.nodePublicEndpoint,
  };

  // Create system client (admin delegation from node)
  const systemPrivateKey = bytesToHex(secp256k1.utils.randomSecretKey());
  const systemSigner = Signer.fromPrivateKey(systemPrivateKey);
  const systemDid = await systemSigner.getDid();
  const nodeDelegation = await Builder.delegation()
    .subject(systemDid)
    .command(NucCmd.nil.db.root)
    .audience(systemDid)
    .expiresIn(1000 * 60 * 5)
    .sign(node.signer);
  const system = new AdminClient({
    baseUrl: bindings.config.nodePublicEndpoint,
    signer: systemSigner,
    nodePublicKey: node.publicKey,
    nodeDelegation,
    httpClient: app.request,
  });

  // Create builder by inserting directly into DB with creditsUsd
  const { signer: builderSigner, did: builderDid } = await insertTestBuilder(bindings);
  log.info({ did: builderDid }, "Builder inserted");

  const builder = new BuilderClient({
    baseUrl: bindings.config.nodePublicEndpoint,
    signer: builderSigner,
    nodePublicKey: node.publicKey,
    httpClient: app.request,
  });

  const createToken = async (command = "/nil/db"): Promise<string> => {
    const did = await builderSigner.getDid();
    return Builder.invocation()
      .command(command)
      .audience(node.did)
      .subject(did)
      .expiresIn(1000 * 60)
      .signAndSerialize(builderSigner);
  };

  // Create user client
  const userSigner = Signer.fromPrivateKey(bytesToHex(secp256k1.utils.randomSecretKey()));
  const user = new UserClient({
    baseUrl: bindings.config.nodePublicEndpoint,
    signer: userSigner,
    nodePublicKey: node.publicKey,
    httpClient: app.request,
  });

  // Create admin signer using native did:ethr pattern (same as nuc-ts's createNativeEthrSigner)
  const adminDidString = `did:ethr:${getAddress(adminEthAccount.address)}`;
  const adminDidParsed = Did.parse(adminDidString);
  const adminEthrSigner: Signer = {
    header: { alg: "ES256K" as const, typ: "nuc" as const },
    getDid: async () => adminDidParsed,
    sign: async (data: Uint8Array): Promise<Uint8Array> => {
      const signatureHex = await adminEthAccount.signMessage({
        message: { raw: data },
      });
      const cleanHex = signatureHex.startsWith("0x") ? signatureHex.slice(2) : signatureHex;
      return hexToBytes(cleanHex);
    },
  };

  const createAdminToken = async (command = "/nil/db/admin/create"): Promise<string> => {
    return Builder.invocation()
      .command(command)
      .audience(node.did)
      .subject(adminDidParsed)
      .expiresIn(1000 * 60)
      .signAndSerialize(adminEthrSigner);
  };

  const c: FixtureContext = {
    id,
    log,
    app,
    bindings: {
      ...bindings,
      node,
    },
    system,
    builder,
    builderSigner,
    builderDid,
    createToken,
    admin: {
      signer: adminEthrSigner,
      did: adminDidString,
      createToken: createAdminToken,
    },
    user,
    userSigner,
  };

  if (opts.collection) {
    const { collection, query } = opts;

    collection.id = createUuidDto();
    const collectionResult = await builder.createCollection({
      _id: collection.id,
      type: collection.type,
      name: collection.name,
      schema: collection.schema,
    });
    if (!collectionResult.ok) {
      throw new Error(`Failed to create collection: ${collectionResult.error}`);
    }

    log.info({ id: collection.id }, "Schema registered");

    if (query) {
      log.info("Registering query");
      query.id = createUuidDto();
      query.collection = collection.id;
      const queryResult = await builder.createQuery({
        _id: query.id,
        name: query.name,
        collection: query.collection,
        variables: query.variables,
        pipeline: query.pipeline,
      });
      if (!queryResult.ok) {
        throw new Error(`Failed to create query: ${queryResult.error}`);
      }

      log.info({ id: query.id }, "Query registered");
    }

    log.info("Test suite ready");
  }
  return c;
}
