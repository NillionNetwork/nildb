import type { BuilderDocument } from "@nildb/builders/builders.types";
import { CollectionsDataMapper } from "@nildb/collections/collections.mapper";
import { handleTaggedErrors } from "@nildb/common/handler";
import {
  OpenApiSpecCommonErrorResponses,
  OpenApiSpecEmptySuccessResponses,
} from "@nildb/common/openapi";
import type { ControllerOptions } from "@nildb/common/types";
import {
  loadNucToken,
  loadSubjectAndVerifyAsBuilder,
  requireNucNamespace,
} from "@nildb/middleware/capability.middleware";
import {
  CreateCollectionIndexRequest,
  type CreateCollectionIndexResponse,
  CreateCollectionRequest,
  type CreateCollectionResponse,
  DeleteCollectionRequestParams,
  type DeleteCollectionResponse,
  DropCollectionIndexParams,
  type DropCollectionIndexResponse,
  ListCollectionsRequestQuery,
  ListCollectionsResponse,
  NucCmd,
  PathsV1,
  ReadCollectionMetadataRequestParams,
  ReadCollectionMetadataResponse,
} from "@nillion/nildb-types";
import { Effect as E, pipe } from "effect";
import { describeRoute, resolver, validator as zValidator } from "hono-openapi";
import { StatusCodes } from "http-status-codes";
import * as CollectionsService from "./collections.services.js";

/**
 * Handle GET /v1/collections?limit={number}&offset={number}
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
    zValidator("query", ListCollectionsRequestQuery),
    loadNucToken(bindings),
    loadSubjectAndVerifyAsBuilder(bindings),
    requireNucNamespace(NucCmd.nil.db.collections.read),
    async (c) => {
      const builder = c.get("builder") as BuilderDocument;
      const pagination = c.req.valid("query");

      return pipe(
        CollectionsService.getBuilderCollections(
          c.env,
          builder.did,
          pagination,
        ),
        E.map((paginatedResult) =>
          CollectionsDataMapper.toListCollectionsResponse(paginatedResult),
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
        builder.did,
      );

      return pipe(
        CollectionsService.addCollection(c.env, command),
        E.map(() => c.text<CreateCollectionResponse>("", StatusCodes.CREATED)),
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
      const command = CollectionsDataMapper.toDeleteCollectionCommand(
        params,
        builder.did,
      );

      return pipe(
        CollectionsService.deleteCollection(c.env, command),
        E.map(() => c.text<DeleteCollectionResponse>("")),
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
      const command = CollectionsDataMapper.toReadCollectionById(
        payload,
        builder.did,
      );

      return pipe(
        CollectionsService.getCollectionById(c.env, command),
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
      const command = CollectionsDataMapper.toCreateIndexCommand(
        payload,
        builder.did,
      );

      return pipe(
        CollectionsService.createIndex(c.env, command),
        E.map(() => c.text<CreateCollectionIndexResponse>("")),
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
      const command = CollectionsDataMapper.toDropIndexCommand(
        params,
        builder.did,
      );

      return pipe(
        CollectionsService.dropIndex(c.env, command),
        E.map(() => c.text<DropCollectionIndexResponse>("")),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}
