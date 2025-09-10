/** biome-ignore-all lint/nursery/noImportCycles: this a cycle wrt fixture and response handler */
import {
  Builder,
  Did,
  type Envelope,
  type Keypair,
  NilauthClient,
  type Payer,
  PayerBuilder,
  Signer,
} from "@nillion/nuc";
import { StatusCodes } from "http-status-codes";
import { vi } from "vitest";
import type { App } from "#/app";
import {
  ReadProfileResponse,
  type RegisterBuilderRequest,
  type UpdateProfileRequest,
} from "#/builders/builders.dto";
import {
  type CreateCollectionIndexRequest,
  type CreateCollectionRequest,
  ListCollectionsResponse,
  ReadCollectionMetadataResponse,
} from "#/collections/collections.dto";
import { NucCmd } from "#/common/nuc-cmd-tree";
import { PathsV1 } from "#/common/paths";
import type { UuidDto } from "#/common/types";
import {
  CreateDataResponse,
  type CreateOwnedDataRequest,
  type CreateStandardDataRequest,
  type DeleteDataRequest,
  DeleteDataResponse,
  type FindDataRequest,
  FindDataResponse,
  TailDataResponse,
  type UpdateDataRequest,
  UpdateDataResponse,
} from "#/data/data.dto";
import {
  type CreateQueryRequest,
  ReadQueriesResponse,
  ReadQueryRunByIdResponse,
  type RunQueryRequest,
  RunQueryResponse,
} from "#/queries/queries.dto";
import {
  ReadAboutNodeResponse,
  ReadLogLevelResponse,
  type SetLogLevelRequest,
} from "#/system/system.dto";
import {
  type GrantAccessToDataRequest,
  ListDataReferencesResponse,
  ReadDataResponse,
  type RevokeAccessToDataRequest,
  type UpdateUserDataRequest,
} from "#/users/users.dto";
import type { FixtureContext } from "./fixture";
import { ResponseHandler } from "./response-handler";

/**
 * Base configuration for test client creation.
 */
type BaseTestClientOptions = {
  app: App;
  keypair: Keypair;
  nodePublicKey: string;
};

/**
 * Configuration for admin test clients.
 */
type AdminTestClientOptions = BaseTestClientOptions & {
  type: "admin";
  nodeDelegation: Envelope;
};

/**
 * Configuration for builder test clients.
 */
type BuilderTestClientOptions = BaseTestClientOptions & {
  type: "builder";
  payer: Payer;
  nilauth: NilauthClient;
};

/**
 * Configuration for user test clients.
 */
type UserTestClientOptions = BaseTestClientOptions & {
  type: "user";
  builderDelegation?: string;
};

/**
 * Base HTTP test client for NilDB API operations.
 */
abstract class BaseTestClient<Options extends BaseTestClientOptions> {
  constructor(public _options: Options) {}

  get app(): App {
    return this._options.app;
  }

  get did(): Did {
    return this._options.keypair.toDid("nil");
  }

  get keypair(): Keypair {
    return this._options.keypair;
  }

  get signer(): Signer {
    return Signer.fromKeypair(this.keypair);
  }

  protected abstract createToken(): Promise<string>;

  async request<T>(
    path: string,
    options: { method?: "GET" | "POST" | "DELETE"; body?: T } = {},
  ): Promise<Response> {
    const { method = "GET", body } = options;
    const token = await this.createToken();

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };

    if (body) {
      headers["Content-Type"] = "application/json";
    }

    return this.app.request(path, {
      method,
      headers,
      ...(body && { body: JSON.stringify(body) }),
    });
  }

  health(c: FixtureContext): ResponseHandler {
    return new ResponseHandler(
      c,
      () => this.request(PathsV1.system.health),
      StatusCodes.OK,
    );
  }

  about(c: FixtureContext): ResponseHandler<ReadAboutNodeResponse> {
    return new ResponseHandler(
      c,
      () => this.request(PathsV1.system.about),
      StatusCodes.OK,
      ReadAboutNodeResponse,
    );
  }
}

/**
 * Admin test client for system administration operations.
 */
export class AdminTestClient extends BaseTestClient<AdminTestClientOptions> {
  /**
   * Creates an invocation token to use the permissions delegated from the node.
   */
  protected async createToken(): Promise<string> {
    const nodeDid = Did.fromPublicKey(this._options.nodePublicKey);
    // Admin client *invokes* the capability granted by the node's delegation.
    return await Builder.invoking(this._options.nodeDelegation)
      .audience(nodeDid)
      .signAndSerialize(this.signer);
  }

  startMaintenance(c: FixtureContext): ResponseHandler {
    return new ResponseHandler(
      c,
      () => this.request(PathsV1.system.maintenanceStart, { method: "POST" }),
      StatusCodes.OK,
    );
  }

