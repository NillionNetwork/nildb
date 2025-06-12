import { Effect as E, pipe } from "effect";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { StatusCodes } from "http-status-codes";
import type { UUID } from "mongodb";
import type { BuilderDocument } from "#/builders/builders.types";
import { CollectionsDataMapper } from "#/collections/collections.mapper";
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
import {
  CreateCollectionIndexRequest,
  CreateCollectionRequest,
  CreateCollectionResponse,
  DeleteCollectionRequestParams,
  DeleteCollectionResponse,
  DropCollectionIndexParams,
  DropCollectionIndexResponse,
  ListCollectionsResponse,
  ReadCollectionMetadataRequestParams,
  ReadCollectionMetadataResponse,
} from "./collections.dto";
import * as CollectionsService from "./collections.services";

/**
 * Handle GET /v1/collections
 */
export function readCollections(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.collections.root;

  app.get(
    path,
    describeRoute({
      tags: ["Collections"],
      security: [{ bearerAuth: [] }],
      summary: "Lists all of the builder's collections",
      responses: {
        200: {
          description: "OK",
          content: {
            "application/json": {
              schema: resolver(ListCollectionsResponse),
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

      // TODO: include collection metadata with response
      return pipe(
        CollectionsService.getBuilderCollections(c.env, builder),
        E.map((schemas) =>
          CollectionsDataMapper.toListCollectionsResponse(schemas),
        ),
        E.map((response) => c.json<ListCollectionsResponse>(response)),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

/**
 * Handle POST /v1/collections
 */
export function createCollection(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.collections.root;

  app.post(
    path,
    describeRoute({
      tags: ["Collections"],
      security: [{ bearerAuth: [] }],
      summary: "Create new schema-validated data collection",
      responses: {
        201: OpenApiSpecEmptySuccessResponses["201"],
        400: OpenApiSpecCommonErrorResponses["400"],
        500: OpenApiSpecCommonErrorResponses["500"],
      },
    }),
    zValidator("json", CreateCollectionRequest),
    loadNucToken(bindings),
    loadSubjectAndVerifyAsBuilder(bindings),
    enforceCapability<{ json: CreateCollectionRequest }>({
      path,
      cmd: NucCmd.nil.db.schemas,
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const builder = c.get("builder") as BuilderDocument;
      const payload = c.req.valid("json");
      const command = CollectionsDataMapper.toCreateCollectionCommand(
        payload,
        builder._id,
      );

      return pipe(
        CollectionsService.addCollection(c.env, command),
        E.map(() => CreateCollectionResponse),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

/**
 * Handle DELETE /v1/collections/:id
 */
export function deleteCollectionById(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.collections.byId;

  app.delete(
    path,
    describeRoute({
      tags: ["Collections"],
      security: [{ bearerAuth: [] }],
      summary: "Deletes a collection and all of its data",
      responses: {
        204: OpenApiSpecEmptySuccessResponses["204"],
        400: OpenApiSpecCommonErrorResponses["400"],
        404: OpenApiSpecCommonErrorResponses["404"],
        500: OpenApiSpecCommonErrorResponses["500"],
      },
    }),
    zValidator("param", DeleteCollectionRequestParams),
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
      const command = CollectionsDataMapper.toDeleteCollectionCommand({ id });

      return pipe(
        enforceSchemaOwnership(builder, command.id),
        E.flatMap(() => CollectionsService.deleteCollection(c.env, command)),
        E.map(() => DeleteCollectionResponse),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

/**
 * Handle GET /v1/collections/:id
 */
export function readCollectionById(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.collections.byId;

  app.get(
    path,
    describeRoute({
      tags: ["Collections"],
      security: [{ bearerAuth: [] }],
      summary: "Retrieve collection information",
      responses: {
        200: {
          description: "OK",
          content: {
            "application/json": {
              schema: resolver(ReadCollectionMetadataResponse),
            },
          },
        },
        ...OpenApiSpecCommonErrorResponses,
      },
    }),
    zValidator("param", ReadCollectionMetadataRequestParams),
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
        E.flatMap(() =>
          CollectionsService.getCollectionMetadata(c.env, payload.id),
        ),
        E.map((metadata) =>
          CollectionsDataMapper.toReadMetadataResponse(metadata),
        ),
        E.map((response) => c.json<ReadCollectionMetadataResponse>(response)),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

/**
 * Handle POST /v1/collections/:id/indexes
 */
export function createCollectionIndex(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.collections.indexesById;

  app.post(
    path,
    describeRoute({
      tags: ["Collections"],
      security: [{ bearerAuth: [] }],
      summary: "Create a collection index",
      responses: {
        201: OpenApiSpecEmptySuccessResponses["201"],
        400: OpenApiSpecCommonErrorResponses["400"],
        404: OpenApiSpecCommonErrorResponses["404"],
        500: OpenApiSpecCommonErrorResponses["500"],
      },
    }),
    zValidator("json", CreateCollectionIndexRequest),
    loadNucToken(bindings),
    loadSubjectAndVerifyAsBuilder(bindings),
    enforceCapability<{
      json: CreateCollectionIndexRequest;
      param: { id: UUID };
    }>({
      path,
      cmd: NucCmd.nil.db.schemas,

      validate: (_c, _token) => true,
    }),
    async (c) => {
      const builder = c.get("builder") as BuilderDocument;
      const payload = c.req.valid("json");
      const command = CollectionsDataMapper.toCreateIndexCommand(payload);

      return pipe(
        enforceSchemaOwnership(builder, command.collection),
        E.flatMap(() => CollectionsService.createIndex(c.env, command)),
        E.map(() => new Response(null, { status: StatusCodes.CREATED })),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

/**
 * Handle DELETE /v1/collections/:id/indexes/:name
 */
export function dropCollectionIndex(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.collections.indexesByNameById;

  app.delete(
    path,
    describeRoute({
      tags: ["Collections"],
      security: [{ bearerAuth: [] }],
      summary: "Delete an collection index by it's name",
      responses: {
        204: OpenApiSpecEmptySuccessResponses["204"],
        400: OpenApiSpecCommonErrorResponses["400"],
        404: OpenApiSpecCommonErrorResponses["404"],
        500: OpenApiSpecCommonErrorResponses["500"],
      },
    }),
    zValidator("param", DropCollectionIndexParams),
    loadNucToken(bindings),
    loadSubjectAndVerifyAsBuilder(bindings),
    enforceCapability<{ param: DropCollectionIndexParams }>({
      path,
      cmd: NucCmd.nil.db.schemas,
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const builder = c.get("builder") as BuilderDocument;
      const { id, name } = c.req.valid("param");
      const command = CollectionsDataMapper.toDropIndexCommand(name, id);

      return pipe(
        enforceSchemaOwnership(builder, id),
        E.flatMap(() => CollectionsService.dropIndex(c.env, command)),
        E.map(() => DropCollectionIndexResponse),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}
