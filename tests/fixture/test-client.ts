/** biome-ignore-all lint/nursery/noImportCycles: this a cycle wrt fixture and response handler */
import {
  Did,
  type DidString,
  InvocationBody,
  type Keypair,
  NilauthClient,
  NucTokenBuilder,
  type NucTokenEnvelope,
  type Payer,
  PayerBuilder,
} from "@nillion/nuc";
import { StatusCodes } from "http-status-codes";
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
 *
 * Admin clients derive authority from the node's private key and create
 * self-signed tokens. They have access to system administration endpoints
 * and don't require subscription management.
 */
type AdminTestClientOptions = BaseTestClientOptions & {
  type: "admin";
};

/**
 * Configuration for builder test clients.
 *
 * Builder clients pay subscriptions for access and require nilauth services
 * for token generation. They have access to data, queries, schemas, and
 * builder management endpoints.
 */
type BuilderTestClientOptions = BaseTestClientOptions & {
  type: "builder";
  payer: Payer;
  nilauth: NilauthClient;
};

/**
 * Configuration for user test clients.
 *
 * User clients represent data owners who can upload data to builder collections
 * through NUC delegations. They access their own data with self-signed tokens
 * and don't require subscriptions.
 */
type UserTestClientOptions = BaseTestClientOptions & {
  type: "user";
  builderDelegation?: string;
};

/**
 * Union type for all test client configuration options.
 */
export type TestClientOptions =
  | AdminTestClientOptions
  | BuilderTestClientOptions
  | UserTestClientOptions;

/**
 * Base HTTP test client for NilDB API operations.
 *
 * Provides core functionality for making authenticated API requests
 * during integration testing. Handles token creation, request formatting,
 * and response processing.
 */
abstract class BaseTestClient {
  /**
   * Creates a new test client instance.
   */
  constructor(public _options: TestClientOptions) {}

  /**
   * Gets the Hono application instance for making requests.
   */
  get app(): App {
    return this._options.app;
  }

  /**
   * Gets the client's decentralized identifier (Did).
   */
  get did(): DidString {
    return this._options.keypair.toDidString();
  }

  /**
   * Gets the client's cryptographic keypair.
   */
  get keypair() {
    return this._options.keypair;
  }

  /**
   * Creates an authentication token for API requests.
   */
  protected abstract createToken(): Promise<string>;

  /**
   * Makes an authenticated HTTP request to the API.
   */
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

  /**
   * Checks node health status.
   */
  health(c: FixtureContext): ResponseHandler {
    return new ResponseHandler(
      c,
      () => this.request(PathsV1.system.health),
      StatusCodes.OK,
    );
  }

  /**
   * Retrieves comprehensive node information including version and configuration.
   */
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
 *
 * Admin clients derive their authority from the node's private key and have
 * access to system management endpoints like log level configuration and
 * maintenance mode control. They create self-signed tokens and don't require
 * subscription management.
 */
export class AdminTestClient extends BaseTestClient {
  /**
   * Creates a self-signed authentication token for admin operations.
   */
  protected async createToken(): Promise<string> {
    const audience = Did.fromHex(this._options.nodePublicKey);
    const subject = Did.fromHex(this.keypair.publicKey("hex"));

    return NucTokenBuilder.invocation({})
      .command(NucCmd.nil.db.root)
      .audience(audience)
      .subject(subject)
      .build(this.keypair.privateKey());
  }

  /**
   * Activates maintenance mode on the node.
   */
  startMaintenance(c: FixtureContext): ResponseHandler {
    return new ResponseHandler(
      c,
      () => this.request(PathsV1.system.maintenanceStart, { method: "POST" }),
      StatusCodes.OK,
    );
  }

  /**
   * Deactivates maintenance mode on the node.
   */
  stopMaintenance(c: FixtureContext): ResponseHandler {
    return new ResponseHandler(
      c,
      () => this.request(PathsV1.system.maintenanceStop, { method: "POST" }),
      StatusCodes.OK,
    );
  }

