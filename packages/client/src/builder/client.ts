import type { NilauthClient } from "@nillion/nilauth-client";
import {
  type CreateCollectionIndexRequest,
  type CreateCollectionRequest,
  CreateDataResponse,
  type CreateOwnedDataRequest,
  type CreateQueryRequest,
  type CreateStandardDataRequest,
  type DeleteDataRequest,
  DeleteDataResponse,
  type FindDataRequest,
  FindDataResponse,
  ListCollectionsResponse,
  type PaginationQuery,
  PathsV1,
  ReadCollectionMetadataResponse,
  ReadProfileResponse,
  ReadQueriesResponse,
  ReadQueryResponse,
  ReadQueryRunByIdResponse,
  type RegisterBuilderRequest,
  type Result,
  type RunQueryRequest,
  RunQueryResponse,
  TailDataResponse,
  type UpdateDataRequest,
  UpdateDataResponse,
  type UpdateProfileRequest,
  type UuidDto,
} from "@nillion/nildb-types";
import { Builder, Did, type Envelope, type Signer } from "@nillion/nuc";

import type { HttpClient } from "../types.js";

type BuilderClientOptions = {
  baseUrl: string;
  signer: Signer;
  nodePublicKey: string;
  nilauth: NilauthClient;
  httpClient?: HttpClient;
};

export class BuilderClient {
  private httpClient: HttpClient;
  private nilauth: NilauthClient;

  constructor(private options: BuilderClientOptions) {
    this.httpClient = options.httpClient ?? fetch.bind(globalThis);
    this.nilauth = options.nilauth;
  }

