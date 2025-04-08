import { Effect as E, pipe } from "effect";
import { StatusCodes } from "http-status-codes";
import type { OrganizationAccountDocument } from "#/accounts/accounts.types";
import { handleTaggedErrors } from "#/common/handler";
import { enforceQueryOwnership } from "#/common/ownership";
import { PathsV1 } from "#/common/paths";
import { payloadValidator } from "#/common/zod-utils";
import * as QueriesService from "./queries.services";
import {
  AddQueryRequestSchema,
  DeleteQueryRequestSchema,
  ExecuteQueryRequestSchema,
} from "./queries.types";
import type { ControllerOptions } from "#/common/types";
import {
  enforceCapability,
  RoleSchema,
  verifyNucAndLoadSubject,
} from "#/middleware/capability.middleware";
import type { AppContext } from "#/env";
import type { NucToken } from "@nillion/nuc";
import { NucCmd } from "#/common/nuc-cmd-tree";

export function add(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.queries.root;
  const guard = {
    path,
    cmd: NucCmd.nil.db.queries,
    roles: [RoleSchema.enum.organization],
    // TODO: implement policy validation fix json on body type inference
    validate: (_c: AppContext, _token: NucToken) => true,
  };

  app.post(
    path,
    payloadValidator(AddQueryRequestSchema),
    verifyNucAndLoadSubject(bindings),
    enforceCapability(bindings, guard),
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
  const guard = {
    path,
    cmd: NucCmd.nil.db.queries,
    roles: [RoleSchema.enum.organization],
    // TODO: implement policy validation fix json on body type inference
    validate: (_c: AppContext, _token: NucToken) => true,
  };

  app.delete(
    path,
    payloadValidator(DeleteQueryRequestSchema),
    verifyNucAndLoadSubject(bindings),
    enforceCapability(bindings, guard),
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
  const guard = {
    path,
    cmd: NucCmd.nil.db.queries,
    roles: [RoleSchema.enum.organization],
    // TODO: implement policy validation fix json on body type inference
    validate: (_c: AppContext, _token: NucToken) => true,
  };

  app.post(
    path,
    payloadValidator(ExecuteQueryRequestSchema),
    verifyNucAndLoadSubject(bindings),
    enforceCapability(bindings, guard),
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
  const guard = {
    path,
    cmd: NucCmd.nil.db.queries,
    roles: [RoleSchema.enum.organization],
    // TODO: implement policy validation fix json on body type inference
    validate: (_c: AppContext, _token: NucToken) => true,
  };

  app.get(
    path,
    verifyNucAndLoadSubject(bindings),
    enforceCapability(bindings, guard),
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