  stopMaintenance(c: FixtureContext): ResponseHandler {
    return new ResponseHandler(
      c,
      () => this.request(PathsV1.system.maintenanceStop, { method: "POST" }),
      StatusCodes.OK,
    );
  }

  getLogLevel(c: FixtureContext): ResponseHandler<ReadLogLevelResponse> {
    return new ResponseHandler(
      c,
      () => this.request(PathsV1.system.logLevel),
      StatusCodes.OK,
      ReadLogLevelResponse,
    );
  }

  setLogLevel(c: FixtureContext, body: SetLogLevelRequest): ResponseHandler {
    return new ResponseHandler(
      c,
      () => this.request(PathsV1.system.logLevel, { method: "POST", body }),
      StatusCodes.OK,
    );
  }
}

/**
 * Test client for builder operations.
 */
export class BuilderTestClient extends BaseTestClient<BuilderTestClientOptions> {
  constructor(private options: BuilderTestClientOptions) {
    super(options);
  }

  override get did(): Did {
    return this._options.keypair.toDid("nil");
  }

  get nilauth(): NilauthClient {
    return this.options.nilauth;
  }

  /**
   * Creates an invocation token by using the root token from nilauth.
   */
  protected async createToken(): Promise<string> {
    const response = await this.options.nilauth.requestToken(
      this.options.keypair,
      "nildb",
    );
    const { token: rootToken } = response;

    const nodeDid = Did.fromPublicKey(this._options.nodePublicKey, "nil");

    // Builder *invokes* the capability granted by nilauth, targeting the node.
    return await Builder.invoking(rootToken)
      .audience(nodeDid)
      .signAndSerialize(this.signer);
  }

  async ensureSubscriptionActive(): Promise<void> {
    const checkSubscription = async () => {
      const response = await this.options.nilauth.subscriptionStatus(
        this.options.keypair.publicKey(),
        "nildb",
      );
      if (response.subscribed) return;

      // If not subscribed, attempt to pay. This may fail if a payment is already processing,
      // which is fine. We will re-check the status in the next poll interval.
      await this.options.nilauth
        .payAndValidate(this.options.keypair.publicKey(), "nildb")
        // Ignore errors since we will return
        .catch(() => {});

      // Throw to signal vi.waitFor to continue polling
      throw new Error("Subscription not yet active");
    };

    await vi.waitFor(checkSubscription, {
      timeout: 10000,
      interval: 500,
    });
  }

  async getRootToken(): Promise<Envelope> {
    const response = await this.options.nilauth.requestToken(
      this.options.keypair,
      "nildb",
    );
    return response.token;
  }

