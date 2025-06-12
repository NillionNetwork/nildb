import { Effect as E, pipe } from "effect";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { StatusCodes } from "http-status-codes";
import type { UUID } from "mongodb";
import type { BuilderDocument } from "#/builders/builders.types";
import { handleTaggedErrors } from "#/common/handler";
import { NucCmd } from "#/common/nuc-cmd-tree";
import {
  OpenApiSpecCommonErrorResponses,
  OpenApiSpecEmptySuccessResponses,
} from "#/common/openapi";
import { enforceSchemaOwnership } from "#/common/ownership";
import { PathsV1 } from "#/common/paths";
import type { ControllerOptions } from "#/common/types";
import {
  enforceCapability,
  loadNucToken,
  loadSubjectAndVerifyAsBuilder,
} from "#/middleware/capability.middleware";
import { SchemaDataMapper } from "#/schemas/schemas.mapper";
import {
  CreateSchemaIndexRequest,
  CreateSchemaRequest,
  CreateSchemaResponse,
  DeleteSchemaRequestParams,
  DeleteSchemaResponse,
  DropSchemaIndexParams,
  DropSchemaIndexResponse,
  ListSchemasResponse,
  ReadSchemaMetadataRequestParams,
  ReadSchemaMetadataResponse,
} from "./schemas.dto";
import * as SchemasService from "./schemas.services";

/**
 * Handle GET /v1/schemas
 */