  /**
   * Retrieves the current log level configuration.
   */
  getLogLevel(c: FixtureContext): ResponseHandler<ReadLogLevelResponse> {
    return new ResponseHandler(
      c,
      () => this.request(PathsV1.system.logLevel),
      StatusCodes.OK,
      ReadLogLevelResponse,
    );
  }

  /**
   * Updates the node's log level configuration.
   */
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
 *
 * Builder clients pay subscriptions for access to the node and require nilauth
 * services for token generation. They have access to data management, query
 * execution, schema definition, and builder management endpoints. These clients
 * represent builder that build applications on top of NilDB.
 */
export class BuilderTestClient extends BaseTestClient {
  constructor(private options: BuilderTestClientOptions) {
    super(options);
  }

  /**
   * Gets the nilauth client for external authentication services.
   */
  get nilauth(): NilauthClient {
    return this.options.nilauth;
  }

  /**
   * Creates an invocation token extending a nilauth root token.
   */
  protected async createToken(): Promise<string> {
    const audience = Did.fromHex(this._options.nodePublicKey);
    const response = await this.options.nilauth.requestToken(
      this.options.keypair,
      "nildb",
    );
    const { token: rootToken } = response;

    return NucTokenBuilder.extending(rootToken)
      .proof(rootToken)
      .audience(audience)
      .body(new InvocationBody({}))
      .build(this.keypair.privateKey());
  }

  /**
   * Ensures the builder has an active subscription for API access.
   */
  async ensureSubscriptionActive(): Promise<void> {
    for (let retry = 0; retry < 5; retry++) {
      const response = await this.options.nilauth.subscriptionStatus(
        this.options.keypair.publicKey("hex"),
        "nildb",
      );
      if (!response.subscribed) {
        try {
          await this.options.nilauth.payAndValidate(
            this.options.keypair.publicKey("hex"),
            "nildb",
          );
          return;
        } catch (_error) {
          console.log(
            "Retrying to pay and validate the subscription after 200ms",
          );
          await new Promise((f) => setTimeout(f, 200));
        }
      } else {
        return;
      }
    }
  }

  /**
   * Retrieves the root token from nilauth for token extension.
   */
  async getRootToken(): Promise<NucTokenEnvelope> {
    const response = await this.options.nilauth.requestToken(
      this.options.keypair,
      "nildb",
    );
    return response.token;
  }

  /**
   * Registers a new builder.
   */
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

  /**
   * Retrieves the authenticated builder's profile information.
   */
  getProfile(c: FixtureContext): ResponseHandler<ReadProfileResponse> {
    return new ResponseHandler(
      c,
      () => this.request(PathsV1.builders.me),
      StatusCodes.OK,
      ReadProfileResponse,
    );
  }

  /**
   * Updates the authenticated builder's profile information.
   */
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

  /**
   * Deletes the authenticated builder and all associated resources.
   *
   * @param c - Test fixture context
   * @returns Response handler for builder deletion
   */
  deleteBuilder(c: FixtureContext) {
    return new ResponseHandler(
      c,
      () => this.request(PathsV1.builders.me, { method: "DELETE" }),
      StatusCodes.NO_CONTENT,
    );
  }

  // Collection Management API Methods

  /**
   * Creates a new collection for data validation.
   */
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

  /**
   * Lists all collections owned by the authenticated builder.
   */
  readCollections(c: FixtureContext): ResponseHandler<ListCollectionsResponse> {
    return new ResponseHandler(
      c,
      () => this.request(PathsV1.collections.root),
      StatusCodes.OK,
      ListCollectionsResponse,
    );
  }

  /**
   * Deletes a collection by id and all associated data.
   */
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

  /**
   * Retrieves a collection by id including metadata.
   */
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

  /**
   * Creates an index on a collection.
   */
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

  /**
   * Drops an index from a collection.
   */
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

  /**
   * Lists all queries owned by the authenticated builder.
   */
  getQueries(c: FixtureContext): ResponseHandler<ReadQueriesResponse> {
    return new ResponseHandler(
      c,
      () => this.request(PathsV1.queries.root),
      StatusCodes.OK,
      ReadQueriesResponse,
    );
  }

