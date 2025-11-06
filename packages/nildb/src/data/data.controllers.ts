import type { BuilderDocument } from "@nildb/builders/builders.types";
import { GrantAccessError } from "@nildb/common/errors";
import { handleTaggedErrors } from "@nildb/common/handler";
import { NucCmd } from "@nildb/common/nuc-cmd-tree";
import { OpenApiSpecCommonErrorResponses } from "@nildb/common/openapi";
import { PathsV1 } from "@nildb/common/paths";
import type { ControllerOptions } from "@nildb/common/types";
import {
  loadNucToken,
  loadSubjectAndVerifyAsBuilder,
  requireNucNamespace,
} from "@nildb/middleware/capability.middleware";
import { Effect as E, pipe } from "effect";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { describeRoute, resolver, validator as zValidator } from "hono-openapi";
import { StatusCodes } from "http-status-codes";
import {
  CreateDataResponse,
  CreateOwnedDataRequest,
  CreateStandardDataRequest,
  DataSchemaByIdRequestParams,
  DeleteDataRequest,
  DeleteDataResponse,
  FindDataRequest,
  FindDataResponse,
  type FlushDataResponse,
  TailDataRequestParams,
  TailDataRequestQuery,
  TailDataResponse,
  UpdateDataRequest,
  UpdateDataResponse,
} from "./data.dto.js";
import { DataMapper } from "./data.mapper.js";
import * as DataService from "./data.services.js";
import type { UploadResult } from "./data.types.js";

/**
 * Determines the appropriate HTTP status code for a bulk creation result.
 * - 201 Created: All items were created successfully.
 * - 207 Multi-Status: A mix of successful creations and errors occurred.
 * - 400 Bad Request: All items failed to be created.
 * - 200 OK: No items were processed (e.g., empty input array).
 */
function getBulkCreateStatus(result: UploadResult): ContentfulStatusCode {
  const hasErrors = result.errors.length > 0;
  const hasCreated = result.created.length > 0;

  if (hasCreated && !hasErrors) {
    return StatusCodes.CREATED;
  }
  if (hasCreated && hasErrors) {
    return StatusCodes.MULTI_STATUS;
  }
  if (!hasCreated && hasErrors) {
    return StatusCodes.BAD_REQUEST;
  }
  return StatusCodes.OK;
}

/**
 * Register POST /v1/data/delete
 */
