import { Effect as E, pipe } from "effect";
import { StatusCodes } from "http-status-codes";
import type { OrganizationAccountDocument } from "#/accounts/accounts.types";
import { handleTaggedErrors } from "#/common/handler";
import { NucCmd } from "#/common/nuc-cmd-tree";
import { enforceQueryOwnership } from "#/common/ownership";
import { PathsV1 } from "#/common/paths";
import type { ControllerOptions } from "#/common/types";
import { payloadValidator } from "#/common/zod-utils";
import {
  enforceCapability,
  RoleSchema,
  verifyNucAndLoadSubject,
} from "#/middleware/capability.middleware";
import * as QueriesService from "./queries.services";
import {
  type AddQueryRequest,
  AddQueryRequestSchema,
  type DeleteQueryRequest,
  DeleteQueryRequestSchema,
  type ExecuteQueryRequest,
  ExecuteQueryRequestSchema,
  type QueryJobRequest,
  QueryJobRequestSchema,
} from "./queries.types";

export function add(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.queries.root;

  app.post(
    path,
    payloadValidator(AddQueryRequestSchema),
    verifyNucAndLoadSubject(bindings),
    enforceCapability<{ json: AddQueryRequest }>({
      path,
      cmd: NucCmd.nil.db.queries,
      roles: [RoleSchema.enum.organization],
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const account = c.get("account") as OrganizationAccountDocument;
      const payload = c.req.valid("json");

      return pipe(
        QueriesService.addQuery(c.env, {
          ...payload,
          owner: account._id,
        }),
        E.map(() => new Response(null, { status: StatusCodes.CREATED })),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

export function remove(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.queries.root;

  app.delete(
    path,
    payloadValidator(DeleteQueryRequestSchema),
    verifyNucAndLoadSubject(bindings),
    enforceCapability<{ json: DeleteQueryRequest }>({
      path,
      cmd: NucCmd.nil.db.queries,
      roles: [RoleSchema.enum.organization],
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const account = c.get("account") as OrganizationAccountDocument;
      const payload = c.req.valid("json");

      return pipe(
        enforceQueryOwnership(account, payload.id),
        E.flatMap(() => QueriesService.removeQuery(c.env, payload.id)),
        E.map(() => new Response(null, { status: StatusCodes.NO_CONTENT })),
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
    payloadValidator(ExecuteQueryRequestSchema),
    verifyNucAndLoadSubject(bindings),
    enforceCapability<{ json: ExecuteQueryRequest }>({
      path,
      cmd: NucCmd.nil.db.queries,
      roles: [RoleSchema.enum.organization],
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const account = c.get("account") as OrganizationAccountDocument;
      const payload = c.req.valid("json");

      return pipe(
        enforceQueryOwnership(account, payload.id),
        E.flatMap(() => QueriesService.executeQuery(c.env, payload)),
        E.map((data) => c.json({ data })),
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
    verifyNucAndLoadSubject(bindings),
    enforceCapability({
      path,
      cmd: NucCmd.nil.db.queries,
      roles: [RoleSchema.enum.organization],
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const account = c.get("account") as OrganizationAccountDocument;

      return pipe(
        QueriesService.findQueries(c.env, account._id),
        E.map((data) => c.json({ data })),
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
    payloadValidator(QueryJobRequestSchema),
    verifyNucAndLoadSubject(bindings),
    enforceCapability<{ json: QueryJobRequest }>({
      path,
      cmd: NucCmd.nil.db.queries,
      roles: [RoleSchema.enum.organization],
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const account = c.get("account") as OrganizationAccountDocument;
      const payload = c.req.valid("json");

      return pipe(
        QueriesService.findQueryJob(c.env, payload.id),
        E.flatMap((data) =>
          E.all([
            E.succeed(data),
            enforceQueryOwnership(account, data.queryId),
          ]),
        ),
        E.map(([data]) => c.json({ data })),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}