  /**
   * Retrieves a query by id.
   */
  getQuery(c: FixtureContext, queryId: string): ResponseHandler {
    return new ResponseHandler(
      c,
      () => this.request(PathsV1.queries.byId.replace(":id", queryId)),
      StatusCodes.OK,
    );
  }

  /**
   * Creates a new MongoDB aggregation query with variable substitution.
   */
  createQuery(c: FixtureContext, body: CreateQueryRequest): ResponseHandler {
    return new ResponseHandler(
      c,
      () => this.request(PathsV1.queries.root, { method: "POST", body }),
      StatusCodes.CREATED,
    );
  }

  /**
   * Deletes a query by id.
   */
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

  /**
   * Executes a query with variable substitution.
   */
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

  /**
   * Retrieves the status and results of a background query job.
   */
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

  /**
   * Uploads owned data records to a schema-validated collection.
   */
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

  /**
   * Uploads standard data records to a schema-validated collection.
   */
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

  /**
   * Searches for data matching the provided filter.
   */
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

  /**
   * Updates data records matching the provided filter.
   */
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

  /**
   * Deletes data records matching the provided filter.
   */
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

  /**
   * Removes all data from a collection.
   */
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

  /**
   * Retrieves the most recent data records from a collection.
   */
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
 *
 * User clients represent data owners who can upload data to builder collections
 * through NUC delegations. They can access their own data directly with
 * self-signed tokens without requiring subscriptions. Users control the
 * permissions applied to the data they upload.
 */
export class UserTestClient extends BaseTestClient {
  constructor(private options: UserTestClientOptions) {
    super(options);
  }

  /**
   * Creates a self-signed authentication token for user operations.
   */
  protected async createToken(): Promise<string> {
    const audience = Did.fromHex(this._options.nodePublicKey);
    const subject = Did.fromHex(this.keypair.publicKey("hex"));

    return NucTokenBuilder.invocation({})
      .command(NucCmd.nil.db.users.root)
      .audience(audience)
      .subject(subject)
      .build(this.keypair.privateKey());
  }

  /**
   * Sets a builder delegation token to use when accessing builder-owned resources.
   */
  async setBuilderDelegation(token: string): Promise<void> {
    this.options.builderDelegation = token;
  }

  // User Domain API Methods

  /**
   * Retrieves the authenticated user's profile information.
   */
  getProfile(c: FixtureContext): ResponseHandler {
    return new ResponseHandler(
      c,
      () => this.request(PathsV1.users.me),
      StatusCodes.OK,
    );
  }

  /**
   * Lists all data records owned by the authenticated user.
   */
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

  /**
   * Retrieves user-owned data by collection and document id.
   */
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

  /**
   * Deletes a user-owned data document.
   */
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

  /**
   * Grants access to user-owned data.
   */
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

  /**
   * Removes access to user-owned data.
   */
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
 *
 * Admin clients derive their authority from the node's private key and have
 * full system access. They don't require subscription management or external
 * authentication services.
 *
 * @param opts - Admin client configuration options
 * @returns Configured admin test client instance
 */
export async function createAdminTestClient(opts: {
  app: App;
  keypair: Keypair;
  nodePublicKey: string;
}): Promise<AdminTestClient> {
  return new AdminTestClient({
    type: "admin",
    app: opts.app,
    keypair: opts.keypair,
    nodePublicKey: opts.nodePublicKey,
  });
}

/**
 * Creates a test client for builder operations.
 *
 * Builder clients require subscription management and use nilauth for
 * token generation. They automatically handle payment and validation
 * processes for API access.
 */
export async function createBuilderTestClient(opts: {
  app: App;
  keypair: Keypair;
  chainUrl: string;
  nilauthBaseUrl: string;
  nodePublicKey: string;
}): Promise<BuilderTestClient> {
  const payer = await new PayerBuilder()
    .keypair(opts.keypair)
    .chainUrl(opts.chainUrl)
    .build();

  const nilauth = await NilauthClient.from(opts.nilauthBaseUrl, payer);

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