  private async createToken(): Promise<string> {
    const response = await this.nilauth.requestToken(this.options.signer, "nildb");
    const { token: rootToken } = response;

    const nodeDid = Did.fromPublicKey(this.options.nodePublicKey);

    return await Builder.invocationFrom(rootToken)
      .audience(nodeDid)
      .expiresIn(60 * 1000)
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

  async getRootToken(): Promise<Result<Envelope>> {
    try {
      const response = await this.nilauth.requestToken(this.options.signer, "nildb");
      return { ok: true, data: response.token };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async register(body: RegisterBuilderRequest): Promise<Result<void>> {
    try {
      const url = new URL(PathsV1.builders.register, this.options.baseUrl);
      const response = await this.httpClient(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          ok: false,
          error: errorText,
          status: response.status,
        };
      }

      return { ok: true, data: undefined };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async getProfile(): Promise<Result<ReadProfileResponse>> {
    const result = await this.request(PathsV1.builders.me);
    if (!result.ok) {
      return result;
    }

    try {
      const data = await result.data.json();
      const parsed = ReadProfileResponse.safeParse(data);

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

  async updateProfile(body: UpdateProfileRequest): Promise<Result<void>> {
    const result = await this.request(PathsV1.builders.me, {
      method: "POST",
      body,
    });
    if (!result.ok) {
      return result;
    }
    return { ok: true, data: undefined };
  }

  async deleteBuilder(): Promise<Result<void>> {
    const result = await this.request(PathsV1.builders.me, {
      method: "DELETE",
    });
    if (!result.ok) {
      return result;
    }
    return { ok: true, data: undefined };
  }

  async createCollection(body: CreateCollectionRequest): Promise<Result<void>> {
    const result = await this.request(PathsV1.collections.root, {
      method: "POST",
      body,
    });
    if (!result.ok) {
      return result;
    }
    return { ok: true, data: undefined };
  }

  async readCollections(pagination?: PaginationQuery): Promise<Result<ListCollectionsResponse>> {
    const query = new URLSearchParams();
    if (pagination?.limit) {
      query.set("limit", String(pagination.limit));
    }
    if (pagination?.offset) {
      query.set("offset", String(pagination.offset));
    }
    const queryString = query.toString();
    const path = queryString ? `${PathsV1.collections.root}?${queryString}` : PathsV1.collections.root;

    const result = await this.request(path);
    if (!result.ok) {
      return result;
    }

    try {
      const data = await result.data.json();
      const parsed = ListCollectionsResponse.safeParse(data);

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

  async deleteCollection(collectionId: string): Promise<Result<void>> {
    const result = await this.request(PathsV1.collections.byId.replace(":id", collectionId), {
      method: "DELETE",
    });
    if (!result.ok) {
      return result;
    }
    return { ok: true, data: undefined };
  }

  async readCollection(collectionId: string): Promise<Result<ReadCollectionMetadataResponse>> {
    const result = await this.request(PathsV1.collections.byId.replace(":id", collectionId));
    if (!result.ok) {
      return result;
    }

    try {
      const data = await result.data.json();
      const parsed = ReadCollectionMetadataResponse.safeParse(data);

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

  async createCollectionIndex(collectionId: string, body: CreateCollectionIndexRequest): Promise<Result<void>> {
    const result = await this.request(PathsV1.collections.indexesById.replace(":id", collectionId), {
      method: "POST",
      body,
    });
    if (!result.ok) {
      return result;
    }
    return { ok: true, data: undefined };
  }

  async dropCollectionIndex(collectionId: string, indexName: string): Promise<Result<void>> {
    const result = await this.request(
      PathsV1.collections.indexesByNameById.replace(":id", collectionId).replace(":name", indexName),
      { method: "DELETE" },
    );
    if (!result.ok) {
      return result;
    }
    return { ok: true, data: undefined };
  }

  async getQueries(pagination?: PaginationQuery): Promise<Result<ReadQueriesResponse>> {
    const query = new URLSearchParams();
    if (pagination?.limit) {
      query.set("limit", String(pagination.limit));
    }
    if (pagination?.offset) {
      query.set("offset", String(pagination.offset));
    }
    const queryString = query.toString();
    const path = queryString ? `${PathsV1.queries.root}?${queryString}` : PathsV1.queries.root;

    const result = await this.request(path);
    if (!result.ok) {
      return result;
    }

    try {
      const data = await result.data.json();
      const parsed = ReadQueriesResponse.safeParse(data);

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

  async getQuery(queryId: string): Promise<Result<ReadQueryResponse>> {
    const result = await this.request(PathsV1.queries.byId.replace(":id", queryId));
    if (!result.ok) {
      return result;
    }

    try {
      const data = await result.data.json();
      const parsed = ReadQueryResponse.safeParse(data);

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

  async createQuery(body: CreateQueryRequest): Promise<Result<void>> {
    const result = await this.request(PathsV1.queries.root, {
      method: "POST",
      body,
    });
    if (!result.ok) {
      return result;
    }
    return { ok: true, data: undefined };
  }

  async deleteQuery(queryId: string): Promise<Result<void>> {
    const result = await this.request(PathsV1.queries.byId.replace(":id", queryId), {
      method: "DELETE",
    });
    if (!result.ok) {
      return result;
    }
    return { ok: true, data: undefined };
  }

  async runQuery(body: RunQueryRequest): Promise<Result<RunQueryResponse>> {
    const result = await this.request(PathsV1.queries.run, {
      method: "POST",
      body,
    });
    if (!result.ok) {
      return result;
    }

    try {
      const data = await result.data.json();
      const parsed = RunQueryResponse.safeParse(data);

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

  async readQueryRunResults(
    runId: string,
    pagination?: { limit?: number; offset?: number },
  ): Promise<Result<ReadQueryRunByIdResponse>> {
    const url = new URL(PathsV1.queries.runById.replace(":id", runId), "http://localhost");
    if (pagination) {
      if (pagination.limit !== undefined) {
        url.searchParams.set("limit", pagination.limit.toString());
      }
      if (pagination.offset !== undefined) {
        url.searchParams.set("offset", pagination.offset.toString());
      }
    }

    const result = await this.request(url.pathname + url.search);
    if (!result.ok) {
      return result;
    }

    try {
      const data = await result.data.json();
      const parsed = ReadQueryRunByIdResponse.safeParse(data);

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

  async createOwnedData(body: CreateOwnedDataRequest): Promise<Result<CreateDataResponse>> {
    const result = await this.request(PathsV1.data.createOwned, {
      method: "POST",
      body,
    });
    if (!result.ok) {
      return result;
    }

    try {
      const data = await result.data.json();
      const parsed = CreateDataResponse.safeParse(data);

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

  async createStandardData(body: CreateStandardDataRequest): Promise<Result<CreateDataResponse>> {
    const result = await this.request(PathsV1.data.createStandard, {
      method: "POST",
      body,
    });
    if (!result.ok) {
      return result;
    }

    try {
      const data = await result.data.json();
      const parsed = CreateDataResponse.safeParse(data);

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

  async findData(body: FindDataRequest): Promise<Result<FindDataResponse>> {
    const result = await this.request(PathsV1.data.find, {
      method: "POST",
      body,
    });
    if (!result.ok) {
      return result;
    }

    try {
      const data = await result.data.json();
      const parsed = FindDataResponse.safeParse(data);

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

  async updateData(body: UpdateDataRequest): Promise<Result<UpdateDataResponse>> {
    const result = await this.request(PathsV1.data.update, {
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

  async deleteData(body: DeleteDataRequest): Promise<Result<DeleteDataResponse>> {
    const result = await this.request(PathsV1.data.delete, {
      method: "POST",
      body,
    });
    if (!result.ok) {
      return result;
    }

    try {
      const data = await result.data.json();
      const parsed = DeleteDataResponse.safeParse(data);

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

  async flushData(collectionId: string): Promise<Result<void>> {
    const result = await this.request(PathsV1.data.flushById.replace(":id", collectionId), {
      method: "DELETE",
    });
    if (!result.ok) {
      return result;
    }
    return { ok: true, data: undefined };
  }

  async tailData(collection: UuidDto, limit = 10): Promise<Result<TailDataResponse>> {
    const result = await this.request(`${PathsV1.data.tailById.replace(":id", collection)}?limit=${limit}`);
    if (!result.ok) {
      return result;
    }

    try {
      const data = await result.data.json();
      const parsed = TailDataResponse.safeParse(data);

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
}
