import { Effect as E, pipe } from "effect";
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
import * as UserService from "#/user/user.services";
import { type UserDataRequest, UserDataRequestSchema } from "#/user/user.types";

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

export function addPermission() {}

export function removePermission() {}
