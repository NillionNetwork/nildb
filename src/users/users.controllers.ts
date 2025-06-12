import { Effect as E, pipe } from "effect";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { getReasonPhrase, StatusCodes } from "http-status-codes";
import { handleTaggedErrors } from "#/common/handler";
import { NucCmd } from "#/common/nuc-cmd-tree";
import {
  OpenApiSpecCommonErrorResponses,
  OpenApiSpecEmptySuccessResponses,
} from "#/common/openapi";
import { enforceDataOwnership } from "#/common/ownership";
import { PathsV1 } from "#/common/paths";
import type { ControllerOptions } from "#/common/types";
import * as DataService from "#/data/data.services";
import type { OwnedDocumentBase } from "#/data/data.types";
import {
  enforceCapability,
  loadNucToken,
  loadSubjectAndVerifyAsUser,
} from "#/middleware/capability.middleware";
import {
  DeleteDocumentRequestParams,
  GrantAccessToDataRequest,
  GrantAccessToDataResponse,
  ListDataReferencesResponse,
  ReadDataResponse,
  ReadProfileResponse,
  RevokeAccessToDataRequest,
  RevokeAccessToDataResponse,
} from "#/users/users.dto";
import { UserDataMapper } from "#/users/users.mapper";
import * as UserService from "#/users/users.services";

/**
 * Handle GET /v1/users/me
 */
export function readProfile(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.users.me;

  app.get(
    path,
    describeRoute({
      tags: ["Users"],
      security: [{ bearerAuth: [] }],
      summary: "Retrieve the user's profile",
      responses: {
        200: {
          description: "OK",
          content: {
            "application/json": {
              schema: resolver(ReadProfileResponse),
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
      cmd: NucCmd.nil.db.users.read,
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const user = c.get("user");

      return pipe(
        UserService.find(c.env, user._id),
        E.map((profile) => UserDataMapper.toReadProfileResponse(profile)),
        E.map((response) => c.json<ReadProfileResponse>(response)),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

/**
 * Handle GET /v1/users/data endpoint.
 */
export function listDataReferences(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.users.data.root;

  app.get(
    path,
    describeRoute({
      tags: ["Users"],
      security: [{ bearerAuth: [] }],
      summary: "List the user's data document references",
      responses: {
        200: {
          description: "OK",
          content: {
            "application/json": {
              schema: resolver(ListDataReferencesResponse),
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
      cmd: NucCmd.nil.db.users.read,
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const user = c.get("user");
      return pipe(
        UserService.listUserDataReferences(c.env, user._id),
        E.map((documents) =>
          UserDataMapper.toListDataReferencesResponse(documents),
        ),
        E.map((response) => c.json<ListDataReferencesResponse>(response)),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

/**
 * Handle GET /v1/users/data/:schema/:document
 */
export function readData(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.users.data.byId;

  app.get(
    path,
    describeRoute({
      tags: ["Users"],
      security: [{ bearerAuth: [] }],
      summary: "Retrieves a user-owned document",
      responses: {
        200: {
          description: "OK",
          content: {
            "application/json": {
              schema: resolver(ReadDataResponse),
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
      cmd: NucCmd.nil.db.users.read,
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const user = c.get("user");
      const params = c.req.valid("param");
      const command = UserDataMapper.toFindDataCommand(user, params);

      return pipe(
        // TODO: Do we want to simply have _owner as part of the query or do we want to do enforcement?
        DataService.readRecords(c.env, command),
        E.map((documents) => documents as OwnedDocumentBase[]),
        // TODO: This should return 1 document or null ... need to deal with this more elegantly
        E.map((document) => UserDataMapper.toReadDataResponse(document)),
        E.map((response) => c.json(response)),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

/**
 * Handle DELETE /v1/users/data/:schema/:document
 */
export function deleteData(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.users.data.byId;

  app.delete(
    path,
    describeRoute({
      tags: ["Users"],
      security: [{ bearerAuth: [] }],
      summary:
        "Delete a user owned document by specifying the schema an document",
      responses: {
        204: OpenApiSpecEmptySuccessResponses[204],
        ...OpenApiSpecCommonErrorResponses,
      },
    }),
    zValidator("param", DeleteDocumentRequestParams),
    loadNucToken(bindings),
    loadSubjectAndVerifyAsUser(bindings),
    enforceCapability({
      path,
      cmd: NucCmd.nil.db.users.delete,
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const user = c.get("user");
      const params = c.req.valid("param");
      const command = UserDataMapper.toDeleteDataCommand(user, params);

      return pipe(
        enforceDataOwnership(user, command.document, command.collection),
        // E.map(() => DeleteDocumentResponse),
        E.map(() =>
          c.text(
            getReasonPhrase(StatusCodes.NOT_IMPLEMENTED),
            StatusCodes.NOT_IMPLEMENTED,
          ),
        ),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

/**
 * Handle POST /v1/users/data/acl/grant
 */
export function grantAccess(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.users.data.acl.grant;

  app.post(
    path,
    describeRoute({
      tags: ["Users"],
      security: [{ bearerAuth: [] }],
      summary: "Grant a Did access to user-owned data",
      responses: {
        204: OpenApiSpecEmptySuccessResponses[204],
        ...OpenApiSpecCommonErrorResponses,
      },
    }),
    zValidator("json", GrantAccessToDataRequest),
    loadNucToken(bindings),
    loadSubjectAndVerifyAsUser(bindings),
    enforceCapability({
      path,
      cmd: NucCmd.nil.db.users.update,
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const user = c.get("user");
      const payload = c.req.valid("json");
      const command = UserDataMapper.toGrantDataAccessCommand(user, payload);

      return pipe(
        enforceDataOwnership(user, command.document, command.collection),
        E.flatMap(() => UserService.grantAccess(c.env, command)),
        E.map((_result) => GrantAccessToDataResponse),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

/**
 * Handle POST /v1/users/data/acl/revoke
 */
export function revokeAccess(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.users.data.acl.revoke;

  // POST /v1/users/data/acl/revoke
  app.post(
    path,
    describeRoute({
      tags: ["Users"],
      security: [{ bearerAuth: [] }],
      summary: "Remove a user-owned data Acl",
      responses: {
        204: OpenApiSpecEmptySuccessResponses[204],
        ...OpenApiSpecCommonErrorResponses,
      },
    }),
    zValidator("json", RevokeAccessToDataRequest),
    loadNucToken(bindings),
    loadSubjectAndVerifyAsUser(bindings),
    enforceCapability({
      path,
      cmd: NucCmd.nil.db.users.update,
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const user = c.get("user");
      const payload = c.req.valid("json");
      const command = UserDataMapper.toRevokeDataAccessCommand(user, payload);

      // TODO: What should happen if the user revokes permissions for the schema owner?

      return pipe(
        enforceDataOwnership(user, command.document, command.collection),
        E.flatMap(() => UserService.revokeAccess(c.env, command)),
        E.map((_response) => RevokeAccessToDataResponse),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}
