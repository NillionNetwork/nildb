import { Effect as E, pipe } from "effect";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import type { OrganizationAccountDocument } from "#/accounts/accounts.types";
import { handleTaggedErrors } from "#/common/handler";
import { NucCmd } from "#/common/nuc-cmd-tree";
import { OpenApiSpecCommonErrorResponses } from "#/common/openapi";
import { enforceQueryOwnership } from "#/common/ownership";
import { PathsV1 } from "#/common/paths";
import type { ControllerOptions } from "#/common/types";
import { payloadValidator } from "#/common/zod-utils";
import {
  enforceCapability,
  loadNucToken,
  loadSubjectAndVerifyAsBuilder,
} from "#/middleware/capability.middleware";
import {
  AddQueryRequest,
  AddQueryResponse,
  DeleteQueryRequest,
  DeleteQueryResponse,
  ExecuteQueryRequest,
  ExecuteQueryResponse,
  GetQueriesResponse,
  GetQueryJobResponse,
  QueryJobRequest,
} from "./queries.dto";
import { QueriesDataMapper } from "./queries.mapper";
import * as QueriesService from "./queries.services";

export function add(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.queries.root;

  app.post(
    path,
    describeRoute({
      tags: ["Queries"],
      security: [{ bearerAuth: [] }],
      summary: "Add a new query",
      description: "Creates a new MongoDB aggregation query for a schema.",
      responses: {
        201: {
          description: "Query created successfully",
        },
        ...OpenApiSpecCommonErrorResponses,
      },
    }),
    zValidator("json", AddQueryRequest),
    loadNucToken(bindings),
    loadSubjectAndVerifyAsBuilder(bindings),
    enforceCapability<{ json: AddQueryRequest }>({
      path,
      cmd: NucCmd.nil.db.queries,
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const account = c.get("account") as OrganizationAccountDocument;
      const payload = c.req.valid("json");

      const command = QueriesDataMapper.toAddQueryCommand(payload, account._id);
      return pipe(
        QueriesService.addQuery(c.env, command),
        E.map(() => AddQueryResponse),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

export function _delete(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.queries.root;

  app.delete(
    path,
    describeRoute({
      tags: ["Queries"],
      security: [{ bearerAuth: [] }],
      summary: "Delete a query",
      description: "Deletes an existing query by ID.",
      responses: {
        204: {
          description: "Query deleted successfully",
        },
        ...OpenApiSpecCommonErrorResponses,
      },
    }),
    zValidator("json", DeleteQueryRequest),
    loadNucToken(bindings),
    loadSubjectAndVerifyAsBuilder(bindings),
    enforceCapability<{ json: DeleteQueryRequest }>({
      path,
      cmd: NucCmd.nil.db.queries,
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const account = c.get("account") as OrganizationAccountDocument;
      const payload = c.req.valid("json");

      const command = QueriesDataMapper.toDeleteQueryCommand(payload);
      return pipe(
        enforceQueryOwnership(account, command.id),
        E.flatMap(() => QueriesService.removeQuery(c.env, command)),
        E.map(() => DeleteQueryResponse),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

export function execute(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.queries.execute;

  app.post(
    path,
    describeRoute({
      tags: ["Queries"],
      security: [{ bearerAuth: [] }],
      summary: "Execute a query",
      description:
        "Executes a query with provided variables, either synchronously or as a background job.",
      responses: {
        200: {
          description: "Query executed successfully",
          content: {
            "application/json": {
              schema: resolver(ExecuteQueryResponse),
            },
          },
        },
        ...OpenApiSpecCommonErrorResponses,
      },
    }),
    zValidator("json", ExecuteQueryRequest),
    loadNucToken(bindings),
    loadSubjectAndVerifyAsBuilder(bindings),
    enforceCapability<{ json: ExecuteQueryRequest }>({
      path,
      cmd: NucCmd.nil.db.queries,
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const account = c.get("account") as OrganizationAccountDocument;
      const payload = c.req.valid("json");

      const command = QueriesDataMapper.toExecuteQueryCommand(payload);
      return pipe(
        enforceQueryOwnership(account, command.id),
        E.flatMap(() => QueriesService.executeQuery(c.env, command)),
        E.map((result) => QueriesDataMapper.toExecuteQueryResponse(result)),
        E.map((response) => c.json<ExecuteQueryResponse>(response)),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

export function list(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.queries.root;

  app.get(
    path,
    describeRoute({
      tags: ["Queries"],
      security: [{ bearerAuth: [] }],
      summary: "List queries",
      description:
        "Retrieves all queries owned by the authenticated organization.",
      responses: {
        200: {
          description: "Queries retrieved successfully",
          content: {
            "application/json": {
              schema: resolver(GetQueriesResponse),
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
      cmd: NucCmd.nil.db.queries,
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const account = c.get("account") as OrganizationAccountDocument;

      return pipe(
        QueriesService.findQueries(c.env, account._id),
        E.map((documents) => QueriesDataMapper.toGetQueriesResponse(documents)),
        E.map((response) => c.json<GetQueriesResponse>(response)),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

export function getQueryJob(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.queries.job;

  app.post(
    path,
    describeRoute({
      tags: ["Queries"],
      security: [{ bearerAuth: [] }],
      summary: "Get query job status",
      description: "Retrieves the status and result of a query background job.",
      responses: {
        200: {
          description: "Job status retrieved successfully",
          content: {
            "application/json": {
              schema: resolver(GetQueryJobResponse),
            },
          },
        },
        ...OpenApiSpecCommonErrorResponses,
      },
    }),
    payloadValidator(QueryJobRequest),
    loadNucToken(bindings),
    loadSubjectAndVerifyAsBuilder(bindings),
    enforceCapability<{ json: QueryJobRequest }>({
      path,
      cmd: NucCmd.nil.db.queries,
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const account = c.get("account") as OrganizationAccountDocument;
      const payload = c.req.valid("json");

      const command = QueriesDataMapper.toGetQueryJobCommand(payload);
      return pipe(
        QueriesService.findQueryJob(c.env, command),
        E.flatMap((data) =>
          E.all([
            E.succeed(data),
            enforceQueryOwnership(account, data.queryId),
          ]),
        ),
        E.map(([document]) => QueriesDataMapper.toQueryJobResponse(document)),
        E.map((response) => c.json<GetQueryJobResponse>(response)),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}