  register(c: FixtureContext, body: RegisterBuilderRequest): ResponseHandler {
    return new ResponseHandler(
      c,
      () =>
        this.app.request(PathsV1.builders.register, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      StatusCodes.CREATED,
    );
  }

  getProfile(c: FixtureContext): ResponseHandler<ReadProfileResponse> {
    return new ResponseHandler(
      c,
      () => this.request(PathsV1.builders.me),
      StatusCodes.OK,
      ReadProfileResponse,
    );
  }

  updateProfile(
    c: FixtureContext,
    body: UpdateProfileRequest,
  ): ResponseHandler {
    return new ResponseHandler(
      c,
      () => this.request(PathsV1.builders.me, { method: "POST", body }),
      StatusCodes.NO_CONTENT,
    );
  }

  deleteBuilder(c: FixtureContext) {
    return new ResponseHandler(
      c,
      () => this.request(PathsV1.builders.me, { method: "DELETE" }),
      StatusCodes.NO_CONTENT,
    );
  }

  createCollection(
    c: FixtureContext,
    body: CreateCollectionRequest,
  ): ResponseHandler {
    return new ResponseHandler(
      c,
      () => this.request(PathsV1.collections.root, { method: "POST", body }),
      StatusCodes.CREATED,
    );
  }

  readCollections(c: FixtureContext): ResponseHandler<ListCollectionsResponse> {
    return new ResponseHandler(
      c,
      () => this.request(PathsV1.collections.root),
      StatusCodes.OK,
      ListCollectionsResponse,
    );
  }

  deleteCollection(c: FixtureContext, collectionId: string) {
    return new ResponseHandler(
      c,
      () =>
        this.request(PathsV1.collections.byId.replace(":id", collectionId), {
          method: "DELETE",
        }),
      StatusCodes.NO_CONTENT,
    );
  }

  readCollection(
    c: FixtureContext,
    collectionId: string,
  ): ResponseHandler<ReadCollectionMetadataResponse> {
    return new ResponseHandler(
      c,
      () => this.request(PathsV1.collections.byId.replace(":id", collectionId)),
      StatusCodes.OK,
      ReadCollectionMetadataResponse,
    );
  }

  createCollectionIndex(
    c: FixtureContext,
    collectionId: string,
    body: CreateCollectionIndexRequest,
  ): ResponseHandler {
    return new ResponseHandler(
      c,
      () =>
        this.request(
          PathsV1.collections.indexesById.replace(":id", collectionId),
          {
            method: "POST",
            body,
          },
        ),
      StatusCodes.CREATED,
    );
  }

  dropCollectionIndex(
    c: FixtureContext,
    collectionId: string,
    indexName: string,
  ): ResponseHandler {
    return new ResponseHandler(
      c,
      () =>
        this.request(
          PathsV1.collections.indexesByNameById
            .replace(":id", collectionId)
            .replace(":name", indexName),
          { method: "DELETE" },
        ),
      StatusCodes.NO_CONTENT,
    );
  }

  getQueries(c: FixtureContext): ResponseHandler<ReadQueriesResponse> {
    return new ResponseHandler(
      c,
      () => this.request(PathsV1.queries.root),
      StatusCodes.OK,
      ReadQueriesResponse,
    );
  }

  getQuery(c: FixtureContext, queryId: string): ResponseHandler {
    return new ResponseHandler(
      c,
      () => this.request(PathsV1.queries.byId.replace(":id", queryId)),
      StatusCodes.OK,
    );
  }

  createQuery(c: FixtureContext, body: CreateQueryRequest): ResponseHandler {
    return new ResponseHandler(
      c,
      () => this.request(PathsV1.queries.root, { method: "POST", body }),
      StatusCodes.CREATED,
    );
  }

  deleteQuery(c: FixtureContext, queryId: string): ResponseHandler {
    return new ResponseHandler(
      c,
      () =>
        this.request(PathsV1.queries.byId.replace(":id", queryId), {
          method: "DELETE",
        }),
      StatusCodes.NO_CONTENT,
    );
  }

  runQuery(
    c: FixtureContext,
    body: RunQueryRequest,
  ): ResponseHandler<RunQueryResponse> {
    return new ResponseHandler(
      c,
      () => this.request(PathsV1.queries.run, { method: "POST", body }),
      StatusCodes.OK,
      RunQueryResponse,
    );
  }

  readQueryRunResults(
    c: FixtureContext,
    runId: string,
  ): ResponseHandler<ReadQueryRunByIdResponse> {
    return new ResponseHandler(
      c,
      () => this.request(PathsV1.queries.runById.replace(":id", runId)),
      StatusCodes.OK,
      ReadQueryRunByIdResponse,
    );
  }

  createOwnedData(
    c: FixtureContext,
    body: CreateOwnedDataRequest,
  ): ResponseHandler<CreateDataResponse> {
    return new ResponseHandler(
      c,
      () => this.request(PathsV1.data.createOwned, { method: "POST", body }),
      StatusCodes.OK,
      CreateDataResponse,
    );
  }

  createStandardData(
    c: FixtureContext,
    body: CreateStandardDataRequest,
  ): ResponseHandler<CreateDataResponse> {
    return new ResponseHandler(
      c,
      () => this.request(PathsV1.data.createStandard, { method: "POST", body }),
      StatusCodes.OK,
      CreateDataResponse,
    );
  }

  findData(
    c: FixtureContext,
    body: FindDataRequest,
  ): ResponseHandler<FindDataResponse> {
    return new ResponseHandler(
      c,
      () => this.request(PathsV1.data.find, { method: "POST", body }),
      StatusCodes.OK,
      FindDataResponse,
    );
  }

  updateData(
    c: FixtureContext,
    body: UpdateDataRequest,
  ): ResponseHandler<UpdateDataResponse> {
    return new ResponseHandler(
      c,
      () => this.request(PathsV1.data.update, { method: "POST", body }),
      StatusCodes.OK,
      UpdateDataResponse,
    );
  }

  deleteData(
    c: FixtureContext,
    body: DeleteDataRequest,
  ): ResponseHandler<DeleteDataResponse> {
    return new ResponseHandler(
      c,
      () => this.request(PathsV1.data.delete, { method: "POST", body }),
      StatusCodes.OK,
      DeleteDataResponse,
    );
  }

  flushData(c: FixtureContext, collectionId: string): ResponseHandler {
    return new ResponseHandler(
      c,
      () =>
        this.request(PathsV1.data.flushById.replace(":id", collectionId), {
          method: "DELETE",
        }),
      StatusCodes.NO_CONTENT,
    );
  }

  tailData(
    c: FixtureContext,
    collection: UuidDto,
    limit = 10,
  ): ResponseHandler<TailDataResponse> {
    return new ResponseHandler(
      c,
      () =>
        this.request(
          `${PathsV1.data.tailById.replace(":id", collection)}?limit=${limit}`,
        ),
      StatusCodes.OK,
      TailDataResponse,
    );
  }
}

/**
 * User test client for data owner operations.
 */
export class UserTestClient extends BaseTestClient<UserTestClientOptions> {
  constructor(private options: UserTestClientOptions) {
    super(options);
  }