export function readSchemas(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.schemas.root;

  app.get(
    path,
    describeRoute({
      tags: ["Schemas"],
      security: [{ bearerAuth: [] }],
      summary: "Lists all of the builder's schemas",
      responses: {
        200: {
          description: "OK",
          content: {
            "application/json": {
              schema: resolver(ListSchemasResponse),
            },
          },
        },
        ...OpenApiSpecCommonErrorResponses,
      },
    }),
    loadNucToken(bindings),
    loadSubjectAndVerifyAsBuilder(bindings),
    enforceCapability({
      path,
      cmd: NucCmd.nil.db.schemas,
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const builder = c.get("builder") as BuilderDocument;

      // TODO: include schema metadata with response
      return pipe(
        SchemasService.getBuilderSchemas(c.env, builder),
        E.map((schemas) => SchemaDataMapper.toListSchemasResponse(schemas)),
        E.map((response) => c.json<ListSchemasResponse>(response)),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

/**
 * Handle POST /v1/schemas
 */
export function createSchema(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.schemas.root;

  app.post(
    path,
    describeRoute({
      tags: ["Schemas"],
      security: [{ bearerAuth: [] }],
      summary: "Create new schema-validated data collection",
      responses: {
        201: OpenApiSpecEmptySuccessResponses["201"],
        400: OpenApiSpecCommonErrorResponses["400"],
        500: OpenApiSpecCommonErrorResponses["500"],
      },
    }),
    zValidator("json", CreateSchemaRequest),
    loadNucToken(bindings),
    loadSubjectAndVerifyAsBuilder(bindings),
    enforceCapability<{ json: CreateSchemaRequest }>({
      path,
      cmd: NucCmd.nil.db.schemas,
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const builder = c.get("builder") as BuilderDocument;
      const payload = c.req.valid("json");
      const command = SchemaDataMapper.toCreateSchemaCommand(
        payload,
        builder._id,
      );

      return pipe(
        SchemasService.addSchema(c.env, command),
        E.map(() => CreateSchemaResponse),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

/**
 * Handle DELETE /v1/schemas/:id
 */
export function deleteSchemaById(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.schemas.byId;

  app.delete(
    path,
    describeRoute({
      tags: ["Schemas"],
      security: [{ bearerAuth: [] }],
      summary: "Deletes a collection and all of its data",
      responses: {
        204: OpenApiSpecEmptySuccessResponses["204"],
        400: OpenApiSpecCommonErrorResponses["400"],
        404: OpenApiSpecCommonErrorResponses["404"],
        500: OpenApiSpecCommonErrorResponses["500"],
      },
    }),
    zValidator("param", DeleteSchemaRequestParams),
    loadNucToken(bindings),
    loadSubjectAndVerifyAsBuilder(bindings),
    enforceCapability<{ param: { id: UUID } }>({
      path,
      cmd: NucCmd.nil.db.schemas,
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const builder = c.get("builder") as BuilderDocument;
      const { id } = c.req.valid("param");
      const command = SchemaDataMapper.toDeleteSchemaCommand({ id });

      return pipe(
        enforceSchemaOwnership(builder, command.id),
        E.flatMap(() => SchemasService.deleteSchema(c.env, command)),
        E.map(() => DeleteSchemaResponse),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

/**
 * Handle GET /v1/schemas/:id
 */
export function readSchemaById(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.schemas.byId;

  app.get(
    path,
    describeRoute({
      tags: ["Schemas"],
      security: [{ bearerAuth: [] }],
      summary: "Retrieve a schema's information",
      responses: {
        200: {
          description: "OK",
          content: {
            "application/json": {
              schema: resolver(ReadSchemaMetadataResponse),
            },
          },
        },
        ...OpenApiSpecCommonErrorResponses,
      },
    }),
    zValidator("param", ReadSchemaMetadataRequestParams),
    loadNucToken(bindings),
    loadSubjectAndVerifyAsBuilder(bindings),
    enforceCapability<{ param: { id: UUID } }>({
      path,
      cmd: NucCmd.nil.db.schemas,
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const builder = c.get("builder") as BuilderDocument;
      const payload = c.req.valid("param");

      // TODO: needs to include metadata with schema result

      return pipe(
        enforceSchemaOwnership(builder, payload.id),
        E.flatMap(() => SchemasService.getSchemaMetadata(c.env, payload.id)),
        E.map((metadata) => SchemaDataMapper.toReadMetadataResponse(metadata)),
        E.map((response) => c.json<ReadSchemaMetadataResponse>(response)),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

/**
 * Handle POST /v1/schemas/:id/indexes
 */
export function createIndex(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.schemas.indexesById;

  app.post(
    path,
    describeRoute({
      tags: ["Schemas"],
      security: [{ bearerAuth: [] }],
      summary: "Create a collection index",
      responses: {
        201: OpenApiSpecEmptySuccessResponses["201"],
        400: OpenApiSpecCommonErrorResponses["400"],
        404: OpenApiSpecCommonErrorResponses["404"],
        500: OpenApiSpecCommonErrorResponses["500"],
      },
    }),
    zValidator("json", CreateSchemaIndexRequest),
    loadNucToken(bindings),
    loadSubjectAndVerifyAsBuilder(bindings),
    enforceCapability<{ json: CreateSchemaIndexRequest; param: { id: UUID } }>({
      path,
      cmd: NucCmd.nil.db.schemas,

      validate: (_c, _token) => true,
    }),
    async (c) => {
      const builder = c.get("builder") as BuilderDocument;
      const payload = c.req.valid("json");
      const command = SchemaDataMapper.toCreateIndexCommand(payload);

      return pipe(
        enforceSchemaOwnership(builder, command.schema),
        E.flatMap(() => SchemasService.createIndex(c.env, command)),
        E.map(() => new Response(null, { status: StatusCodes.CREATED })),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

/**
 * Handle DELETE /v1/schemas/:id/indexes/:name
 */
export function dropIndex(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.schemas.indexesByNameById;

  app.delete(
    path,
    describeRoute({
      tags: ["Schemas"],
      security: [{ bearerAuth: [] }],
      summary: "Delete an index by name",
      description:
        "Removes a database index from the schema collection. This may impact query performance but does not affect stored data. Only the builder who created the schema can drop indexes. Requires authentication with builder capabilities.",
      responses: {
        204: OpenApiSpecEmptySuccessResponses["204"],
        400: OpenApiSpecCommonErrorResponses["400"],
        404: OpenApiSpecCommonErrorResponses["404"],
        500: OpenApiSpecCommonErrorResponses["500"],
      },
    }),
    zValidator("param", DropSchemaIndexParams),
    loadNucToken(bindings),
    loadSubjectAndVerifyAsBuilder(bindings),
    enforceCapability<{ param: DropSchemaIndexParams }>({
      path,
      cmd: NucCmd.nil.db.schemas,
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const builder = c.get("builder") as BuilderDocument;
      const { id, name } = c.req.valid("param");
      const command = SchemaDataMapper.toDropIndexCommand(name, id);

      return pipe(
        enforceSchemaOwnership(builder, id),
        E.flatMap(() => SchemasService.dropIndex(c.env, command)),
        E.map(() => DropSchemaIndexResponse),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}
