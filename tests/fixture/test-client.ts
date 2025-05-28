import {
  Command,
  Did,
  type DidString,
  InvocationBody,
  type Keypair,
  type NilauthClient,
  NucTokenBuilder,
  type NucTokenEnvelope,
  type Payer,
} from "@nillion/nuc";
import { StatusCodes } from "http-status-codes";
import {
  GetProfileResponse,
  type RegisterAccountRequest,
  type UpdateProfileRequest,
} from "#/accounts/accounts.dto";
import type {
  AdminSetLogLevelRequest,
  AdminSetMaintenanceWindowRequest,
} from "#/admin/admin.types";
import type { App } from "#/app";
import type { ApiErrorResponse } from "#/common/handler";
import { PathsV1 } from "#/common/paths";
import type { UuidDto } from "#/common/types";
import type {
  DeleteDataRequest,
  FlushDataRequest,
  ReadDataRequest,
  TailDataRequest,
  UpdateDataRequest,
  UploadDataRequest,
} from "#/data/data.types";
import type {
  AddQueryRequest,
  DeleteQueryRequest,
  ExecuteQueryRequest,
  QueryJobRequest,
} from "#/queries/queries.types";
import type {
  AddSchemaRequest,
  DeleteSchemaRequest,
} from "#/schemas/schemas.types";
import { SystemEndpoint } from "#/system/system.router";
// biome-ignore lint/nursery/noImportCycles: requires refactor to address
import type { FixtureContext } from "./fixture";

export type TestClientOptions = {
  app: App;
  keypair: Keypair;
  payer: Payer;
  nilauth: NilauthClient;
  node: {
    keypair: Keypair;
    endpoint: string;
  };
};

abstract class TestClient {
  constructor(public _options: TestClientOptions) {}

  get app(): App {
    return this._options.app;
  }

  get did(): DidString {
    return this._options.keypair.toDidString();
  }

  get keypair() {
    return this._options.keypair;
  }

  nuc(): string {
    const audience = Did.fromHex(this._options.node.keypair.publicKey("hex"));
    const subject = Did.fromHex(this.keypair.publicKey("hex"));

    return NucTokenBuilder.invocation({})
      .command(new Command(["nil", "db"]))
      .audience(audience)
      .subject(subject)
      .build(this.keypair.privateKey());
  }

  async request<T>(
    path: string,
    options: {
      method?: "GET" | "POST" | "DELETE";
      body?: T;
    } = {},
  ): Promise<Response> {
    const { method = "GET", body } = options;
    const token = this.nuc();

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

  async health(): Promise<Response> {
    return this.app.request(SystemEndpoint.Health);
  }

  async about(): Promise<Response> {
    return this.app.request(SystemEndpoint.About);
  }
}

export class TestRootUserClient extends TestClient {
  async setMaintenanceWindow(
    body: AdminSetMaintenanceWindowRequest,
  ): Promise<Response> {
    return this.request(PathsV1.admin.maintenance, {
      method: "POST",
      body,
    });
  }

  async deleteMaintenanceWindow(): Promise<Response> {
    return this.request(PathsV1.admin.maintenance, {
      method: "DELETE",
    });
  }

  async getLogLevel(): Promise<Response> {
    return this.request(PathsV1.admin.logLevel, {
      method: "GET",
    });
  }

