import { Effect as E, pipe } from "effect";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { StatusCodes } from "http-status-codes";
import type { UUID } from "mongodb";
import { z } from "zod";
import type { BuilderDocument } from "#/builders/builders.types";
import { handleTaggedErrors } from "#/common/handler";
import { NucCmd } from "#/common/nuc-cmd-tree";
import {
  OpenApiSpecCommonErrorResponses,
  OpenApiSpecEmptySuccessResponses,
} from "#/common/openapi";
import { enforceSchemaOwnership } from "#/common/ownership";
import { PathsV1 } from "#/common/paths";
import { type ControllerOptions, Uuid } from "#/common/types";
import {
  enforceCapability,
  loadNucToken,
  loadSubjectAndVerifyAsBuilder,
} from "#/middleware/capability.middleware";
import { SchemaDataMapper } from "#/schemas/schemas.mapper";
import {
  type AddSchemaRequest,
  AddSchemaRequest as AddSchemaRequestSchema,
  AddSchemaResponse,
  type CreateSchemaIndexRequest,
  CreateSchemaIndexRequest as CreateSchemaIndexRequestSchema,
  type DeleteSchemaRequest,
  DeleteSchemaRequest as DeleteSchemaRequestSchema,
  DeleteSchemaResponse,
  ListSchemasResponse,
  ReadSchemaMetadataResponse,
} from "./schemas.dto";
import * as SchemasService from "./schemas.services";

/**
 * Registers the schema listing endpoint.
 *
 * Retrieves all schemas owned by the authenticated builder.
 *
 * @param options - Controller configuration including app instance and bindings
 */
export function list(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.schemas.root;

  app.get(
    path,
    describeRoute({
      tags: ["Schemas"],
      security: [{ bearerAuth: [] }],
      summary: "List builder schemas",
      description: "Retrieves all schemas owned by the authenticated builder.",
      responses: {
        200: {
          description: "List of schemas",
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
 * Registers the schema creation endpoint.
 *
 * Creates a new schema with the provided specification.
 *
 * @param options - Controller configuration including app instance and bindings
 */
export function add(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.schemas.root;

  app.post(
    path,
    describeRoute({
      tags: ["Schemas"],
      security: [{ bearerAuth: [] }],
      summary: "Add a new schema",
      description: "Creates a new schema with the provided specification.",
      responses: {
        201: OpenApiSpecEmptySuccessResponses["201"],
        400: OpenApiSpecCommonErrorResponses["400"],
        500: OpenApiSpecCommonErrorResponses["500"],
      },
    }),
    zValidator("json", AddSchemaRequestSchema),
    loadNucToken(bindings),
    loadSubjectAndVerifyAsBuilder(bindings),
    enforceCapability<{ json: AddSchemaRequest }>({
      path,
      cmd: NucCmd.nil.db.schemas,
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const builder = c.get("builder") as BuilderDocument;
      const payload = c.req.valid("json");
      const command = SchemaDataMapper.toAddSchemaCommand(payload, builder._id);

      return pipe(
        SchemasService.addSchema(c.env, command),
        E.map(() => AddSchemaResponse),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

/**
 * Registers the schema deletion endpoint.
 *
 * Deletes an existing schema by ID.
 *
 * @param options - Controller configuration including app instance and bindings
 */
export function _delete(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.schemas.root;

  app.delete(
    path,
    describeRoute({
      tags: ["Schemas"],
      security: [{ bearerAuth: [] }],
      summary: "Delete a schema",
      description: "Deletes an existing schema by ID.",
      responses: {
        204: OpenApiSpecEmptySuccessResponses["204"],
        400: OpenApiSpecCommonErrorResponses["400"],
        404: OpenApiSpecCommonErrorResponses["404"],
        500: OpenApiSpecCommonErrorResponses["500"],
      },
    }),
    zValidator("json", DeleteSchemaRequestSchema),
    loadNucToken(bindings),
    loadSubjectAndVerifyAsBuilder(bindings),
    enforceCapability<{ json: DeleteSchemaRequest }>({
      path,
      cmd: NucCmd.nil.db.schemas,
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const builder = c.get("builder") as BuilderDocument;
      const payload = c.req.valid("json");
      const command = SchemaDataMapper.toDeleteSchemaCommand(payload);

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
 * Registers the schema metadata endpoint.
 *
 * Retrieves metadata for a specific schema including statistics and indexes.
 *
 * @param options - Controller configuration including app instance and bindings
 */
export function metadata(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.schemas.byIdMeta;

  const GetSchemaMetadataParams = z.object({
    id: Uuid,
  });

  app.get(
    path,
    describeRoute({
      tags: ["Schemas"],
      security: [{ bearerAuth: [] }],
      summary: "Get schema metadata",
      description:
        "Retrieves metadata for a specific schema including statistics and indexes.",
      responses: {
        200: {
          description: "Schema metadata",
          content: {
            "application/json": {
              schema: resolver(ReadSchemaMetadataResponse),
            },
          },
        },
        ...OpenApiSpecCommonErrorResponses,
      },
    }),
    zValidator("param", GetSchemaMetadataParams),
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
 * Registers the create schema index endpoint.
 *
 * Creates a new index on the specified schema.
 *
 * @param options - Controller configuration including app instance and bindings
 */
export function createIndex(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.schemas.byIdIndexes;

  const CreateIndexParams = z.object({
    id: Uuid,
  });

  app.post(
    path,
    describeRoute({
      tags: ["Schemas"],
      security: [{ bearerAuth: [] }],
      summary: "Create schema index",
      description: "Creates a new index on the specified schema.",
      responses: {
        201: OpenApiSpecEmptySuccessResponses["201"],
        400: OpenApiSpecCommonErrorResponses["400"],
        404: OpenApiSpecCommonErrorResponses["404"],
        500: OpenApiSpecCommonErrorResponses["500"],
      },
    }),
    zValidator("json", CreateSchemaIndexRequestSchema),
    zValidator("param", CreateIndexParams),
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
      const { id } = c.req.valid("param");
      const command = SchemaDataMapper.toCreateIndexCommand(payload, id);

      return pipe(
        enforceSchemaOwnership(builder, id),
        E.flatMap(() => SchemasService.createIndex(c.env, command)),
        E.map(() => new Response(null, { status: StatusCodes.CREATED })),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

/**
 * Registers the drop schema index endpoint.
 *
 * Drops an existing index from the specified schema.
 *
 * @param options - Controller configuration including app instance and bindings
 */
export function dropIndex(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.schemas.byIdIndexesByName;

  const DropIndexParams = z.object({
    id: Uuid,
    name: z.string().min(4),
  });

  app.delete(
    path,
    describeRoute({
      tags: ["Schemas"],
      security: [{ bearerAuth: [] }],
      summary: "Drop schema index",
      description: "Drops an existing index from the specified schema.",
      responses: {
        204: OpenApiSpecEmptySuccessResponses["204"],
        400: OpenApiSpecCommonErrorResponses["400"],
        404: OpenApiSpecCommonErrorResponses["404"],
        500: OpenApiSpecCommonErrorResponses["500"],
      },
    }),
    zValidator("param", DropIndexParams),
    loadNucToken(bindings),
    loadSubjectAndVerifyAsBuilder(bindings),
    enforceCapability<{ param: { id: UUID; name: string } }>({
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
        E.map(() => new Response(null, { status: StatusCodes.NO_CONTENT })),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}
