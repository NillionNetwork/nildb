import { Effect as E, pipe } from "effect";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { StatusCodes } from "http-status-codes";
import type { BuilderDocument } from "#/builders/builders.types";
import { CollectionsDataMapper } from "#/collections/collections.mapper";
import { handleTaggedErrors } from "#/common/handler";
import { NucCmd } from "#/common/nuc-cmd-tree";
import {
  OpenApiSpecCommonErrorResponses,
  OpenApiSpecEmptySuccessResponses,
} from "#/common/openapi";
import { enforceCollectionOwnership } from "#/common/ownership";
import { PathsV1 } from "#/common/paths";
import type { ControllerOptions } from "#/common/types";
import {
  loadNucToken,
  loadSubjectAndVerifyAsBuilder,
  requireNucNamespace,
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
      summary: "Read collections",
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
    requireNucNamespace(NucCmd.nil.db.collections.read),
    async (c) => {
      const builder = c.get("builder") as BuilderDocument;

      return pipe(
        CollectionsService.getBuilderCollections(c.env, builder),
        E.map((collection) =>
          CollectionsDataMapper.toListCollectionsResponse(collection),
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
      summary: "Create collection",
      responses: {
        201: OpenApiSpecEmptySuccessResponses["201"],
        400: OpenApiSpecCommonErrorResponses["400"],
        500: OpenApiSpecCommonErrorResponses["500"],
      },
    }),
    zValidator("json", CreateCollectionRequest),
    loadNucToken(bindings),
    loadSubjectAndVerifyAsBuilder(bindings),
    requireNucNamespace(NucCmd.nil.db.collections.create),
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
      summary: "Delete collection",
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
    requireNucNamespace(NucCmd.nil.db.collections.delete),
    async (c) => {
      const builder = c.get("builder") as BuilderDocument;
      const params = c.req.valid("param");
      const command = CollectionsDataMapper.toDeleteCollectionCommand(params);

      return pipe(
        enforceCollectionOwnership(builder, command._id),
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
      summary: "Read collection",
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
    requireNucNamespace(NucCmd.nil.db.collections.read),
    async (c) => {
      const builder = c.get("builder") as BuilderDocument;
      const payload = c.req.valid("param");
      const command = CollectionsDataMapper.toReadCollectionById(payload);

      return pipe(
        enforceCollectionOwnership(builder, command.id),
        E.flatMap(() =>
          CollectionsService.getCollectionMetadata(c.env, command),
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
      summary: "Create collection index",
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
    requireNucNamespace(NucCmd.nil.db.collections.update),
    async (c) => {
      const builder = c.get("builder") as BuilderDocument;
      const payload = c.req.valid("json");
      const command = CollectionsDataMapper.toCreateIndexCommand(payload);

      return pipe(
        enforceCollectionOwnership(builder, command.collection),
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
      summary: "Drop collection index",
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
    requireNucNamespace(NucCmd.nil.db.collections.update),
    async (c) => {
      const builder = c.get("builder") as BuilderDocument;
      const params = c.req.valid("param");
      const command = CollectionsDataMapper.toDropIndexCommand(params);

      return pipe(
        enforceCollectionOwnership(builder, command.collection),
        E.flatMap(() => CollectionsService.dropIndex(c.env, command)),
        E.map(() => DropCollectionIndexResponse),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}
