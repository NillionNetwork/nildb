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
import { UpdateDataResponse } from "#/data/data.dto";
import { DataMapper } from "#/data/data.mapper";
import * as DataService from "#/data/data.services";
import type { OwnedDocumentBase } from "#/data/data.types";
import {
  loadNucToken,
  loadSubjectAndVerifyAsUser,
  requireNucNamespace,
} from "#/middleware/capability.middleware";
import {
  DeleteDocumentRequestParams,
  GrantAccessToDataRequest,
  GrantAccessToDataResponse,
  ListDataReferencesResponse,
  ReadDataRequestParams,
  ReadDataResponse,
  ReadProfileResponse,
  RevokeAccessToDataRequest,
  RevokeAccessToDataResponse,
  UpdateUserDataRequest,
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
      summary: "Read profile",
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
    requireNucNamespace(NucCmd.nil.db.users.read),
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
      summary: "List data references",
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
    requireNucNamespace(NucCmd.nil.db.users.read),
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
 * Handle GET /v1/users/data/:collection/:document
 */
export function readData(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.users.data.byId;

  app.get(
    path,
    describeRoute({
      tags: ["Users"],
      security: [{ bearerAuth: [] }],
      summary: "Read data",
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
    zValidator("param", ReadDataRequestParams),
    loadNucToken(bindings),
    loadSubjectAndVerifyAsUser(bindings),
    requireNucNamespace(NucCmd.nil.db.users.read),
    async (c) => {
      const user = c.get("user");
      const params = c.req.valid("param");
      const command = UserDataMapper.toFindDataCommand(user, params);

      return pipe(
        enforceDataOwnership(user, command.document, command.collection),
        E.flatMap(() => DataService.readRecords(c.env, command)),
        E.map((documents) => documents as OwnedDocumentBase[]),
        E.map((document) => UserDataMapper.toReadDataResponse(document)),
        E.map((response) => c.json(response)),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

/**
 * Handle POST /v1/users/data
 */
export function updateData(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.users.data.root;

  app.post(
    path,
    describeRoute({
      tags: ["Users"],
      security: [{ bearerAuth: [] }],
      summary: "Update user data",
      responses: {
        200: {
          description: "OK",
          content: {
            "application/json": {
              schema: resolver(UpdateDataResponse),
            },
          },
        },
        ...OpenApiSpecCommonErrorResponses,
      },
    }),
    zValidator("json", UpdateUserDataRequest),
    loadNucToken(bindings),
    loadSubjectAndVerifyAsUser(bindings),
    requireNucNamespace(NucCmd.nil.db.users.update),
    async (c) => {
      const user = c.get("user");
      const payload = c.req.valid("json");
      const command = UserDataMapper.toUpdateDataCommand(payload);

      return pipe(
        enforceDataOwnership(user, command.document, command.collection),
        E.flatMap(() => DataService.updateRecords(c.env, command)),
        E.map((result) => DataMapper.toUpdateDataResponse(result)),
        E.map((response) => c.json<UpdateDataResponse>(response)),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

/**
 * Handle DELETE /v1/users/data/:collection/:document
 */
export function deleteData(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.users.data.byId;

  app.delete(
    path,
    describeRoute({
      tags: ["Users"],
      security: [{ bearerAuth: [] }],
      summary: "Delete data",
      responses: {
        204: OpenApiSpecEmptySuccessResponses[204],
        ...OpenApiSpecCommonErrorResponses,
      },
    }),
    zValidator("param", DeleteDocumentRequestParams),
    loadNucToken(bindings),
    loadSubjectAndVerifyAsUser(bindings),
    requireNucNamespace(NucCmd.nil.db.users.delete),
    async (c) => {
      const user = c.get("user");
      const params = c.req.valid("param");
      const command = UserDataMapper.toDeleteDataCommand(user, params);

      return pipe(
        enforceDataOwnership(user, command.document, command.collection),
        E.flatMap(() => DataService.deleteData(c.env, command)),
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
      summary: "Grant access",
      responses: {
        204: OpenApiSpecEmptySuccessResponses[204],
        ...OpenApiSpecCommonErrorResponses,
      },
    }),
    zValidator("json", GrantAccessToDataRequest),
    loadNucToken(bindings),
    loadSubjectAndVerifyAsUser(bindings),
    requireNucNamespace(NucCmd.nil.db.users.update),
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
      summary: "Revoke access",
      responses: {
        204: OpenApiSpecEmptySuccessResponses[204],
        ...OpenApiSpecCommonErrorResponses,
      },
    }),
    zValidator("json", RevokeAccessToDataRequest),
    loadNucToken(bindings),
    loadSubjectAndVerifyAsUser(bindings),
    requireNucNamespace(NucCmd.nil.db.users.update),
    async (c) => {
      const user = c.get("user");
      const payload = c.req.valid("json");
      const command = UserDataMapper.toRevokeDataAccessCommand(user, payload);

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
