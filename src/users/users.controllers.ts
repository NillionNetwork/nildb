import { Effect as E, pipe } from "effect";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { handleTaggedErrors } from "#/common/handler";
import { NucCmd } from "#/common/nuc-cmd-tree";
import { OpenApiSpecCommonErrorResponses } from "#/common/openapi";
import { enforceDataOwnership } from "#/common/ownership";
import { PathsV1 } from "#/common/paths";
import type { ControllerOptions } from "#/common/types";
import {
  enforceCapability,
  loadNucToken,
  loadSubjectAndVerifyAsUser,
} from "#/middleware/capability.middleware";
import {
  AddPermissionsRequest,
  AddPermissionsResponse,
  DeletePermissionsRequest,
  DeletePermissionsResponse,
  ListUserDataResponse,
  ReadPermissionsRequest,
  ReadPermissionsResponse,
  UpdatePermissionsRequest,
  UpdatePermissionsResponse,
} from "#/users/users.dto";
import { UserDataMapper } from "#/users/users.mapper";
import * as UserService from "#/users/users.services";

/**
 * Lists all data documents owned by the authenticated user.
 *
 * @param options - Controller configuration including app instance
 */
export function list(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.users.data.root;

  app.get(
    path,
    describeRoute({
      tags: ["User Data"],
      security: [{ bearerAuth: [] }],
      summary: "List user data",
      description:
        "Retrieves all data documents owned by the authenticated user.",
      responses: {
        200: {
          description: "User data retrieved successfully",
          content: {
            "application/json": {
              schema: resolver(ListUserDataResponse),
            },
          },
        },
        ...OpenApiSpecCommonErrorResponses,
      },
    }),
    loadNucToken(bindings),
    loadSubjectAndVerifyAsUser(bindings),
    enforceCapability({
      path,
      cmd: NucCmd.nil.db.user,
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const user = c.get("user");
      return pipe(
        UserService.listUserData(c.env, user._id),
        E.map((documents) => UserDataMapper.toListUserDataResponse(documents)),
        E.map((response) => c.json<ListUserDataResponse>(response)),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

/**
 * Reads permissions for a specific data document.
 *
 * @param options - Controller configuration including app instance
 */
export function readPermissions(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.users.data.perms.read;

  app.post(
    path,
    describeRoute({
      tags: ["User Data"],
      security: [{ bearerAuth: [] }],
      summary: "Read document permissions",
      description:
        "Retrieves all permissions configured for a specific data document.",
      responses: {
        200: {
          description: "Permissions retrieved successfully",
          content: {
            "application/json": {
              schema: resolver(ReadPermissionsResponse),
            },
          },
        },
        ...OpenApiSpecCommonErrorResponses,
      },
    }),
    zValidator("json", ReadPermissionsRequest),
    loadNucToken(bindings),
    loadSubjectAndVerifyAsUser(bindings),
    enforceCapability({
      path,
      cmd: NucCmd.nil.db.user,
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const user = c.get("user");
      const payload = c.req.valid("json");
      const command = UserDataMapper.toReadPermissionsCommand(payload);

      return pipe(
        enforceDataOwnership(user, command.documentId, command.schema),
        E.flatMap(() => UserService.readPermissions(c.env, command)),
        E.map((permissions) =>
          UserDataMapper.toReadPermissionsResponse(permissions),
        ),
        E.map((response) => c.json<ReadPermissionsResponse>(response)),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

/**
 * Adds new permissions to a data document.
 *
 * @param options - Controller configuration including app instance
 */
export function addPermissions(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.users.data.perms.add;

  app.post(
    path,
    describeRoute({
      tags: ["User Data"],
      security: [{ bearerAuth: [] }],
      summary: "Add document permissions",
      description:
        "Grants new permissions to a DID for accessing a specific data document.",
      responses: {
        200: {
          description: "Permissions added successfully",
          content: {
            "application/json": {
              schema: resolver(AddPermissionsResponse),
            },
          },
        },
        ...OpenApiSpecCommonErrorResponses,
      },
    }),
    zValidator("json", AddPermissionsRequest),
    loadNucToken(bindings),
    loadSubjectAndVerifyAsUser(bindings),
    enforceCapability({
      path,
      cmd: NucCmd.nil.db.user,
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const user = c.get("user");
      const payload = c.req.valid("json");
      const command = UserDataMapper.toAddPermissionsCommand(payload);

      return pipe(
        enforceDataOwnership(user, command.documentId, command.schema),
        E.flatMap(() => UserService.addPermissions(c.env, command)),
        E.map((result) => UserDataMapper.toAddPermissionsResponse(result)),
        E.map((response) => c.json<AddPermissionsResponse>(response)),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

/**
 * Updates existing permissions for a data document.
 *
 * @param options - Controller configuration including app instance
 */
export function updatePermissions(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.users.data.perms.update;

  app.post(
    path,
    describeRoute({
      tags: ["User Data"],
      security: [{ bearerAuth: [] }],
      summary: "Update document permissions",
      description:
        "Modifies existing permissions for a DID on a specific data document.",
      responses: {
        200: {
          description: "Permissions updated successfully",
          content: {
            "application/json": {
              schema: resolver(UpdatePermissionsResponse),
            },
          },
        },
        ...OpenApiSpecCommonErrorResponses,
      },
    }),
    zValidator("json", UpdatePermissionsRequest),
    loadNucToken(bindings),
    loadSubjectAndVerifyAsUser(bindings),
    enforceCapability({
      path,
      cmd: NucCmd.nil.db.user,
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const user = c.get("user");
      const payload = c.req.valid("json");
      const command = UserDataMapper.toUpdatePermissionsCommand(payload);

      return pipe(
        enforceDataOwnership(user, command.documentId, command.schema),
        E.flatMap(() => UserService.updatePermissions(c.env, command)),
        E.map((result) => UserDataMapper.toUpdatePermissionsResponse(result)),
        E.map((response) => c.json<UpdatePermissionsResponse>(response)),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

/**
 * Deletes permissions from a data document.
 *
 * @param options - Controller configuration including app instance
 */
export function deletePermissions(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.users.data.perms.delete;

  app.post(
    path,
    describeRoute({
      tags: ["User Data"],
      security: [{ bearerAuth: [] }],
      summary: "Delete document permissions",
      description:
        "Revokes permissions from a DID for accessing a specific data document.",
      responses: {
        200: {
          description: "Permissions deleted successfully",
          content: {
            "application/json": {
              schema: resolver(DeletePermissionsResponse),
            },
          },
        },
        ...OpenApiSpecCommonErrorResponses,
      },
    }),
    zValidator("json", DeletePermissionsRequest),
    loadNucToken(bindings),
    loadSubjectAndVerifyAsUser(bindings),
    enforceCapability({
      path,
      cmd: NucCmd.nil.db.user,
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const user = c.get("user");
      const payload = c.req.valid("json");
      const command = UserDataMapper.toDeletePermissionsCommand(payload);

      return pipe(
        enforceDataOwnership(user, command.documentId, command.schema),
        E.flatMap(() => UserService.deletePermissions(c.env, command)),
        E.map((result) => UserDataMapper.toDeletePermissionsResponse(result)),
        E.map((response) => c.json<DeletePermissionsResponse>(response)),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}
