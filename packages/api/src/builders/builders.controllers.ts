import { handleTaggedErrors } from "@nildb/common/handler";
import { OpenApiSpecCommonErrorResponses, OpenApiSpecEmptySuccessResponses } from "@nildb/common/openapi";
import type { ControllerOptions } from "@nildb/common/types";
import {
  loadNucToken,
  loadSubjectAndVerifyAsBuilder,
  requireNucNamespace,
} from "@nildb/middleware/capability.middleware";
import { Effect as E, pipe } from "effect";
import { describeRoute, resolver, validator as zValidator } from "hono-openapi";
import { StatusCodes } from "http-status-codes";

import {
  type DeleteBuilderResponse,
  NucCmd,
  PathsV1,
  ReadProfileResponse,
  RegisterBuilderRequest,
  type RegisterBuilderResponse,
  UpdateProfileRequest,
  type UpdateProfileResponse,
} from "@nillion/nildb-types";

import { BuilderDataMapper } from "./builders.mapper.js";
import * as BuilderService from "./builders.services.js";

/**
 * Handle POST /v1/builders/register
 */
export function register(options: ControllerOptions): void {
  const { app } = options;
  const path = PathsV1.builders.register;

  app.post(
    path,
    describeRoute({
      tags: ["Builders"],
      summary: "Register builder",
      responses: {
        201: OpenApiSpecEmptySuccessResponses["201"],
        400: OpenApiSpecCommonErrorResponses["400"],
        500: OpenApiSpecCommonErrorResponses["500"],
      },
    }),
    zValidator("json", RegisterBuilderRequest),
    async (c) => {
      const payload = c.req.valid("json");
      const command = BuilderDataMapper.toCreateBuilderCommand(payload, c.env.log);

      return pipe(
        BuilderService.createBuilder(c.env, command),
        E.map(() => c.text<RegisterBuilderResponse>("", StatusCodes.CREATED)),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

/**
 * Handle GET /v1/builders/me
 */
export function readProfile(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.builders.me;

  app.get(
    path,
    describeRoute({
      tags: ["Builders"],
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
    loadSubjectAndVerifyAsBuilder(bindings),
    requireNucNamespace(NucCmd.nil.db.builders.read),
    async (c) => {
      const builder = c.get("builder");

      return pipe(
        BuilderService.find(c.env, builder.did),
        E.map((builder) => BuilderDataMapper.toReadProfileResponse(builder)),
        E.map((response) => c.json<ReadProfileResponse>(response)),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

/**
 * Handle DELETE /v1/builders/me
 */
export function deleteBuilder(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.builders.me;

  app.delete(
    path,
    describeRoute({
      tags: ["Builders"],
      security: [{ bearerAuth: [] }],
      summary: "Delete builder",
      responses: {
        204: OpenApiSpecEmptySuccessResponses["204"],
        ...OpenApiSpecCommonErrorResponses,
      },
    }),
    loadNucToken(bindings),
    loadSubjectAndVerifyAsBuilder(bindings),
    requireNucNamespace(NucCmd.nil.db.builders.delete),
    async (c) => {
      const builder = c.get("builder");

      return pipe(
        BuilderService.remove(c.env, builder.did),
        E.map(() => c.text<DeleteBuilderResponse>("")),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

/**
 * Handle POST /v1/builders/me
 */
export function updateProfile(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.builders.me;

  app.post(
    path,
    describeRoute({
      tags: ["Builders"],
      security: [{ bearerAuth: [] }],
      summary: "Update profile",
      responses: {
        200: OpenApiSpecEmptySuccessResponses["200"],
        ...OpenApiSpecCommonErrorResponses,
      },
    }),
    zValidator("json", UpdateProfileRequest),
    loadNucToken(bindings),
    loadSubjectAndVerifyAsBuilder(bindings),
    requireNucNamespace(NucCmd.nil.db.builders.update),
    async (c) => {
      const builder = c.get("builder");
      const payload = c.req.valid("json");
      const command = BuilderDataMapper.toUpdateProfileCommand(payload, builder.did);

      return pipe(
        BuilderService.updateProfile(c.env, command),
        E.map(() => c.text<UpdateProfileResponse>("")),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}
