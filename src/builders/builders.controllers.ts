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
  loadNucToken,
  loadSubjectAndVerifyAsBuilder,
} from "#/middleware/capability.middleware";
import {
  DeleteBuilderResponse,
  GetProfileResponse,
  RegisterBuilderRequest,
  RegisterBuilderResponse,
  UpdateProfileRequest,
  UpdateProfileResponse,
} from "./builders.dto";
import { BuilderDataMapper } from "./builders.mapper";
import * as BuilderService from "./builders.services";

/**
 * Registers the builder registration endpoint.
 *
 * Accepts a DID and name, validates the request, converts DTO to domain model,
 * and delegates to the service layer for builder creation.
 *
 * @param options - Controller configuration including app instance
 */
export function register(options: ControllerOptions): void {
  const { app } = options;
  const path = PathsV1.builders.register;

  app.post(
    path,
    describeRoute({
      tags: ["Builders"],
      summary: "Register a new builder",
      description: "Creates a new builder with the provided DID and name.",
      responses: {
        201: OpenApiSpecEmptySuccessResponses["201"],
        400: OpenApiSpecCommonErrorResponses["400"],
        500: OpenApiSpecCommonErrorResponses["500"],
      },
    }),
    zValidator("json", RegisterBuilderRequest),
    async (c) => {
      const payload = c.req.valid("json");
      const command = BuilderDataMapper.toCreateBuilderCommand(payload);

      return pipe(
        BuilderService.createBuilder(c.env, command),
        E.map(() => RegisterBuilderResponse),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

/**
 * Registers the profile retrieval endpoint.
 *
 * Authenticates the user, validates their capability, retrieves builder data
 * from the service layer, and converts the domain model to a DTO response.
 *
 * @param options - Controller configuration including app instance and bindings
 */
export function getProfile(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.builders.me;

  app.get(
    path,
    describeRoute({
      tags: ["Builders"],
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
    loadNucToken(bindings),
    loadSubjectAndVerifyAsBuilder(bindings),
    enforceCapability({
      path,
      cmd: NucCmd.nil.db.builders,
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const builder = c.get("builder");
      return pipe(
        BuilderService.find(c.env, builder._id),
        E.map((builder) => BuilderDataMapper.toGetProfileResponse(builder)),
        E.map((response) => c.json<GetProfileResponse>(response)),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

/**
 * Registers the builder deletion endpoint.
 *
 * Authenticates the user, validates their capability, and delegates
 * to the service layer for permanent builder removal.
 *
 * @param options - Controller configuration including app instance and bindings
 */
export function _delete(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.builders.me;

  app.delete(
    path,
    describeRoute({
      tags: ["Builders"],
      security: [{ bearerAuth: [] }],
      summary: "Delete your builder",
      description:
        "Permanently deletes the authenticated user's builder. This action cannot be undone.",
      responses: {
        204: OpenApiSpecEmptySuccessResponses["204"],
        ...OpenApiSpecCommonErrorResponses,
      },
    }),
    loadNucToken(bindings),
    loadSubjectAndVerifyAsBuilder(bindings),
    enforceCapability({
      path,
      cmd: NucCmd.nil.db.builders,
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const builder = c.get("builder");

      return pipe(
        BuilderService.remove(c.env, builder._id),
        E.map(() => DeleteBuilderResponse),
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
  const path = PathsV1.builders.me;

  app.post(
    path,
    describeRoute({
      tags: ["Builders"],
      security: [{ bearerAuth: [] }],
      summary: "Update your profile",
      description:
        "Updates the profile information for the authenticated user.",
      responses: {
        200: OpenApiSpecEmptySuccessResponses["200"],
        ...OpenApiSpecCommonErrorResponses,
        501: {
          description: ReasonPhrases.NOT_IMPLEMENTED,
        },
      },
    }),
    zValidator("json", UpdateProfileRequest),
    loadNucToken(bindings),
    loadSubjectAndVerifyAsBuilder(bindings),
    enforceCapability<{ json: UpdateProfileRequest }>({
      path,
      cmd: NucCmd.nil.db.builders,
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const builder = c.get("builder");
      const payload = c.req.valid("json");
      const command = BuilderDataMapper.toUpdateProfileCommand(
        payload,
        builder._id,
      );

      return pipe(
        BuilderService.updateProfile(c.env, command),
        E.map(() => UpdateProfileResponse),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}