  async setLogLevel(body: AdminSetLogLevelRequest): Promise<Response> {
    return this.request(PathsV1.admin.logLevel, {
      method: "POST",
      body,
    });
  }
}

type ResponseExpectations =
  | { success: true }
  | { success: false; errors: string[]; status: StatusCodes };

type TestResponseHandler<TSuccess> = {
  request: () => Promise<Response>;
  successStatus: StatusCodes;
  parseSuccess?: (json: unknown) => TSuccess;
};

async function handleTestResponse<TSuccess>(
  c: FixtureContext,
  handler: TestResponseHandler<TSuccess>,
  expectations: ResponseExpectations,
): Promise<TSuccess | ApiErrorResponse> {
  const { expect } = c;
  const response = await handler.request();

  if (expectations.success) {
    expect(response.ok).toBe(true);
    expect(response.status).toBe(handler.successStatus);

    if (handler.parseSuccess) {
      const json = await response.json();
      return handler.parseSuccess(json);
    }
    return undefined as TSuccess;
  }

  const { errors, status } = expectations;
  expect(response.ok).toBe(false);
  expect(status).toBe(response.status);

  const body = (await response.json()) as ApiErrorResponse;
  for (const message of errors) {
    expect(body.errors).toEqual(
      expect.arrayContaining([expect.stringContaining(message)]),
    );
  }
  return body;
}

export class TestOrganizationUserClient extends TestClient {
  async ensureSubscriptionActive(): Promise<void> {
    const { nilauth } = this._options;
    for (let retry = 0; retry < 5; retry++) {
      const response = await nilauth.subscriptionStatus();
      if (!response.subscribed) {
        try {
          await this._options.nilauth.payAndValidate();
          return;
        } catch (_error) {
          console.log(
            "Retrying to pay and validate the subscription after 200ms",
          );
          await new Promise((f) => setTimeout(f, 200));
        }
      }
    }
  }

  async createInvocationToken(): Promise<string> {
    const response = await this._options.nilauth.requestToken();
    const { token: rootToken } = response;
    return NucTokenBuilder.extending(rootToken)
      .proof(rootToken)
      .audience(Did.fromHex(this._options.node.keypair.publicKey("hex")))
      .body(new InvocationBody({}))
      .build(this.keypair.privateKey());
  }

  async getRootToken(): Promise<NucTokenEnvelope> {
    const response = await this._options.nilauth.requestToken();
    return response.token;
  }

  override async request<T>(
    path: string,
    options: {
      method?: "GET" | "POST" | "DELETE";
      body?: T;
    } = {},
  ): Promise<Response> {
    const { method = "GET", body } = options;
    const token = await this.createInvocationToken();

    const init: RequestInit = {
      method,
    };

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };

    if (body) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }

    init.headers = headers;

