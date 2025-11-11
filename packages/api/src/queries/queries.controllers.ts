import type { BuilderDocument } from "@nildb/builders/builders.types";
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
  ByIdRequestParams,
  CreateQueryRequest,
  type CreateQueryResponse,
  type DeleteQueryResponse,
  NucCmd,
  PathsV1,
  ReadQueriesRequestQuery,
  ReadQueriesResponse,
  type ReadQueryResponse,
  ReadQueryRunByIdRequestQuery,
  ReadQueryRunByIdResponse,
  RunQueryRequest,
  RunQueryResponse,
} from "@nillion/nildb-types";
import { Effect as E, pipe } from "effect";
import { describeRoute, resolver, validator as zValidator } from "hono-openapi";
import { StatusCodes } from "http-status-codes";
import { QueriesDataMapper } from "./queries.mapper.js";
import * as QueriesService from "./queries.services.js";

/**
 * Handle POST /v1/queries
 */
export function createQuery(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.queries.root;

  app.post(
    path,
    describeRoute({
      tags: ["Queries"],
      security: [{ bearerAuth: [] }],
      summary: "Create query",
      responses: {
        201: OpenApiSpecEmptySuccessResponses[201],
        ...OpenApiSpecCommonErrorResponses,
      },
    }),
    zValidator("json", CreateQueryRequest),
    loadNucToken(bindings),
    loadSubjectAndVerifyAsBuilder(bindings),
    requireNucNamespace(NucCmd.nil.db.queries.create),
    async (c) => {
      const builder = c.get("builder") as BuilderDocument;
      const payload = c.req.valid("json");
      const command = QueriesDataMapper.toCreateQueryCommand(
        payload,
        builder.did,
      );

      return pipe(
        QueriesService.addQuery(c.env, command),
        E.map(() => c.text<CreateQueryResponse>("", StatusCodes.CREATED)),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

/**
 * Handle DELETE /v1/queries/:id
 */
export function deleteQuery(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.queries.byId;

  app.delete(
    path,
    describeRoute({
      tags: ["Queries"],
      security: [{ bearerAuth: [] }],
      summary: "Delete query",
      responses: {
        204: OpenApiSpecEmptySuccessResponses[204],
        ...OpenApiSpecCommonErrorResponses,
      },
    }),
    zValidator("param", ByIdRequestParams),
    loadNucToken(bindings),
    loadSubjectAndVerifyAsBuilder(bindings),
    requireNucNamespace(NucCmd.nil.db.queries.delete),
    async (c) => {
      const builder = c.get("builder") as BuilderDocument;
      const params = c.req.valid("param");
      const command = QueriesDataMapper.toDeleteQueryByIdCommand(
        params,
        builder.did,
      );

      return pipe(
        QueriesService.removeQuery(c.env, command),
        E.map(() => c.text<DeleteQueryResponse>("")),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

/**
 * Handle GET /v1/queries
 */
export function readQueries(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.queries.root;

  app.get(
    path,
    describeRoute({
      tags: ["Queries"],
      security: [{ bearerAuth: [] }],
      summary: "Read queries",
      responses: {
        200: {
          description: "OK",
          content: {
            "application/json": {
              schema: resolver(ReadQueriesResponse),
            },
          },
        },
        ...OpenApiSpecCommonErrorResponses,
      },
    }),
    zValidator("query", ReadQueriesRequestQuery),
    loadNucToken(bindings),
    loadSubjectAndVerifyAsBuilder(bindings),
    requireNucNamespace(NucCmd.nil.db.queries.read),
    async (c) => {
      const builder = c.get("builder") as BuilderDocument;
      const pagination = c.req.valid("query");

      return pipe(
        QueriesService.findQueries(c.env, builder.did, pagination),
        E.map((documents) => QueriesDataMapper.toGetQueriesResponse(documents)),
        E.map((response) => c.json<ReadQueriesResponse>(response)),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

/**
 * Handle GET /v1/queries/:id
 */
export function readQueryById(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.queries.byId;

  app.get(
    path,
    describeRoute({
      tags: ["Queries"],
      security: [{ bearerAuth: [] }],
      summary: "Read query",
      responses: {
        200: {
          description: "OK",
          content: {
            "application/json": {
              schema: { type: "object" },
            },
          },
        },
        ...OpenApiSpecCommonErrorResponses,
      },
    }),
    zValidator("param", ByIdRequestParams),
    loadNucToken(bindings),
    loadSubjectAndVerifyAsBuilder(bindings),
    requireNucNamespace(NucCmd.nil.db.queries.read),
    async (c) => {
      const builder = c.get("builder") as BuilderDocument;
      const params = c.req.valid("param");
      const command = QueriesDataMapper.toReadQueryByIdCommand(
        params,
        builder.did,
      );

      return pipe(
        QueriesService.getQueryById(c.env, command),
        E.map((document) => QueriesDataMapper.toReadQueryResponse(document)),
        E.map((response) => c.json<ReadQueryResponse>(response)),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

/**
 * Handle POST /v1/queries/run
 */
export function runQuery(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.queries.run;

  app.post(
    path,
    describeRoute({
      tags: ["Queries"],
      security: [{ bearerAuth: [] }],
      summary: "Run query",
      responses: {
        200: {
          description: "OK",
          content: {
            "application/json": {
              schema: resolver(RunQueryResponse),
            },
          },
        },
        ...OpenApiSpecCommonErrorResponses,
      },
    }),
    zValidator("json", RunQueryRequest),
    loadNucToken(bindings),
    loadSubjectAndVerifyAsBuilder(bindings),
    requireNucNamespace(NucCmd.nil.db.queries.execute),
    async (c) => {
      const builder = c.get("builder") as BuilderDocument;
      const payload = c.req.valid("json");
      const command = QueriesDataMapper.toRunQueryCommand(payload, builder.did);

      return pipe(
        QueriesService.runQueryInBackground(c.env, command),
        E.map((result) => QueriesDataMapper.toRunQueryResponse(result)),
        E.map((response) => c.json<RunQueryResponse>(response)),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

/**
 * Handle GET /v1/queries/run/:id
 */
export function getQueryRunResultById(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.queries.runById;

  app.get(
    path,
    describeRoute({
      tags: ["Queries"],
      security: [{ bearerAuth: [] }],
      summary: "Read query run results",
      responses: {
        200: {
          description: "OK",
          content: {
            "application/json": {
              schema: resolver(ReadQueryRunByIdResponse),
            },
          },
        },
        ...OpenApiSpecCommonErrorResponses,
      },
    }),
    zValidator("param", ByIdRequestParams),
    zValidator("query", ReadQueryRunByIdRequestQuery),
    loadNucToken(bindings),
    loadSubjectAndVerifyAsBuilder(bindings),
    requireNucNamespace(NucCmd.nil.db.queries.read),
    async (c) => {
      const _builder = c.get("builder") as BuilderDocument;
      const params = c.req.valid("param");
      const pagination = c.req.valid("query");
      const command = QueriesDataMapper.toGetQueryRunResultByIdCommand(params);

      return pipe(
        QueriesService.getRunQueryJob(c.env, command, pagination),
        E.map((run) =>
          QueriesDataMapper.toGetQueryRunResultByIdResponse(run, pagination),
        ),
        E.map((response) => c.json<ReadQueryRunByIdResponse>(response)),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}
