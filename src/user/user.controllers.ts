import { Effect as E, pipe } from "effect";
import type { OrganizationAccountDocument } from "#/accounts/accounts.mapper";
import { handleTaggedErrors } from "#/common/handler";
import { NucCmd } from "#/common/nuc-cmd-tree";
import { enforceSchemaOwnership } from "#/common/ownership";
import { PathsV1 } from "#/common/paths";
import type { ControllerOptions } from "#/common/types";
import { payloadValidator } from "#/common/zod-utils";
import {
  enforceCapability,
  RoleSchema,
  verifyNucAndLoadSubject,
} from "#/middleware/capability.middleware";
import * as UserService from "#/user/user.services";
import {
  type AddPermissionsRequest,
  AddPermissionsRequestSchema,
  type DeletePermissionsRequest,
  DeletePermissionsRequestSchema,
  type ReadPermissionsRequest,
  ReadPermissionsRequestSchema,
  type UpdatePermissionsRequest,
  UpdatePermissionsRequestSchema,
  type UserDataRequest,
  UserDataRequestSchema,
} from "#/user/user.types";

export function list(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.user.data.root;

  app.post(
    path,
    payloadValidator(UserDataRequestSchema),
    verifyNucAndLoadSubject(bindings),
    enforceCapability<{ json: UserDataRequest }>({
      path,
      cmd: NucCmd.nil.db.user,
      roles: [RoleSchema.enum.organization],
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const payload = c.req.valid("json");
      return pipe(
        UserService.listUserData(c.env, payload.userId),
        E.map((data) => c.json({ data })),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

export function readPermissions(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.user.data.perms.read;

  app.post(
    path,
    payloadValidator(ReadPermissionsRequestSchema),
    verifyNucAndLoadSubject(bindings),
    enforceCapability<{ json: ReadPermissionsRequest }>({
      path,
      cmd: NucCmd.nil.db.data,
      roles: [RoleSchema.enum.organization],
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const account = c.get("account") as OrganizationAccountDocument;
      const payload = c.req.valid("json");

      return pipe(
        enforceSchemaOwnership(account, payload.schema),
        E.flatMap(() => UserService.readPermissions(c.env, payload)),
        E.map((data) => c.json({ data })),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

export function addPermissions(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.user.data.perms.add;

  app.post(
    path,
    payloadValidator(AddPermissionsRequestSchema),
    verifyNucAndLoadSubject(bindings),
    enforceCapability<{ json: AddPermissionsRequest }>({
      path,
      cmd: NucCmd.nil.db.data,
      roles: [RoleSchema.enum.organization],
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const account = c.get("account") as OrganizationAccountDocument;
      const payload = c.req.valid("json");

      return pipe(
        enforceSchemaOwnership(account, payload.schema),
        E.flatMap(() => UserService.addPermissions(c.env, payload)),
        E.map((data) =>
          c.json({
            data,
          }),
        ),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

export function updatePermissions(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.user.data.perms.update;

  app.post(
    path,
    payloadValidator(UpdatePermissionsRequestSchema),
    verifyNucAndLoadSubject(bindings),
    enforceCapability<{ json: UpdatePermissionsRequest }>({
      path,
      cmd: NucCmd.nil.db.data,
      roles: [RoleSchema.enum.organization],
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const account = c.get("account") as OrganizationAccountDocument;
      const payload = c.req.valid("json");

      return pipe(
        enforceSchemaOwnership(account, payload.schema),
        E.flatMap(() => UserService.updatePermissions(c.env, payload)),
        E.map((data) =>
          c.json({
            data,
          }),
        ),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

export function deletePermissions(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.user.data.perms.delete;

  app.post(
    path,
    payloadValidator(DeletePermissionsRequestSchema),
    verifyNucAndLoadSubject(bindings),
    enforceCapability<{ json: DeletePermissionsRequest }>({
      path,
      cmd: NucCmd.nil.db.data,
      roles: [RoleSchema.enum.organization],
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const account = c.get("account") as OrganizationAccountDocument;
      const payload = c.req.valid("json");

      return pipe(
        enforceSchemaOwnership(account, payload.schema),
        E.flatMap(() => UserService.deletePermissions(c.env, payload)),
        E.map((data) =>
          c.json({
            data,
          }),
        ),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}
