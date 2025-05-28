import { Effect as E, pipe } from "effect";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { ReasonPhrases } from "http-status-codes";
import { handleTaggedErrors } from "#/common/handler";
import { NucCmd } from "#/common/nuc-cmd-tree";
import {
  OpenApiSpecCommonErrorResponses,
  OpenApiSpecEmptySuccessResponses,
} from "#/common/openapi";
import { PathsV1 } from "#/common/paths";
import type { ControllerOptions } from "#/common/types";
import {
  enforceCapability,
  RoleSchema,
  verifyNucAndLoadSubject,
} from "#/middleware/capability.middleware";
import {
  DeleteAccountResponse,
  GetProfileResponse,
  RegisterAccountRequest,
  RegisterAccountResponse,
  UpdateProfileRequest,
  UpdateProfileResponse,
} from "./accounts.dto";
import { AccountDataMapper } from "./accounts.mapper";
import * as AccountService from "./accounts.services";

/**
 * Registers the account registration endpoint.
 *
 * Accepts a DID and name, validates the request, converts DTO to domain model,
 * and delegates to the service layer for account creation.
 *
 * @param options - Controller configuration including app instance
 */
export function register(options: ControllerOptions): void {
  const { app } = options;
  const path = PathsV1.accounts.register;

  app.post(
    path,
    describeRoute({
      tags: ["Accounts"],
      summary: "Register a new account",
      description:
        "Creates a new account with the provided DID and name. Returns 201 with no content on success.",
      responses: {
        201: OpenApiSpecEmptySuccessResponses["201"],
        400: OpenApiSpecCommonErrorResponses["400"],
        500: OpenApiSpecCommonErrorResponses["500"],
      },
    }),
    zValidator("json", RegisterAccountRequest),
    async (c) => {
      const payload = c.req.valid("json");

      return pipe(
        AccountDataMapper.fromRegisterAccountRequest(payload),
        (partial) => AccountService.createAccount(c.env, partial),
        E.map(() => RegisterAccountResponse),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

/**
 * Registers the profile retrieval endpoint.
 *
 * Authenticates the user, validates their capability, retrieves account data
 * from the service layer, and converts the domain model to a DTO response.
 *
 * @param options - Controller configuration including app instance and bindings
 */
export function getProfile(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.accounts.me;

  app.get(
    path,
    describeRoute({
      tags: ["Accounts"],
      security: [{ bearerAuth: [] }],
      summary: "Get your profile",
      description: "Retrieves the profile for the authenticated user.",
      responses: {
        200: {
          description: "Profile retrieved",
          content: {
            "application/json": {
              schema: resolver(GetProfileResponse),
            },
          },
        },
        ...OpenApiSpecCommonErrorResponses,
      },
    }),
    verifyNucAndLoadSubject(bindings),
    enforceCapability({
      path,
      cmd: NucCmd.nil.db.accounts,
      roles: [RoleSchema.enum.organization],
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const account = c.get("account");
      return pipe(
        AccountService.find(c.env, account._id),
        E.map((account) => AccountDataMapper.toGetProfileResponse(account)),
        E.map((profile) => c.json<GetProfileResponse>(profile)),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

/**
 * Registers the account deletion endpoint.
 *
 * Authenticates the user, validates their capability, and delegates
 * to the service layer for permanent account removal.
 *
 * @param options - Controller configuration including app instance and bindings
 */
export function _delete(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.accounts.me;

  app.delete(
    path,
    describeRoute({
      tags: ["Accounts"],
      security: [{ bearerAuth: [] }],
      summary: "Delete your account",
      description:
        "Permanently delete the authenticated user's account (cannot be undone)",
      responses: {
        204: OpenApiSpecEmptySuccessResponses["204"],
        ...OpenApiSpecCommonErrorResponses,
      },
    }),
    verifyNucAndLoadSubject(bindings),
    enforceCapability({
      path,
      cmd: NucCmd.nil.db.accounts,
      roles: [RoleSchema.enum.organization],
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const account = c.get("account");

      return pipe(
        AccountService.remove(c.env, account._id),
        E.map(() => DeleteAccountResponse),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

/**
 * Registers the profile update endpoint.
 *
 * Authenticates the user, validates their capability and request,
 * then delegates to the service layer for profile updates.
 *
 * @param options - Controller configuration including app instance and bindings
 */
export function updateProfile(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.accounts.me;

  app.post(
    path,
    describeRoute({
      tags: ["Accounts"],
      security: [{ bearerAuth: [] }],
      summary: "Update your profile",
      description: "Update your profile",
      responses: {
        200: OpenApiSpecEmptySuccessResponses["200"],
        ...OpenApiSpecCommonErrorResponses,
        501: {
          description: ReasonPhrases.NOT_IMPLEMENTED,
        },
      },
    }),
    zValidator("json", UpdateProfileRequest),
    verifyNucAndLoadSubject(bindings),
    enforceCapability<{ json: UpdateProfileRequest }>({
      path,
      cmd: NucCmd.nil.db.accounts,
      roles: [RoleSchema.enum.organization],
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const account = c.get("account");

      return pipe(
        c.req.valid("json"),
        (updates) => AccountService.updateProfile(c.env, account._id, updates),
        E.map(() => UpdateProfileResponse),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}
