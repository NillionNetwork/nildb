import {
  Command,
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
import z from "zod";
import type { App } from "#/app";
import {
  GetProfileResponse,
  type RegisterBuilderRequest,
  type UpdateProfileRequest,
} from "#/builders/builders.dto";
import { PathsV1 } from "#/common/paths";
import {
  type DeleteDataRequest,
  DeleteDataResponse,
  type FlushDataRequest,
  type ReadDataRequest,
  ReadDataResponse,
  type TailDataRequest,
  TailDataResponse,
  type UpdateDataRequest,
  UpdateDataResponse,
  UploadDataResponse,
  type UploadOwnedDataRequest,
  type UploadStandardDataRequest,
} from "#/data/data.dto";
import {
  type AddQueryRequest,
  type DeleteQueryRequest,
  type ExecuteQueryRequest,
  ExecuteQueryResponse,
  GetQueriesResponse,
  GetQueryJobResponse,
  type QueryJobRequest,
} from "#/queries/queries.dto";
import {
  type AddSchemaRequest,
  type DeleteSchemaRequest,
  ListSchemasResponse,
  ReadSchemaMetadataResponse,
} from "#/schemas/schemas.dto";
import {
  GetAboutNodeResponse,
  GetLogLevelResponse,
  type SetLogLevelRequest,
} from "#/system/system.dto";
import {
  type AddPermissionsRequest,
  AddPermissionsResponse,
  type DeletePermissionsRequest,
  ListUserDataResponse,
  type ReadPermissionsRequest,
  ReadPermissionsResponse,
  type UpdatePermissionsRequest,
  UpdatePermissionsResponse,
} from "#/users/users.dto";
// biome-ignore lint/nursery/noImportCycles: this cycle resolves correctly, is limited to testing, and avoids an overly large fixture file
import type { FixtureContext } from "./fixture";
// biome-ignore lint/nursery/noImportCycles: this cycle resolves correctly, is limited to testing, and avoids an overly large fixture file
import { ResponseHandler } from "./response-handler";

/**
 * Base configuration for test client creation.
 *
 * Contains common properties required by all test client types.
 */
type BaseTestClientOptions = {
  /** Hono application instance for making requests */
  app: App;
  /** Cryptographic keypair for signing tokens */
  keypair: Keypair;
  /** Node's public key for token audience validation */
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
  /** Discriminator for admin client type */
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
  /** Discriminator for builder client type */
  type: "builder";
  /** Payment service for subscription management */
  payer: Payer;
  /** Nilauth client for token generation and validation */
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
  /** Discriminator for user client type */
  type: "user";
  /** Optional builder delegation token for accessing builder resources */
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
   *
   * @param _options - Configuration options for the test client
   */
  constructor(public _options: TestClientOptions) {}

  /**
   * Gets the Hono application instance for making requests.
   *
   * @returns The configured Hono app instance
   */
  get app(): App {
    return this._options.app;
  }

  /**
   * Gets the client's decentralized identifier (DID).
   *
   * @returns DID string derived from the client's keypair
   */
  get did(): DidString {
    return this._options.keypair.toDidString();
  }

  /**
   * Gets the client's cryptographic keypair.
   *
   * @returns The keypair used for token signing
   */
  get keypair() {
    return this._options.keypair;
  }

  /**
   * Creates an authentication token for API requests.
   *
   * Implemented by each client type with their specific authentication method.
   *
   * @returns JWT token string for Authorization header
   * @protected
   */
  protected abstract createToken(): Promise<string>;

  /**
   * Makes an authenticated HTTP request to the API.
   *
   * Handles token creation, header configuration, and body serialization
   * for all API endpoints. Automatically includes authentication headers.
   *
   * @param path - API endpoint path
   * @param options - Request configuration including method and body
   * @returns HTTP response from the API
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
   *
   * @param c - Test fixture context
   * @returns Response handler for health check endpoint
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
   *
   * @param c - Test fixture context
   * @returns Response handler for node about endpoint
   */
  about(c: FixtureContext): ResponseHandler<GetAboutNodeResponse> {
    return new ResponseHandler(
      c,
      () => this.request(PathsV1.system.about),
      StatusCodes.OK,
      GetAboutNodeResponse,
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
   *
   * Admin tokens are derived from the node's authority and have access
   * to system administration endpoints.
   *
   * @returns JWT token string for Authorization header
   * @protected
   */
  protected async createToken(): Promise<string> {
    const audience = Did.fromHex(this._options.nodePublicKey);
    const subject = Did.fromHex(this.keypair.publicKey("hex"));

    return NucTokenBuilder.invocation({})
      .command(new Command(["nil", "db"]))
      .audience(audience)
      .subject(subject)
      .build(this.keypair.privateKey());
  }

  /**
   * Activates maintenance mode on the node.
   *
   * During maintenance mode, the node may reject certain operations
   * to allow for safe system updates or repairs.
   *
   * @param c - Test fixture context
   * @returns Response handler for maintenance start endpoint
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
   *
   * Restores normal operation after maintenance activities are complete.
   *
   * @param c - Test fixture context
   * @returns Response handler for maintenance stop endpoint
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
   *
   * @param c - Test fixture context
   * @returns Response handler for log level retrieval
   */
  getLogLevel(c: FixtureContext): ResponseHandler<GetLogLevelResponse> {
    return new ResponseHandler(
      c,
      () => this.request(PathsV1.system.logLevel),
      StatusCodes.OK,
      GetLogLevelResponse,
    );
  }

  /**
   * Updates the node's log level configuration.
   *
   * Controls the verbosity of system logging for debugging and monitoring.
   *
   * @param c - Test fixture context
   * @param body - Log level configuration request
   * @returns Response handler for log level update
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
   *
   * @returns The nilauth client instance for subscription and token management
   */
  get nilauth(): NilauthClient {
    return this.options.nilauth;
  }

  /**
   * Creates an invocation token extending a nilauth root token.
   *
   * Builder tokens are created by extending root tokens obtained from
   * the nilauth service after subscription payment and validation.
   *
   * @returns JWT token string for Authorization header
   * @protected
   */
  protected async createToken(): Promise<string> {
    const audience = Did.fromHex(this._options.nodePublicKey);
    const response = await this.options.nilauth.requestToken();
    const { token: rootToken } = response;

    return NucTokenBuilder.extending(rootToken)
      .proof(rootToken)
      .audience(audience)
      .body(new InvocationBody({}))
      .build(this.keypair.privateKey());
  }

  /**
   * Ensures the builder has an active subscription for API access.
   *
   * Attempts to activate subscription through payment if not already active.
   * Includes retry logic to handle temporary payment processing delays.
   */
  async ensureSubscriptionActive(): Promise<void> {
    for (let retry = 0; retry < 5; retry++) {
      const response = await this.options.nilauth.subscriptionStatus();
      if (!response.subscribed) {
        try {
          await this.options.nilauth.payAndValidate();
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
   *
   * Used for creating custom invocation tokens with specific capabilities
   * or for delegating access to user clients.
   *
   * @returns The root token envelope from nilauth
   */
  async getRootToken(): Promise<NucTokenEnvelope> {
    const response = await this.options.nilauth.requestToken();
    return response.token;
  }

  // Builder Management API Methods

  /**
   * Registers a new builder.
   *
   * Note: This endpoint bypasses authentication for initial builder creation.
   *
   * @param c - Test fixture context
   * @param body - Builder registration request
   * @returns Response handler for builder registration
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
   *
   * @param c - Test fixture context
   * @returns Response handler for profile retrieval
   */
  getProfile(c: FixtureContext): ResponseHandler<GetProfileResponse> {
    return new ResponseHandler(
      c,
      () => this.request(PathsV1.builders.me),
      StatusCodes.OK,
      GetProfileResponse,
    );
  }

  /**
   * Updates the authenticated builder's profile information.
   *
   * @param c - Test fixture context
   * @param body - Profile update request
   * @returns Response handler for profile update
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

  // Schema Management API Methods

  /**
   * Creates a new JSON schema definition for data validation.
   *
   * @param c - Test fixture context
   * @param body - Schema creation request
   * @returns Response handler for schema creation
   */
  addSchema(c: FixtureContext, body: AddSchemaRequest): ResponseHandler {
    return new ResponseHandler(
      c,
      () => this.request(PathsV1.schemas.root, { method: "POST", body }),
      StatusCodes.CREATED,
    );
  }

  /**
   * Lists all schemas owned by the authenticated builder.
   *
   * @param c - Test fixture context
   * @returns Response handler for schema listing
   */
  listSchemas(c: FixtureContext): ResponseHandler<ListSchemasResponse> {
    return new ResponseHandler(
      c,
      () => this.request(PathsV1.schemas.root),
      StatusCodes.OK,
      ListSchemasResponse,
    );
  }

  /**
   * Deletes a schema by ID and all associated data.
   *
   * @param c - Test fixture context
   * @param body - Schema deletion request
   * @returns Response handler for schema deletion
   */
  deleteSchema(c: FixtureContext, body: DeleteSchemaRequest) {
    return new ResponseHandler(
      c,
      () => this.request(PathsV1.schemas.root, { method: "DELETE", body }),
      StatusCodes.NO_CONTENT,
    );
  }

  /**
   * Retrieves metadata and statistics for a schema collection.
   *
   * @param c - Test fixture context
   * @param id - Schema UUID
   * @returns Response handler for schema metadata retrieval
   */
  getSchemaMetadata(
    c: FixtureContext,
    id: string,
  ): ResponseHandler<ReadSchemaMetadataResponse> {
    return new ResponseHandler(
      c,
      () => this.request(PathsV1.schemas.byIdMeta.replace(":id", id)),
      StatusCodes.OK,
      ReadSchemaMetadataResponse,
    );
  }

  /**
   * Lists all queries owned by the authenticated builder.
   *
   * @param c - Test fixture context
   * @returns Response handler for query listing
   */
  listQueries(c: FixtureContext): ResponseHandler<GetQueriesResponse> {
    return new ResponseHandler(
      c,
      () => this.request(PathsV1.queries.root),
      StatusCodes.OK,
      GetQueriesResponse,
    );
  }

  /**
   * Creates a new MongoDB aggregation query with variable substitution.
   *
   * @param c - Test fixture context
   * @param body - Query creation request
   * @returns Response handler for query creation
   */
  addQuery(c: FixtureContext, body: AddQueryRequest): ResponseHandler {
    return new ResponseHandler(
      c,
      () => this.request(PathsV1.queries.root, { method: "POST", body }),
      StatusCodes.CREATED,
    );
  }

  /**
   * Deletes a query by ID.
   *
   * @param c - Test fixture context
   * @param body - Query deletion request
   * @returns Response handler for query deletion
   */
  deleteQuery(c: FixtureContext, body: DeleteQueryRequest): ResponseHandler {
    return new ResponseHandler(
      c,
      () => this.request(PathsV1.queries.root, { method: "DELETE", body }),
      StatusCodes.NO_CONTENT,
    );
  }

  /**
   * Executes a query with variable substitution.
   *
   * Can run synchronously or as a background job depending on request
   * configuration. Background jobs are useful for long-running queries.
   *
   * @param c - Test fixture context
   * @param body - Query execution request with variables
   * @returns Response handler for query execution
   */
  executeQuery(
    c: FixtureContext,
    body: ExecuteQueryRequest,
  ): ResponseHandler<ExecuteQueryResponse> {
    return new ResponseHandler(
      c,
      () => this.request(PathsV1.queries.execute, { method: "POST", body }),
      StatusCodes.OK,
      ExecuteQueryResponse,
    );
  }

  /**
   * Retrieves the status and results of a background query job.
   *
   * @param c - Test fixture context
   * @param body - Query job status request
   * @returns Response handler for job status retrieval
   */
  getQueryJob(
    c: FixtureContext,
    body: QueryJobRequest,
  ): ResponseHandler<GetQueryJobResponse> {
    return new ResponseHandler(
      c,
      () => this.request(PathsV1.queries.job, { method: "POST", body }),
      StatusCodes.OK,
      GetQueryJobResponse,
    );
  }

  /**
   * Uploads owned data records to a schema-validated collection.
   *
   * @param c - Test fixture context
   * @param body - Data upload request with records and permissions
   * @returns Response handler for data upload
   */
  uploadOwnedData(
    c: FixtureContext,
    body: UploadOwnedDataRequest,
  ): ResponseHandler<UploadDataResponse> {
    return new ResponseHandler(
      c,
      () => this.request(PathsV1.data.createOwned, { method: "POST", body }),
      StatusCodes.OK,
      UploadDataResponse,
    );
  }

  /**
   * Uploads standard data records to a schema-validated collection.
   *
   * @param c - Test fixture context
   * @param body - Data upload request with records and permissions
   * @returns Response handler for data upload
   */
  uploadStandardData(
    c: FixtureContext,
    body: UploadStandardDataRequest,
  ): ResponseHandler<UploadDataResponse> {
    return new ResponseHandler(
      c,
      () => this.request(PathsV1.data.createStandard, { method: "POST", body }),
      StatusCodes.OK,
      UploadDataResponse,
    );
  }

  /**
   * Deletes data records matching the provided filter.
   *
   * @param c - Test fixture context
   * @param body - Data deletion request with filter
   * @returns Response handler for data deletion
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
   * Removes all data from a schema collection.
   *
   * @param c - Test fixture context
   * @param body - Collection flush request
   * @returns Response handler for collection flush
   */
  flushData(
    c: FixtureContext,
    body: FlushDataRequest,
  ): ResponseHandler<DeleteDataResponse> {
    return new ResponseHandler(
      c,
      () => this.request(PathsV1.data.flush, { method: "POST", body }),
      StatusCodes.OK,
      DeleteDataResponse,
    );
  }

  /**
   * Retrieves the most recent data records from a collection.
   *
   * @param c - Test fixture context
   * @param body - Data tail request
   * @returns Response handler for recent data retrieval
   */
  tailData(
    c: FixtureContext,
    body: TailDataRequest,
  ): ResponseHandler<TailDataResponse> {
    return new ResponseHandler(
      c,
      () => this.request(PathsV1.data.tail, { method: "POST", body }),
      StatusCodes.OK,
      TailDataResponse,
    );
  }

  /**
   * Reads data records matching the provided filter.
   *
   * @param c - Test fixture context
   * @param body - Data read request with filter
   * @returns Response handler for data retrieval
   */
  readData(
    c: FixtureContext,
    body: ReadDataRequest,
  ): ResponseHandler<ReadDataResponse> {
    return new ResponseHandler(
      c,
      () => this.request(PathsV1.data.read, { method: "POST", body }),
      StatusCodes.OK,
      ReadDataResponse,
    );
  }

  /**
   * Updates data records matching the provided filter.
   *
   * @param c - Test fixture context
   * @param body - Data update request with filter and modifications
   * @returns Response handler for data update
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
   *
   * User tokens provide access to user domain endpoints for managing
   * data permissions and accessing user-owned data.
   *
   * @returns JWT token string for Authorization header
   * @protected
   */
  protected async createToken(): Promise<string> {
    const audience = Did.fromHex(this._options.nodePublicKey);
    const subject = Did.fromHex(this.keypair.publicKey("hex"));

    // If a builder delegation is set, use it; otherwise create self-signed token
    if (this.options.builderDelegation) {
      // TODO: Implement delegation token usage
      // For now, fall back to self-signed token
    }

    return NucTokenBuilder.invocation({})
      .command(new Command(["nil", "db"]))
      .audience(audience)
      .subject(subject)
      .build(this.keypair.privateKey());
  }

  /**
   * Sets a builder delegation token to use when accessing builder-owned resources.
   *
   * @param token - The delegation token provided by a builder
   */
  async setBuilderDelegation(token: string): Promise<void> {
    this.options.builderDelegation = token;
  }

  // User Domain API Methods

  /**
   * Lists all data records owned by the authenticated user.
   *
   * @param c - Test fixture context
   * @returns Response handler for user data listing
   */
  readUserData(c: FixtureContext): ResponseHandler<ListUserDataResponse> {
    return new ResponseHandler(
      c,
      () => this.request(PathsV1.users.data.root, { method: "GET" }),
      StatusCodes.OK,
      ListUserDataResponse,
    );
  }

  /**
   * Reads permissions for specific data records.
   *
   * Allows users to check who has access to their data and what
   * level of permissions have been granted.
   *
   * @param c - Test fixture context
   * @param body - Permissions read request
   * @returns Response handler for permissions retrieval
   */
  readPermissions(
    c: FixtureContext,
    body: ReadPermissionsRequest,
  ): ResponseHandler<ReadPermissionsResponse> {
    return new ResponseHandler(
      c,
      () =>
        this.request(PathsV1.users.data.perms.read, { method: "POST", body }),
      StatusCodes.OK,
      ReadPermissionsResponse,
    );
  }

  /**
   * Grants permissions to other users for accessing data.
   *
   * Data owners can grant read, write, or other permissions to
   * specific users or roles for their data records.
   *
   * @param c - Test fixture context
   * @param body - Permissions addition request
   * @returns Response handler for permissions addition
   */
  addPermissions(
    c: FixtureContext,
    body: AddPermissionsRequest,
  ): ResponseHandler<AddPermissionsResponse> {
    return new ResponseHandler(
      c,
      () =>
        this.request(PathsV1.users.data.perms.add, { method: "POST", body }),
      StatusCodes.OK,
      AddPermissionsResponse,
    );
  }

  /**
   * Updates existing permissions for data access.
   *
   * Allows modification of previously granted permissions,
   * such as changing permission levels or scopes.
   *
   * @param c - Test fixture context
   * @param body - Permissions update request
   * @returns Response handler for permissions update
   */
  updatePermissions(
    c: FixtureContext,
    body: UpdatePermissionsRequest,
  ): ResponseHandler<UpdatePermissionsResponse> {
    return new ResponseHandler(
      c,
      () =>
        this.request(PathsV1.users.data.perms.update, { method: "POST", body }),
      StatusCodes.OK,
      UpdatePermissionsResponse,
    );
  }

  /**
   * Revokes permissions for data access.
   *
   * Removes previously granted permissions, restricting access
   * to the specified data records.
   *
   * @param c - Test fixture context
   * @param body - Permissions deletion request
   * @returns Response handler for permissions revocation
   */
  deletePermissions(
    c: FixtureContext,
    body: DeletePermissionsRequest,
  ): ResponseHandler {
    return new ResponseHandler(
      c,
      () =>
        this.request(PathsV1.users.data.perms.delete, { method: "POST", body }),
      StatusCodes.OK,
      z.unknown(),
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
 *
 * @param opts - Builder client configuration options
 * @returns Configured builder test client instance
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

  const nilauth = await NilauthClient.from({
    keypair: opts.keypair,
    payer,
    baseUrl: opts.nilauthBaseUrl,
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
 *
 * User clients represent data owners who can access their own data with
 * self-signed tokens. They don't require subscriptions but can use builder
 * delegations to access builder-owned resources.
 *
 * @param opts - User client configuration options
 * @returns Configured user test client instance
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
