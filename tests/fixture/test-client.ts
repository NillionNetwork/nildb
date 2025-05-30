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
import type {
  RegisterAccountRequest,
  SetPublicKeyRequest,
} from "#/accounts/accounts.types";
import type {
  AdminSetLogLevelRequest,
  AdminSetMaintenanceWindowRequest,
} from "#/admin/admin.types";
import type { App } from "#/app";
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

  async register(body: RegisterAccountRequest): Promise<Response> {
    return this.request(PathsV1.accounts.root, {
      method: "POST",
      body,
    });
  }

  async getAccount(): Promise<Response> {
    return this.request(PathsV1.accounts.root);
  }

  async updateAccount(body: SetPublicKeyRequest): Promise<Response> {
    return this.request(PathsV1.accounts.publicKey, { method: "POST", body });
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
}
