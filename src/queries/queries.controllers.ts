import { Effect as E, pipe } from "effect";
import { describeRoute, resolver, validator as zValidator } from "hono-openapi";
import { StatusCodes } from "http-status-codes";
import type { BuilderDocument } from "#/builders/builders.types";
import { handleTaggedErrors } from "#/common/handler";
import { NucCmd } from "#/common/nuc-cmd-tree";
import {
  OpenApiSpecCommonErrorResponses,
  OpenApiSpecEmptySuccessResponses,
} from "#/common/openapi";
import { PathsV1 } from "#/common/paths";
import type { ControllerOptions } from "#/common/types";
import {
  loadNucToken,
  loadSubjectAndVerifyAsBuilder,
  requireNucNamespace,
} from "#/middleware/capability.middleware";
import {
  ByIdRequestParams,
  CreateQueryRequest,
  type CreateQueryResponse,
  type DeleteQueryResponse,
  ReadQueriesResponse,
  type ReadQueryResponse,
  ReadQueryRunByIdResponse,
  RunQueryRequest,
  RunQueryResponse,
} from "./queries.dto";
import { QueriesDataMapper } from "./queries.mapper";
import * as QueriesService from "./queries.services";

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
        builder._id,
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
        builder._id,
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
    loadNucToken(bindings),
    loadSubjectAndVerifyAsBuilder(bindings),
    requireNucNamespace(NucCmd.nil.db.queries.read),
    async (c) => {
      const builder = c.get("builder") as BuilderDocument;

      return pipe(
        QueriesService.findQueries(c.env, builder._id),
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
        builder._id,
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
      const command = QueriesDataMapper.toRunQueryCommand(payload, builder._id);

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
    loadNucToken(bindings),
    loadSubjectAndVerifyAsBuilder(bindings),
    requireNucNamespace(NucCmd.nil.db.queries.read),
    async (c) => {
      const _builder = c.get("builder") as BuilderDocument;
      const params = c.req.valid("param");
      const command = QueriesDataMapper.toGetQueryRunResultByIdCommand(params);

      return pipe(
        QueriesService.getRunQueryJob(c.env, command),
        E.flatMap((run) =>
          pipe(
            E.succeed(QueriesDataMapper.toGetQueryRunResultByResponse(run)),
            E.map((response) => c.json<ReadQueryRunByIdResponse>(response)),
          ),
        ),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}
