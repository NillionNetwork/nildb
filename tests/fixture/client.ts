import type { Hono } from "hono";
import pino from "pino";
import type { AppEnv } from "#/app";
import type { AddQueryPath } from "#/handlers/handle-add-query";
import type { AddSchemaPath } from "#/handlers/handle-add-schema";
import type {
  CreateOrgPath,
  CreateOrgReqBody,
} from "#/handlers/handle-create-org";
import type {
  CreateUserPath,
  CreateUserReqBody,
} from "#/handlers/handle-create-user";
import type { DeleteOrgPath } from "#/handlers/handle-delete-org";
import type { DeleteQueryPath } from "#/handlers/handle-delete-query";
import type { DeleteSchemaPath } from "#/handlers/handle-delete-schema";
import type { DeleteUserPath } from "#/handlers/handle-delete-user";
import type { GenerateOrgApiKeyPath } from "#/handlers/handle-generate-api-key";
import type { HealthCheckPath } from "#/handlers/handle-health-check";
import type { ListOrgsPath } from "#/handlers/handle-list-orgs";
import type { ListQueriesPath } from "#/handlers/handle-list-queries";
import type { ListSchemasPath } from "#/handlers/handle-list-schemas";
import type {
  RunQueryPath,
  RunQueryResBody,
} from "#/handlers/handle-run-query";
import type { UploadDataPath } from "#/handlers/handle-upload-data";
import type { UserLoginPath } from "#/handlers/handle-user-login";
import type { OrgDocument, OrgQuery } from "#/models/orgs";
import type { UserDocument } from "#/models/users";

export type TestClientOptions = {
  app: Hono<AppEnv>;
  email: string;
  password: string;
  type: "root" | "admin" | "backend";
  jwt: string;
};

const apiV1 = "/api/v1";

export class TestClient {
  _log = pino();

  // biome-ignore lint:
  constructor(public _options: TestClientOptions) {}

  get app(): Hono<AppEnv> {
    return this._options.app;
  }

  get email(): string {
    return this._options.email;
  }

  get password(): string {
    return this._options.password;
  }

  set jwt(value: string) {
    this._options.jwt = value;
  }

  get jwt() {
    return this._options.jwt;
  }

  async health(): Promise<"OK"> {
    const path: HealthCheckPath = "/health";
    const response = await this.app.request(path);
    return (await response.text()) as "OK";
  }

  async login(): Promise<{ token: string }> {
    const path: UserLoginPath = `${apiV1}/auth/login`;
    const response = await this.app.request(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: this._options.email,
        password: this._options.password,
      }),
    });

    const body = await response.json();
    return body as { token: string };
  }

  async createUser(user: CreateUserReqBody): Promise<{ data: UserDocument }> {
    const path: CreateUserPath = `${apiV1}/users`;
    const response = await this.app.request(path, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.jwt}`,
      },
      body: JSON.stringify(user),
    });

    const body = await response.json();
    return body as { data: UserDocument };
  }

  async deleteUser(email: string): Promise<boolean> {
    const path: DeleteUserPath = `${apiV1}/users`;
    const response = await this.app.request(path, {
      method: "DELETE",
      headers: {
        authorization: `Bearer ${this.jwt}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ email }),
    });

    return response.ok;
  }

  async createOrg(reg: CreateOrgReqBody): Promise<{ data: OrgDocument }> {
    const path: CreateOrgPath = `${apiV1}/orgs`;
    const response = await this.app.request(path, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.jwt}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(reg),
    });

    const body = await response.json();
    return body as { data: OrgDocument };
  }

  async deleteOrg(orgId: string): Promise<boolean> {
    const path: DeleteOrgPath = `${apiV1}/orgs`;
    const response = await this.app.request(path, {
      method: "DELETE",
      headers: {
        authorization: `Bearer ${this.jwt}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ orgId }),
    });

    return response.ok;
  }

  async listOrgs(): Promise<{ data: OrgDocument[] }> {
    const path: ListOrgsPath = `${apiV1}/orgs`;
    const response = await this.app.request(path, {
      method: "GET",
      headers: { authorization: `Bearer ${this.jwt}` },
    });

    const body = await response.json();
    return body as { data: OrgDocument[] };
  }

  async generateApiKey(orgId: string): Promise<{ token: string }> {
    const path: GenerateOrgApiKeyPath = `${apiV1}/orgs/keys/generate`;
    const response = await this.app.request(path, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.jwt}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ orgId }),
    });

    const body = await response.json();
    return body as { token: string };
  }

  async listSchemas(): Promise<{ data: [string, string][] }> {
    const path: ListSchemasPath = `${apiV1}/orgs/schemas`;
    const response = await this.app.request(path, {
      headers: { authorization: `Bearer ${this.jwt}` },
    });

    const body = await response.json();
    return body as { data: [string, string][] };
  }

  async addSchema(body: string): Promise<string> {
    const path: AddSchemaPath = `${apiV1}/orgs/schemas`;
    const response = await this.app.request(path, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.jwt}`,
        "content-type": "application/json",
      },
      body,
    });

    if (!response.ok) {
      throw new Error("Add org schema request failed", { cause: response });
    }
    return await response.text();
  }

  async uploadData(schemaName: string, data: unknown[]): Promise<boolean> {
    const path: UploadDataPath = `${apiV1}/data/upload`;
    const response = await this.app.request(path, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.jwt}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        schemaName,
        data,
      }),
    });

    return response.ok;
  }

  async addQuery(schemaName: string, pipeline: object[]): Promise<string> {
    const path: AddQueryPath = `${apiV1}/orgs/queries`;
    const response = await this.app.request(path, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.jwt}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ schemaName, pipeline }),
    });

    return await response.text();
  }

  async listQueries(): Promise<{ data: (OrgQuery & { name: string })[] }> {
    const path: ListQueriesPath = `${apiV1}/orgs/queries`;
    const response = await this.app.request(path, {
      headers: {
        authorization: `Bearer ${this.jwt}`,
      },
    });

    const body = await response.json();
    return body as { data: (OrgQuery & { name: string })[] };
  }

  async runQuery<T>(queryName: string): Promise<RunQueryResBody<T>> {
    const path: RunQueryPath = `${apiV1}/data/query`;
    const response = await this.app.request(path, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.jwt}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ queryName }),
    });

    return (await response.json()) as unknown as RunQueryResBody<T>;
  }

  async deleteQuery(queryName: string): Promise<boolean> {
    const path: DeleteQueryPath = `${apiV1}/orgs/queries`;
    const response = await this.app.request(path, {
      method: "DELETE",
      headers: {
        authorization: `Bearer ${this.jwt}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ queryName }),
    });

    return response.ok;
  }

  async deleteSchema(schemaName: string): Promise<boolean> {
    const path: DeleteSchemaPath = `${apiV1}/orgs/schemas`;
    const response = await this.app.request(path, {
      method: "DELETE",
      headers: {
        authorization: `Bearer ${this.jwt}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ schemaName }),
    });

    return response.ok;
  }
}