  protected async createToken(): Promise<string> {
    // Self-signed invocation targeting the node.
    const nodeDid = Did.fromPublicKey(this._options.nodePublicKey, "nil");
    return await Builder.invocation()
      .command(NucCmd.nil.db.users.root)
      .audience(nodeDid)
      .subject(this.keypair.toDid("nil"))
      .signAndSerialize(this.signer);
  }

  async setBuilderDelegation(token: string): Promise<void> {
    this.options.builderDelegation = token;
  }

  getProfile(c: FixtureContext): ResponseHandler {
    return new ResponseHandler(
      c,
      () => this.request(PathsV1.users.me),
      StatusCodes.OK,
    );
  }

  listDataReferences(
    c: FixtureContext,
  ): ResponseHandler<ListDataReferencesResponse> {
    return new ResponseHandler(
      c,
      () => this.request(PathsV1.users.data.root),
      StatusCodes.OK,
      ListDataReferencesResponse,
    );
  }

  readData(
    c: FixtureContext,
    collection: string,
    document: string,
  ): ResponseHandler<ReadDataResponse> {
    return new ResponseHandler(
      c,
      () =>
        this.request(
          PathsV1.users.data.byId
            .replace(":collection", collection)
            .replace(":document", document),
        ),
      StatusCodes.OK,
      ReadDataResponse,
    );
  }

  updateData(
    c: FixtureContext,
    body: UpdateUserDataRequest,
  ): ResponseHandler<UpdateDataResponse> {
    return new ResponseHandler(
      c,
      () => this.request(PathsV1.users.data.root, { method: "POST", body }),
      StatusCodes.OK,
      UpdateDataResponse,
    );
  }

  deleteData(
    c: FixtureContext,
    collection: string,
    document: string,
  ): ResponseHandler {
    return new ResponseHandler(
      c,
      () =>
        this.request(
          PathsV1.users.data.byId
            .replace(":collection", collection)
            .replace(":document", document),
          { method: "DELETE" },
        ),
      StatusCodes.NO_CONTENT,
    );
  }

  grantAccess(
    c: FixtureContext,
    body: GrantAccessToDataRequest,
  ): ResponseHandler {
    return new ResponseHandler(
      c,
      () =>
        this.request(PathsV1.users.data.acl.grant, { method: "POST", body }),
      StatusCodes.NO_CONTENT,
    );
  }

  revokeAccess(
    c: FixtureContext,
    body: RevokeAccessToDataRequest,
  ): ResponseHandler {
    return new ResponseHandler(
      c,
      () =>
        this.request(PathsV1.users.data.acl.revoke, { method: "POST", body }),
      StatusCodes.NO_CONTENT,
    );
  }
}

/**
 * Creates an admin test client for system administration operations.
 */
export async function createAdminTestClient(opts: {
  app: App;
  keypair: Keypair;
  nodePublicKey: string;
  nodeDelegation: Envelope;
}): Promise<AdminTestClient> {
  return new AdminTestClient({
    type: "admin",
    ...opts,
  });
}

/**
 * Creates a test client for builder operations.
 */
export async function createBuilderTestClient(opts: {
  app: App;
  keypair: Keypair;
  chainUrl: string;
  nilauthBaseUrl: string;
  nodePublicKey: string;
}): Promise<BuilderTestClient> {
  const payer = await PayerBuilder.fromKeypair(opts.keypair)
    .chainUrl(opts.chainUrl)
    .build();

  const nilauth = await NilauthClient.create({
    baseUrl: opts.nilauthBaseUrl,
    payer,
  });

  return new BuilderTestClient({
    type: "builder",
    app: opts.app,
    keypair: opts.keypair,
    payer,
    nilauth,
    nodePublicKey: opts.nodePublicKey,
  });
}

/**
 * Creates a user test client for data owner operations.
 */
export async function createUserTestClient(opts: {
  app: App;
  keypair: Keypair;
  nodePublicKey: string;
}): Promise<UserTestClient> {
  return new UserTestClient({
    type: "user",
    app: opts.app,
    keypair: opts.keypair,
    nodePublicKey: opts.nodePublicKey,
  });
}