    return this.app.request(path, init);
  }

  async register(
    c: FixtureContext,
    body: RegisterAccountRequest,
    expectations?: { success: true },
  ): Promise<undefined>;
  async register(
    c: FixtureContext,
    body: RegisterAccountRequest,
    expectations: { success: false; errors: string[]; status: number },
  ): Promise<ApiErrorResponse>;
  async register(
    c: FixtureContext,
    body: RegisterAccountRequest,
    expectations: ResponseExpectations = { success: true },
  ): Promise<undefined | ApiErrorResponse> {
    return handleTestResponse<undefined>(
      c,
      {
        request: () =>
          this.request(PathsV1.accounts.register, {
            method: "POST",
            body,
          }),
        successStatus: StatusCodes.CREATED,
      },
      expectations,
    );
  }

  async getProfile(
    c: FixtureContext,
    expectations?: { success: true },
  ): Promise<GetProfileResponse>;
  async getProfile(
    c: FixtureContext,
    expectations: { success: false; errors: string[]; status: number },
  ): Promise<ApiErrorResponse>;
  async getProfile(
    c: FixtureContext,
    expectations: ResponseExpectations = { success: true },
  ): Promise<GetProfileResponse | ApiErrorResponse> {
    return handleTestResponse<GetProfileResponse>(
      c,
      {
        request: () => this.request(PathsV1.accounts.me),
        successStatus: StatusCodes.OK,
        parseSuccess: (json) => {
          const result = GetProfileResponse.safeParse(json);
          c.expect(result.success).toBe(true);
          return result.data as GetProfileResponse;
        },
      },
      expectations,
    );
  }

  async updateProfile(
    c: FixtureContext,
    body: UpdateProfileRequest,
    expectations?: { success: true },
  ): Promise<undefined>;
  async updateProfile(
    c: FixtureContext,
    body: UpdateProfileRequest,
    expectations: { success: false; errors: string[]; status: number },
  ): Promise<ApiErrorResponse>;
  async updateProfile(
    c: FixtureContext,
    body: UpdateProfileRequest,
    expectations: ResponseExpectations = { success: true },
  ): Promise<undefined | ApiErrorResponse> {
    // Special case: this endpoint always returns 501 Not Implemented
    if (expectations.success) {
      const response = await this.request(PathsV1.accounts.me, {
        method: "POST",
        body,
      });
      c.expect(response.ok).toBe(false);
      c.expect(response.status).toBe(StatusCodes.NOT_IMPLEMENTED);
      return undefined;
    }

    return handleTestResponse<undefined>(
      c,
      {
        request: () =>
          this.request(PathsV1.accounts.me, {
            method: "POST",
            body,
          }),
        successStatus: StatusCodes.OK, // placeholder, not used
      },
      expectations,
    );
  }

  async deleteAccount(
    c: FixtureContext,
    expectations?: { success: true },
  ): Promise<undefined>;
  async deleteAccount(
    c: FixtureContext,
    expectations: { success: false; errors: string[]; status: number },
  ): Promise<ApiErrorResponse>;
  async deleteAccount(
    c: FixtureContext,
    expectations: ResponseExpectations = { success: true },
  ): Promise<undefined | ApiErrorResponse> {
    return handleTestResponse<undefined>(
      c,
      {
        request: () =>
          this.request(PathsV1.accounts.me, {
            method: "DELETE",
          }),
        successStatus: StatusCodes.NO_CONTENT,
      },
      expectations,
    );
  }

  async listSchemas(): Promise<Response> {
    return this.request(PathsV1.schemas.root);
  }

  async getSchemaMetadata(id: UuidDto): Promise<Response> {
    return this.request(PathsV1.schemas.byIdMeta.replace(":id", id));
  }

  async addSchema(body: AddSchemaRequest): Promise<Response> {
    return this.request(PathsV1.schemas.root, {
      method: "POST",
      body,
    });
  }

  async deleteSchema(body: DeleteSchemaRequest): Promise<Response> {
    return this.request(PathsV1.schemas.root, {
      method: "DELETE",
      body,
    });
  }

  async listQueries(): Promise<Response> {
    return this.request(PathsV1.queries.root);
  }

  async addQuery(body: AddQueryRequest): Promise<Response> {
    return this.request(PathsV1.queries.root, {
      method: "POST",
      body,
    });
  }

  async deleteQuery(body: DeleteQueryRequest): Promise<Response> {
    return this.request(PathsV1.queries.root, {
      method: "DELETE",
      body,
    });
  }

  async executeQuery(body: ExecuteQueryRequest): Promise<Response> {
    return this.request(PathsV1.queries.execute, {
      method: "POST",
      body,
    });
  }

  async getQueryJob(body: QueryJobRequest): Promise<Response> {
    return this.request(PathsV1.queries.job, {
      method: "POST",
      body,
    });
  }

  async uploadData(body: UploadDataRequest): Promise<Response> {
    return this.request(PathsV1.data.upload, {
      method: "POST",
      body,
    });
  }

  async deleteData(body: DeleteDataRequest): Promise<Response> {
    return this.request(PathsV1.data.delete, {
      method: "POST",
      body,
    });
  }

  async flushData(body: FlushDataRequest): Promise<Response> {
    return this.request(PathsV1.data.flush, {
      method: "POST",
      body,
    });
  }

  async tailData(body: TailDataRequest): Promise<Response> {
    return this.request(PathsV1.data.tail, {
      method: "POST",
      body,
    });
  }

  async readData(body: ReadDataRequest): Promise<Response> {
    return this.request(PathsV1.data.read, {
      method: "POST",
      body,
    });
  }

  async updateData(body: UpdateDataRequest): Promise<Response> {
    return this.request(PathsV1.data.update, {
      method: "POST",
      body,
    });
  }

  async readUserData(): Promise<Response> {
    return this.request(PathsV1.user.data, {
      method: "POST",
      body: {
        userId: this._options.node.keypair.toDidString(),
      },
    });
  }
}
