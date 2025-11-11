import {
  PathsV1,
  ReadAboutNodeResponse,
  ReadLogLevelResponse,
  type Result,
  type SetLogLevelRequest,
} from "@nillion/nildb-types";
import { Builder, Did, type Envelope, type Signer } from "@nillion/nuc";
import type { HttpClient } from "../types.js";

type AdminClientOptions = {
  baseUrl: string;
  signer: Signer;
  nodePublicKey: string;
  nodeDelegation: Envelope;
  httpClient?: HttpClient;
};

export class AdminClient {
  private httpClient: HttpClient;
  private nodeDelegation: Envelope;

  constructor(private options: AdminClientOptions) {
    this.httpClient = options.httpClient ?? fetch.bind(globalThis);
    this.nodeDelegation = options.nodeDelegation;
  }

  private async createToken(): Promise<string> {
    const nodeDid = Did.fromPublicKey(this.options.nodePublicKey);
    return await Builder.invocationFrom(this.nodeDelegation)
      .audience(nodeDid)
      .signAndSerialize(this.options.signer);
  }

  private async request<T>(
    path: string,
    options: { method?: "GET" | "POST" | "DELETE"; body?: T } = {},
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

  async health(): Promise<Result<string>> {
    try {
      const url = new URL(
        PathsV1.system.health,
        this.options.baseUrl,
      ).toString();
      const response = await this.httpClient(url);

      if (!response.ok) {
        const errorText = await response.text();
        return {
          ok: false,
          error: errorText,
          status: response.status,
        };
      }

      const data = await response.text();
      return { ok: true, data };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async about(): Promise<Result<ReadAboutNodeResponse>> {
    try {
      const url = new URL(
        PathsV1.system.about,
        this.options.baseUrl,
      ).toString();
      const response = await this.httpClient(url);

      if (!response.ok) {
        const errorText = await response.text();
        return {
          ok: false,
          error: errorText,
          status: response.status,
        };
      }

      const data = await response.json();
      const parsed = ReadAboutNodeResponse.safeParse(data);

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

  async startMaintenance(): Promise<Result<void>> {
    const result = await this.request(PathsV1.system.maintenanceStart, {
      method: "POST",
    });
    if (!result.ok) {
      return result;
    }
    return { ok: true, data: undefined };
  }

  async stopMaintenance(): Promise<Result<void>> {
    const result = await this.request(PathsV1.system.maintenanceStop, {
      method: "POST",
    });
    if (!result.ok) {
      return result;
    }
    return { ok: true, data: undefined };
  }

  async getLogLevel(): Promise<Result<ReadLogLevelResponse>> {
    const result = await this.request(PathsV1.system.logLevel);
    if (!result.ok) {
      return result;
    }

    try {
      const data = await result.data.json();
      const parsed = ReadLogLevelResponse.safeParse(data);

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

  async setLogLevel(body: SetLogLevelRequest): Promise<Result<void>> {
    const result = await this.request(PathsV1.system.logLevel, {
      method: "POST",
      body,
    });
    if (!result.ok) {
      return result;
    }
    return { ok: true, data: undefined };
  }
}
