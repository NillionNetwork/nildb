import { Effect as E, pipe } from "effect";
import { handleTaggedErrors } from "#/common/handler";
import { enforceDataOwnership } from "#/common/ownership";
import { PathsV1 } from "#/common/paths";
import type { ControllerOptions } from "#/common/types";
import { payloadValidator } from "#/common/zod-utils";
import {
  RoleSchema,
  verifyNucAndLoadSubject,
} from "#/middleware/capability.middleware";
import * as UserService from "#/user/user.services";
import {
  AddPermissionsRequestSchema,
  DeletePermissionsRequestSchema,
  ReadPermissionsRequestSchema,
  UpdatePermissionsRequestSchema,
} from "#/user/user.types";

export function list(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.user.data.root;

  app.get(
    path,
    verifyNucAndLoadSubject(bindings, RoleSchema.enum.user),
    async (c) => {
      const user = c.get("user");
      return pipe(
        UserService.listUserData(c.env, user._id),
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
    verifyNucAndLoadSubject(bindings, RoleSchema.enum.user),
    async (c) => {
      const user = c.get("user");
      const payload = c.req.valid("json");

      return pipe(
        enforceDataOwnership(user, payload.documentId, payload.schema),
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
    verifyNucAndLoadSubject(bindings, RoleSchema.enum.user),
    async (c) => {
      const user = c.get("user");
      const payload = c.req.valid("json");

      return pipe(
        enforceDataOwnership(user, payload.documentId, payload.schema),
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
    verifyNucAndLoadSubject(bindings, RoleSchema.enum.user),
    async (c) => {
      const user = c.get("user");
      const payload = c.req.valid("json");

      return pipe(
        enforceDataOwnership(user, payload.documentId, payload.schema),
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
    verifyNucAndLoadSubject(bindings, RoleSchema.enum.user),
    async (c) => {
      const user = c.get("user");
      const payload = c.req.valid("json");

      return pipe(
        enforceDataOwnership(user, payload.documentId, payload.schema),
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
