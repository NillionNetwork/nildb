import { Effect as E, pipe } from "effect";
import { StatusCodes } from "http-status-codes";
import * as AccountService from "#/accounts/accounts.services";
import { handleTaggedErrors } from "#/common/handler";
import { NucCmd } from "#/common/nuc-cmd-tree";
import { PathsV1 } from "#/common/paths";
import type { ControllerOptions } from "#/common/types";
import { payloadValidator } from "#/common/zod-utils";
import {
  enforceCapability,
  RoleSchema,
  verifyNucAndLoadSubject,
} from "#/middleware/capability.middleware";
import * as AdminService from "./admin.services";
import {
  type AdminCreateAccountRequest,
  AdminCreateAccountRequestSchema,
  type AdminDeleteAccountRequest,
  AdminDeleteAccountRequestSchema,
} from "./admin.types";

export function create(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.admin.accounts.root;

  app.post(
    path,
    payloadValidator(AdminCreateAccountRequestSchema),
    verifyNucAndLoadSubject(bindings),
    enforceCapability<{ json: AdminCreateAccountRequest }>({
      path,
      cmd: NucCmd.nil.db.admin,
      roles: [RoleSchema.enum.root, RoleSchema.enum.admin],
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const payload = c.req.valid("json");

      return pipe(
        AccountService.createAccount(c.env, payload),
        E.map(() => new Response(null, { status: StatusCodes.CREATED })),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

export function remove(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.admin.accounts.root;

  app.delete(
    path,
    payloadValidator(AdminDeleteAccountRequestSchema),
    verifyNucAndLoadSubject(bindings),
    enforceCapability<{ json: AdminDeleteAccountRequest }>({
      path,
      cmd: NucCmd.nil.db.admin,
      roles: [RoleSchema.enum.admin],
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const payload = c.req.valid("json");

      return pipe(
        AdminService.deleteAccount(c.env, payload.id),
        E.map(() => new Response(null, { status: StatusCodes.NO_CONTENT })),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

export function list(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.admin.accounts.root;

  app.get(
    path,
    verifyNucAndLoadSubject(bindings),
    enforceCapability({
      path,
      cmd: NucCmd.nil.db.admin,
      roles: [RoleSchema.enum.admin],
      validate: (_c, _token) => true,
    }),
    async (c) => {
      return pipe(
        AdminService.listAllAccounts(c.env),
        E.map((data) => c.json({ data })),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}
