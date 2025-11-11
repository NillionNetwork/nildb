import {
  type GrantAccessToDataRequest,
  ListDataReferencesResponse,
  NucCmd,
  type PaginationQuery,
  PathsV1,
  ReadDataResponse,
  ReadUserProfileResponse,
  type Result,
  type RevokeAccessToDataRequest,
  UpdateDataResponse,
  type UpdateUserDataRequest,
} from "@nillion/nildb-types";
import { Builder, Did, type Signer } from "@nillion/nuc";
import type { HttpClient } from "../types.js";

type UserClientOptions = {
  baseUrl: string;
  signer: Signer;
  nodePublicKey: string;
  httpClient?: HttpClient;
};

export class UserClient {
  private httpClient: HttpClient;

  constructor(private options: UserClientOptions) {
    this.httpClient = options.httpClient ?? fetch.bind(globalThis);
  }

  private async createToken(): Promise<string> {
    const nodeDid = Did.fromPublicKey(this.options.nodePublicKey);
    const did = await this.options.signer.getDid();
    return await Builder.invocation()
      .command(NucCmd.nil.db.users.root)
      .audience(nodeDid)
      .subject(did)
      .signAndSerialize(this.options.signer);
  }

  private async request(
    path: string,
    options: { method?: "GET" | "POST" | "DELETE"; body?: unknown } = {},
  ): Promise<Result<Response>> {
    try {
      const { method = "GET", body } = options;
      const token = await this.createToken();

      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
      };

      if (body) {
        headers["Content-Type"] = "application/json";
      }

      const url = new URL(path, this.options.baseUrl).toString();
      const requestInit: RequestInit = {
        method,
        headers,
      };
      if (body) {
        requestInit.body = JSON.stringify(body);
      }

      const response = await this.httpClient(url, requestInit);

      if (!response.ok) {
        const errorText = await response.text();
        return {
          ok: false,
          error: errorText,
          status: response.status,
        };
      }

      return { ok: true, data: response };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async getProfile(): Promise<Result<ReadUserProfileResponse>> {
    const result = await this.request(PathsV1.users.me);
    if (!result.ok) {
      return result;
    }

    try {
      const data = await result.data.json();
      const parsed = ReadUserProfileResponse.safeParse(data);

      if (!parsed.success) {
        return {
          ok: false,
          error: "Invalid response schema",
        };
      }

      return { ok: true, data: parsed.data };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async listDataReferences(
    pagination?: PaginationQuery,
  ): Promise<Result<ListDataReferencesResponse>> {
    const query = new URLSearchParams();
    if (pagination?.limit) {
      query.set("limit", String(pagination.limit));
    }
    if (pagination?.offset) {
      query.set("offset", String(pagination.offset));
    }
    const queryString = query.toString();
    const path = queryString
      ? `${PathsV1.users.data.root}?${queryString}`
      : PathsV1.users.data.root;

    const result = await this.request(path);
    if (!result.ok) {
      return result;
    }

    try {
      const data = await result.data.json();
      const parsed = ListDataReferencesResponse.safeParse(data);

      if (!parsed.success) {
        return {
          ok: false,
          error: "Invalid response schema",
        };
      }

      return { ok: true, data: parsed.data };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async readData(
    collection: string,
    document: string,
  ): Promise<Result<ReadDataResponse>> {
    const result = await this.request(
      PathsV1.users.data.byId
        .replace(":collection", collection)
        .replace(":document", document),
    );
    if (!result.ok) {
      return result;
    }

    try {
      const data = await result.data.json();
      const parsed = ReadDataResponse.safeParse(data);

      if (!parsed.success) {
        return {
          ok: false,
          error: "Invalid response schema",
        };
      }

      return { ok: true, data: parsed.data };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async updateData(
    body: UpdateUserDataRequest,
  ): Promise<Result<UpdateDataResponse>> {
    const result = await this.request(PathsV1.users.data.root, {
      method: "POST",
      body,
    });
    if (!result.ok) {
      return result;
    }

    try {
      const data = await result.data.json();
      const parsed = UpdateDataResponse.safeParse(data);

      if (!parsed.success) {
        return {
          ok: false,
          error: "Invalid response schema",
        };
      }

      return { ok: true, data: parsed.data };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async deleteData(
    collection: string,
    document: string,
  ): Promise<Result<void>> {
    const result = await this.request(
      PathsV1.users.data.byId
        .replace(":collection", collection)
        .replace(":document", document),
      { method: "DELETE" },
    );
    if (!result.ok) {
      return result;
    }
    return { ok: true, data: undefined };
  }

  async grantAccess(body: GrantAccessToDataRequest): Promise<Result<void>> {
    const result = await this.request(PathsV1.users.data.acl.grant, {
      method: "POST",
      body,
    });
    if (!result.ok) {
      return result;
    }
    return { ok: true, data: undefined };
  }

  async revokeAccess(body: RevokeAccessToDataRequest): Promise<Result<void>> {
    const result = await this.request(PathsV1.users.data.acl.revoke, {
      method: "POST",
      body,
    });
    if (!result.ok) {
      return result;
    }
    return { ok: true, data: undefined };
  }
}