export function deleteData(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.data.delete;

  app.post(
    path,
    describeRoute({
      tags: ["Data"],
      security: [{ bearerAuth: [] }],
      summary: "Delete data",
      responses: {
        200: {
          description: "Success",
          content: {
            "application/json": {
              schema: resolver(DeleteDataResponse),
            },
          },
        },
        ...OpenApiSpecCommonErrorResponses,
      },
    }),
    zValidator("json", DeleteDataRequest),
    loadNucToken(bindings),
    loadSubjectAndVerifyAsBuilder(bindings),
    requireNucNamespace(NucCmd.nil.db.data.delete),
    async (c) => {
      const builder = c.get("builder");
      const payload = c.req.valid("json");
      const command = DataMapper.toDeleteDataCommand(payload, builder.did);

      return pipe(
        DataService.deleteData(c.env, command),
        E.map((result) => DataMapper.toDeleteDataResponse(result)),
        E.map((response) => c.json<DeleteDataResponse>(response)),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

/**
 * Register DELETE /v1/data/:id/flush
 */
export function flushData(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.data.flushById;

  app.delete(
    path,
    describeRoute({
      tags: ["Data"],
      security: [{ bearerAuth: [] }],
      summary: "Flush data",
      responses: {
        204: {
          description: "Success",
        },
        ...OpenApiSpecCommonErrorResponses,
      },
    }),
    zValidator("param", DataSchemaByIdRequestParams),
    loadNucToken(bindings),
    loadSubjectAndVerifyAsBuilder(bindings),
    requireNucNamespace(NucCmd.nil.db.data.delete),
    async (c) => {
      const builder = c.get("builder");
      const params = c.req.valid("param");
      const command = DataMapper.toFlushDataCommand(params, builder.did);

      return pipe(
        DataService.flushCollection(c.env, command),
        E.map(() => c.text<FlushDataResponse>("")),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

/**
 * Register POST /v1/data/find
 */
export function findData(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.data.find;

  app.post(
    path,
    describeRoute({
      tags: ["Data"],
      security: [{ bearerAuth: [] }],
      summary: "Find data",
      responses: {
        200: {
          description: "Success",
          content: {
            "application/json": {
              schema: resolver(FindDataResponse),
            },
          },
        },
        ...OpenApiSpecCommonErrorResponses,
      },
    }),
    zValidator("json", FindDataRequest),
    loadNucToken(bindings),
    loadSubjectAndVerifyAsBuilder(bindings),
    requireNucNamespace(NucCmd.nil.db.data.read),
    async (c) => {
      const builder = c.get("builder");
      const payload = c.req.valid("json");
      const command = DataMapper.toFindDataCommand(payload, builder.did);

      return pipe(
        DataService.findRecords(c.env, command),
        E.map((documents) => DataMapper.toFindDataResponse(documents)),
        E.map((response) => c.json<FindDataResponse>(response)),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

/**
 * Register GET /v1/data/:id/tail?limit=1
 */
export function tailData(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.data.tailById;

  app.get(
    path,
    describeRoute({
      tags: ["Data"],
      security: [{ bearerAuth: [] }],
      summary: "Tail data",
      responses: {
        200: {
          description: "Recent records retrieved successfully",
          content: {
            "application/json": {
              schema: resolver(TailDataResponse),
            },
          },
        },
        ...OpenApiSpecCommonErrorResponses,
      },
    }),
    zValidator("param", TailDataRequestParams),
    zValidator("query", TailDataRequestQuery),
    loadNucToken(bindings),
    loadSubjectAndVerifyAsBuilder(bindings),
    requireNucNamespace(NucCmd.nil.db.data.read),
    async (c) => {
      const builder = c.get("builder") as BuilderDocument;
      const param = c.req.valid("param");
      const query = c.req.valid("query");
      const command = DataMapper.toRecentDataCommand(param, query, builder.did);

      return pipe(
        DataService.tailData(c.env, command),
        E.map((documents) => DataMapper.toTailDataResponse(documents)),
        E.map((response) => c.json<TailDataResponse>(response)),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

/**
 * Register POST /v1/data/update
 */
export function updateData(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.data.update;

  app.post(
    path,
    describeRoute({
      tags: ["Data"],
      security: [{ bearerAuth: [] }],
      summary: "Update data",
      responses: {
        200: {
          description: "Success",
          content: {
            "application/json": {
              schema: resolver(UpdateDataResponse),
            },
          },
        },
        ...OpenApiSpecCommonErrorResponses,
      },
    }),
    zValidator("json", UpdateDataRequest),
    loadNucToken(bindings),
    loadSubjectAndVerifyAsBuilder(bindings),
    requireNucNamespace(NucCmd.nil.db.data.update),
    async (c) => {
      const builder = c.get("builder") as BuilderDocument;
      const payload = c.req.valid("json");
      const command = DataMapper.toUpdateDataCommand(payload, builder.did);

      return pipe(
        DataService.updateRecords(c.env, command),
        E.map((result) => DataMapper.toUpdateDataResponse(result)),
        E.map((response) => c.json<UpdateDataResponse>(response)),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

/**
 * Register POST /v1/data/owned
 */
export function createOwnedData(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.data.createOwned;

  app.post(
    path,
    describeRoute({
      tags: ["Data"],
      security: [{ bearerAuth: [] }],
      summary: "Upload owned data",
      responses: {
        201: {
          description: "Created - All items were successfully created",
          content: {
            "application/json": {
              schema: resolver(CreateDataResponse),
            },
          },
        },
        207: {
          description:
            "Multi-Status - Partial success (mix of successes and errors)",
          content: {
            "application/json": {
              schema: resolver(CreateDataResponse),
            },
          },
        },
        ...OpenApiSpecCommonErrorResponses,
        400: {
          description: "Bad Request - All items failed to be created",
          content: {
            "application/json": {
              schema: resolver(CreateDataResponse),
            },
          },
        },
      },
    }),
    zValidator("json", CreateOwnedDataRequest),
    loadNucToken(bindings),
    loadSubjectAndVerifyAsBuilder(bindings),
    requireNucNamespace(NucCmd.nil.db.data.create),
    async (c) => {
      const builder = c.get("builder") as BuilderDocument;
      const payload = c.req.valid("json");
      const command = DataMapper.toCreateOwnedRecordsCommand(
        payload,
        builder.did,
        c.env.log,
      );

      // Validate that at least one permission is granted
      if (!command.acl.read && !command.acl.write && !command.acl.execute) {
        return pipe(
          E.fail(
            new GrantAccessError({
              type: "collection",
              id: command.collection.toString(),
              acl: command.acl,
            }),
          ),
          handleTaggedErrors(c),
          E.runPromise,
        );
      }

      return pipe(
        DataService.createOwnedRecords(c.env, command),
        E.map((result) => {
          const response = DataMapper.toCreateDataResponse(result);
          const status = getBulkCreateStatus(result);
          return c.json(response, status);
        }),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

/**
 * Register POST /v1/data/standard
 */
export function createStandardData(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.data.createStandard;

  app.post(
    path,
    describeRoute({
      tags: ["Data"],
      security: [{ bearerAuth: [] }],
      summary: "Upload standard data",
      responses: {
        201: {
          description: "Created - All items were successfully created",
          content: {
            "application/json": {
              schema: resolver(CreateDataResponse),
            },
          },
        },
        207: {
          description:
            "Multi-Status - Partial success (mix of successes and errors)",
          content: {
            "application/json": {
              schema: resolver(CreateDataResponse),
            },
          },
        },
        ...OpenApiSpecCommonErrorResponses,
        400: {
          description: "Bad Request - All items failed to be created",
          content: {
            "application/json": {
              schema: resolver(CreateDataResponse),
            },
          },
        },
      },
    }),
    zValidator("json", CreateStandardDataRequest),
    loadNucToken(bindings),
    loadSubjectAndVerifyAsBuilder(bindings),
    requireNucNamespace(NucCmd.nil.db.data.create),
    async (c) => {
      const builder = c.get("builder") as BuilderDocument;
      const payload = c.req.valid("json");
      const command = DataMapper.toCreateStandardRecordsCommand(
        payload,
        builder.did,
      );

      return pipe(
        DataService.createStandardRecords(c.env, command),
        E.map((result) => {
          const response = DataMapper.toCreateDataResponse(result);
          const status = getBulkCreateStatus(result);
          return c.json(response, status);
        }),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}
