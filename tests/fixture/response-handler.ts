/** biome-ignore-all lint/nursery/noImportCycles: this a cycle wrt fixture and response handler */
import type { StatusCodes } from "http-status-codes";
import type z from "zod";
import type { ApiErrorResponse } from "#/common/handler";
import type { FixtureContext } from "./fixture";

export class ResponseHandler<TSuccess = unknown> {
  constructor(
    private c: FixtureContext,
    private request: () => Promise<Response> | Response,
    private successStatus: StatusCodes,
    private successSchema?: z.ZodType<TSuccess, any, any>,
  ) {}

  async expectSuccess(): Promise<TSuccess> {
    const response = await this.request();
    // this.c.expect(response.ok).toBe(true);
    // this.c.expect(response.status).toBe(this.successStatus);

    // if failure try and print the error body
    if (!response.ok) {
      const type = response.headers.get("content-type");

      switch (type) {
        case "application/json": {
          const json = await response.json();
          console.log("Json: ", json);
          break;
        }
        case "plain/text": {
          const text = await response.text();
          console.log("Text: ", text);
          break;
        }
        default: {
          break;
        }
      }

      this.c.expect(response.status).toBe(this.successStatus);
    }

    // Handle responses that do not expect a body
    if (!this.successSchema) {
      return undefined as TSuccess;
    }

    const json = await response.json();
    if (this.successSchema) {
      const result = this.successSchema.safeParse(json);
      this.c.expect(result.success).toBe(true);
      return result.data as TSuccess;
    }
    return json as TSuccess;
  }

  async expectFailure(
    status?: StatusCodes,
    ...errors: string[]
  ): Promise<ApiErrorResponse> {
    const response = await this.request();
    this.c.expect(response.ok).toBe(false);
    if (status) {
      this.c.expect(response.status).toBe(status);
    }

    const body = (await response.json()) as ApiErrorResponse;
    for (const message of errors) {
      this.c
        .expect(body.errors)
        .toEqual(
          this.c.expect.arrayContaining([
            this.c.expect.stringContaining(message),
          ]),
        );
    }
    return body;
  }

  async expectStatusCode(statusCode: StatusCodes): Promise<void> {
    const response = await this.request();
    this.c.expect(response.status).toBe(statusCode);
  }
}
