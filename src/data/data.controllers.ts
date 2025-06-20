import { Effect as E, pipe } from "effect";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import * as BuildersService from "#/builders/builders.services";
import type { BuilderDocument } from "#/builders/builders.types";
import { handleTaggedErrors } from "#/common/handler";
import { NucCmd } from "#/common/nuc-cmd-tree";
import { OpenApiSpecCommonErrorResponses } from "#/common/openapi";
import {
  checkGrantAccess,
  enforceCollectionOwnership,
} from "#/common/ownership";
import { PathsV1 } from "#/common/paths";
import type { ControllerOptions } from "#/common/types";
import {
  loadNucToken,
  loadSubjectAndVerifyAsBuilder,
  requireNucNamespace,
} from "#/middleware/capability.middleware";
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
} from "./data.dto";
import { DataMapper } from "./data.mapper";
import * as DataService from "./data.services";

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
      const command = DataMapper.toDeleteDataCommand(payload);

      return pipe(
        enforceCollectionOwnership(builder, command.collection),
        E.flatMap(() => DataService.deleteData(c.env, command)),
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
      const command = DataMapper.toFlushDataCommand(params);

      return pipe(
        enforceCollectionOwnership(builder, command.collection),
        E.flatMap(() => DataService.flushCollection(c.env, command)),
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
      const command = DataMapper.toFindDataCommand(payload);

      return pipe(
        enforceCollectionOwnership(builder, command.collection),
        E.flatMap(() => DataService.findRecords(c.env, command)),
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
      const command = DataMapper.toRecentDataCommand(param, query);

      return pipe(
        enforceCollectionOwnership(builder, command.collection),
        E.flatMap(() => DataService.tailData(c.env, command)),
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
      const command = DataMapper.toUpdateDataCommand(payload);

      return pipe(
        enforceCollectionOwnership(builder, command.collection),
        E.flatMap(() => DataService.updateRecords(c.env, command)),
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
        200: {
          description: "OK",
          content: {
            "application/json": {
              schema: resolver(CreateDataResponse),
            },
          },
        },
        ...OpenApiSpecCommonErrorResponses,
      },
    }),
    zValidator("json", CreateOwnedDataRequest),
    loadNucToken(bindings),
    loadSubjectAndVerifyAsBuilder(bindings),
    requireNucNamespace(NucCmd.nil.db.data.create),
    async (c) => {
      const builder = c.get("builder") as BuilderDocument;
      const payload = c.req.valid("json");
      const command = DataMapper.toCreateOwnedRecordsCommand(payload);

      return pipe(
        enforceCollectionOwnership(builder, command.collection),
        E.flatMap(() => BuildersService.find(c.env, command.acl.grantee)),
        E.flatMap((builder) =>
          checkGrantAccess(builder, command.collection, command.acl),
        ),
        E.flatMap(() => DataService.createOwnedRecords(c.env, command)),
        E.map((result) => DataMapper.toCreateDataResponse(result)),
        E.map((response) => c.json<CreateDataResponse>(response)),
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
        200: {
          description: "OK",
          content: {
            "application/json": {
              schema: resolver(CreateDataResponse),
            },
          },
        },
        ...OpenApiSpecCommonErrorResponses,
      },
    }),
    zValidator("json", CreateStandardDataRequest),
    loadNucToken(bindings),
    loadSubjectAndVerifyAsBuilder(bindings),
    requireNucNamespace(NucCmd.nil.db.data.create),
    async (c) => {
      const builder = c.get("builder") as BuilderDocument;
      const payload = c.req.valid("json");
      const command = DataMapper.toCreateStandardRecordsCommand(payload);

      return pipe(
        enforceCollectionOwnership(builder, command.collection),
        E.flatMap(() => DataService.createStandardRecords(c.env, command)),
        E.map((result) => DataMapper.toCreateDataResponse(result)),
        E.map((response) => c.json<CreateDataResponse>(response)),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}
