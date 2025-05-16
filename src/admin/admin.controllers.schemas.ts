import type { NucToken } from "@nillion/nuc";
import { Effect as E, pipe } from "effect";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { handleTaggedErrors } from "#/common/handler";
import { NucCmd } from "#/common/nuc-cmd-tree";
import { PathsBeta, PathsV1 } from "#/common/paths";
import { type ControllerOptions, Uuid } from "#/common/types";
import { paramsValidator, payloadValidator } from "#/common/zod-utils";
import type { AppContext } from "#/env";
import {
  enforceCapability,
  RoleSchema,
  verifyNucAndLoadSubject,
} from "#/middleware/capability.middleware";
import * as SchemasService from "#/schemas/schemas.services";
import { DeleteSchemaRequestSchema } from "#/schemas/schemas.types";
import {
  AdminAddSchemaRequestSchema,
  CreateSchemaIndexRequestSchema,
} from "./admin.types";

export function add(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.admin.schemas.root;
  const guard = {
    path,
    cmd: NucCmd.nil.db.admin,
    roles: [RoleSchema.enum.admin],
    // TODO: implement policy validation fix json on body type inference
    validate: (_c: AppContext, _token: NucToken) => true,
  };

  app.post(
    path,
    payloadValidator(AdminAddSchemaRequestSchema),
    verifyNucAndLoadSubject(bindings),
    enforceCapability(bindings, guard),
    async (c) => {
      const payload = c.req.valid("json");

      return pipe(
        SchemasService.addSchema(c.env, payload),
        E.map(() => new Response(null, { status: StatusCodes.CREATED })),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

export function remove(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.admin.schemas.root;
  const guard = {
    path,
    cmd: NucCmd.nil.db.admin,
    roles: [RoleSchema.enum.admin],
    // TODO: implement policy validation fix json on body type inference
    validate: (_c: AppContext, _token: NucToken) => true,
  };

  app.delete(
    path,
    payloadValidator(DeleteSchemaRequestSchema),
    verifyNucAndLoadSubject(bindings),
    enforceCapability(bindings, guard),
    async (c) => {
      const payload = c.req.valid("json");

      return pipe(
        SchemasService.deleteSchema(c.env, payload.id),
        E.map(() => new Response(null, { status: StatusCodes.NO_CONTENT })),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

export function metadata(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsBeta.admin.schemas.byIdMeta;
  const guard = {
    path,
    cmd: NucCmd.nil.db.admin,
    roles: [RoleSchema.enum.admin],
    // TODO: implement policy validation fix json on body type inference
    validate: (_c: AppContext, _token: NucToken) => true,
  };

  app.get(
    path,
    paramsValidator(
      z.object({
        id: Uuid,
      }),
    ),
    verifyNucAndLoadSubject(bindings),
    enforceCapability(bindings, guard),
    async (c) => {
      const payload = c.req.valid("param");

      return pipe(
        SchemasService.getSchemaMetadata(c.env, payload.id),
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

export function createIndex(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsBeta.admin.schemas.byIdIndexes;
  const guard = {
    path,
    cmd: NucCmd.nil.db.admin,
    roles: [RoleSchema.enum.admin],
    // TODO: implement policy validation fix json on body type inference
    validate: (_c: AppContext, _token: NucToken) => true,
  };

  app.post(
    path,
    payloadValidator(CreateSchemaIndexRequestSchema),
    paramsValidator(
      z.object({
        id: Uuid,
      }),
    ),
    verifyNucAndLoadSubject(bindings),
    enforceCapability(bindings, guard),
    async (c) => {
      const payload = c.req.valid("json");
      const { id } = c.req.valid("param");

      return pipe(
        SchemasService.createIndex(c.env, id, payload),
        E.map(() => new Response(null, { status: StatusCodes.CREATED })),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

export function dropIndex(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsBeta.admin.schemas.byIdIndexesByName;
  const guard = {
    path,
    cmd: NucCmd.nil.db.admin,
    roles: [RoleSchema.enum.admin],
    // TODO: implement policy validation fix json on body type inference
    validate: (_c: AppContext, _token: NucToken) => true,
  };

  app.delete(
    path,
    paramsValidator(
      z.object({
        id: Uuid,
        name: z.string().min(4),
      }),
    ),
    verifyNucAndLoadSubject(bindings),
    enforceCapability(bindings, guard),
    async (c) => {
      const { id, name } = c.req.valid("param");

      return pipe(
        SchemasService.dropIndex(c.env, id, name),
        E.map(() => new Response(null, { status: StatusCodes.NO_CONTENT })),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}
