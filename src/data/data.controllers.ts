import { Effect as E, pipe } from "effect";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import type { BuilderDocument } from "#/builders/builders.types";
import { handleTaggedErrors } from "#/common/handler";
import { NucCmd } from "#/common/nuc-cmd-tree";
import { OpenApiSpecCommonErrorResponses } from "#/common/openapi";
import { enforceSchemaOwnership } from "#/common/ownership";
import { PathsV1 } from "#/common/paths";
import type { ControllerOptions } from "#/common/types";
import {
  enforceCapability,
  loadNucToken,
  loadSubjectAndVerifyAsBuilder,
} from "#/middleware/capability.middleware";
import {
  DeleteDataRequest,
  DeleteDataResponse,
  FlushDataRequest,
  FlushDataResponse,
  ReadDataRequest,
  ReadDataResponse,
  TailDataRequest,
  TailDataResponse,
  UpdateDataRequest,
  UpdateDataResponse,
  UploadDataRequest,
  UploadDataResponse,
} from "./data.dto";
import { DataMapper } from "./data.mapper";
import * as DataService from "./data.services";

export function remove(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.data.delete;

  app.post(
    path,
    describeRoute({
      tags: ["Data"],
      security: [{ bearerAuth: [] }],
      summary: "Delete data records",
      description:
        "Deletes data records matching the provided filter from a schema collection.",
      responses: {
        200: {
          description: "Records deleted successfully",
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
    enforceCapability<{ json: DeleteDataRequest }>({
      path,
      cmd: NucCmd.nil.db.data,
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const builder = c.get("builder") as BuilderDocument;
      const payload = c.req.valid("json");

      const command = DataMapper.toDeleteRecordsCommand(payload);
      return pipe(
        enforceSchemaOwnership(builder, command.schema),
        E.flatMap(() => DataService.deleteRecords(c.env, command)),
        E.map((result) => DataMapper.toDeleteDataResponse(result)),
        E.map((response) => c.json<DeleteDataResponse>(response)),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

export function flush(options: ControllerOptions): void {
  const { app, bindings } = options;

  const path = PathsV1.data.flush;

  app.post(
    path,
    describeRoute({
      tags: ["Data"],
      security: [{ bearerAuth: [] }],
      summary: "Flush all data from schema",
      description: "Removes all data records from a schema collection.",
      responses: {
        200: {
          description: "Collection flushed successfully",
          content: {
            "application/json": {
              schema: resolver(FlushDataResponse),
            },
          },
        },
        ...OpenApiSpecCommonErrorResponses,
      },
    }),
    zValidator("json", FlushDataRequest),
    loadNucToken(bindings),
    loadSubjectAndVerifyAsBuilder(bindings),
    enforceCapability<{ json: FlushDataRequest }>({
      path,
      cmd: NucCmd.nil.db.data,
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const builder = c.get("builder") as BuilderDocument;
      const payload = c.req.valid("json");

      const command = DataMapper.toFlushCollectionCommand(payload);
      return pipe(
        enforceSchemaOwnership(builder, command.schema),
        E.flatMap(() => DataService.flushCollection(c.env, command)),
        E.map((result) => DataMapper.toFlushDataResponse(result)),
        E.map((response) => c.json<FlushDataResponse>(response)),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

export function read(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.data.read;

  app.post(
    path,
    describeRoute({
      tags: ["Data"],
      security: [{ bearerAuth: [] }],
      summary: "Read data records",
      description:
        "Reads data records matching the provided filter from a schema collection.",
      responses: {
        200: {
          description: "Records retrieved successfully",
          content: {
            "application/json": {
              schema: resolver(ReadDataResponse),
            },
          },
        },
        ...OpenApiSpecCommonErrorResponses,
      },
    }),
    zValidator("json", ReadDataRequest),
    loadNucToken(bindings),
    loadSubjectAndVerifyAsBuilder(bindings),
    enforceCapability<{ json: ReadDataRequest }>({
      path,
      cmd: NucCmd.nil.db.data,
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const builder = c.get("builder") as BuilderDocument;
      const payload = c.req.valid("json");

      const command = DataMapper.toReadRecordsCommand(payload);
      return pipe(
        enforceSchemaOwnership(builder, command.schema),
        E.flatMap(() => DataService.readRecords(c.env, command)),
        E.map((documents) => DataMapper.toReadDataResponse(documents)),
        E.map((response) => c.json<ReadDataResponse>(response)),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

export function tail(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.data.tail;

  app.post(
    path,
    describeRoute({
      tags: ["Data"],
      security: [{ bearerAuth: [] }],
      summary: "Tail recent data",
      description:
        "Retrieves the most recent data records from a schema collection.",
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
    zValidator("json", TailDataRequest),
    loadNucToken(bindings),
    loadSubjectAndVerifyAsBuilder(bindings),
    enforceCapability<{ json: TailDataRequest }>({
      path,
      cmd: NucCmd.nil.db.data,
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const builder = c.get("builder") as BuilderDocument;
      const payload = c.req.valid("json");

      const command = DataMapper.toTailDataCommand(payload);
      return pipe(
        enforceSchemaOwnership(builder, command.schema),
        E.flatMap(() => DataService.tailData(c.env, command)),
        E.map((documents) => DataMapper.toTailDataResponse(documents)),
        E.map((response) => c.json<TailDataResponse>(response)),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

export function update(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.data.update;

  app.post(
    path,
    describeRoute({
      tags: ["Data"],
      security: [{ bearerAuth: [] }],
      summary: "Update data records",
      description:
        "Updates data records matching the provided filter in a schema collection.",
      responses: {
        200: {
          description: "Records updated successfully",
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
    enforceCapability<{ json: UpdateDataRequest }>({
      path,
      cmd: NucCmd.nil.db.data,
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const builder = c.get("builder") as BuilderDocument;
      const payload = c.req.valid("json");

      const command = DataMapper.toUpdateRecordsCommand(payload);
      return pipe(
        enforceSchemaOwnership(builder, command.schema),
        E.flatMap(() => DataService.updateRecords(c.env, command)),
        E.map((result) => DataMapper.toUpdateDataResponse(result)),
        E.map((response) => c.json<UpdateDataResponse>(response)),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

export function upload(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.data.upload;

  app.post(
    path,
    describeRoute({
      tags: ["Data"],
      security: [{ bearerAuth: [] }],
      summary: "Upload data records",
      description: "Uploads multiple data records to a schema collection.",
      responses: {
        200: {
          description: "Records uploaded successfully",
          content: {
            "application/json": {
              schema: resolver(UploadDataResponse),
            },
          },
        },
        ...OpenApiSpecCommonErrorResponses,
      },
    }),
    zValidator("json", UploadDataRequest),
    loadNucToken(bindings),
    loadSubjectAndVerifyAsBuilder(bindings),
    enforceCapability<{ json: UploadDataRequest }>({
      path,
      cmd: NucCmd.nil.db.data,
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const builder = c.get("builder") as BuilderDocument;
      const payload = c.req.valid("json");

      const command = DataMapper.toCreateRecordsCommand(payload);
      return pipe(
        enforceSchemaOwnership(builder, command.schemaId),
        E.flatMap(() => DataService.createRecords(c.env, command)),
        E.map((result) => DataMapper.toUploadDataResponse(result)),
        E.map((response) => c.json<UploadDataResponse>(response)),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}
