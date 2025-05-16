import { Effect as E, pipe } from "effect";
import { StatusCodes } from "http-status-codes";
import type { UUID } from "mongodb";
import { z } from "zod";
import { handleTaggedErrors } from "#/common/handler";
import { NucCmd } from "#/common/nuc-cmd-tree";
import { PathsBeta, PathsV1 } from "#/common/paths";
import { type ControllerOptions, Uuid } from "#/common/types";
import { paramsValidator, payloadValidator } from "#/common/zod-utils";
import {
  enforceCapability,
  RoleSchema,
  verifyNucAndLoadSubject,
} from "#/middleware/capability.middleware";
import * as SchemasService from "#/schemas/schemas.services";
import {
  type DeleteSchemaRequest,
  DeleteSchemaRequestSchema,
} from "#/schemas/schemas.types";
import {
  type AdminAddSchemaRequest,
  AdminAddSchemaRequestSchema,
  type CreateSchemaIndexRequest,
  CreateSchemaIndexRequestSchema,
} from "./admin.types";

export function add(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.admin.schemas.root;

  app.post(
    path,
    payloadValidator(AdminAddSchemaRequestSchema),
    verifyNucAndLoadSubject(bindings),
    enforceCapability<{ json: AdminAddSchemaRequest }>({
      path,
      cmd: NucCmd.nil.db.admin,
      roles: [RoleSchema.enum.admin],
      validate: (_c, _token) => true,
    }),
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

  app.delete(
    path,
    payloadValidator(DeleteSchemaRequestSchema),
    verifyNucAndLoadSubject(bindings),
    enforceCapability<{ json: DeleteSchemaRequest }>({
      path,
      cmd: NucCmd.nil.db.admin,
      roles: [RoleSchema.enum.admin],
      validate: (_c, _token) => true,
    }),
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

  app.get(
    path,
    paramsValidator(
      z.object({
        id: Uuid,
      }),
    ),
    verifyNucAndLoadSubject(bindings),
    enforceCapability<{ param: { id: UUID } }>({
      path,
      cmd: NucCmd.nil.db.admin,
      roles: [RoleSchema.enum.admin],
      validate: (_c, _token) => true,
    }),
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

  app.post(
    path,
    payloadValidator(CreateSchemaIndexRequestSchema),
    paramsValidator(
      z.object({
        id: Uuid,
      }),
    ),
    verifyNucAndLoadSubject(bindings),
    enforceCapability<{ json: CreateSchemaIndexRequest; param: { id: UUID } }>({
      path,
      cmd: NucCmd.nil.db.admin,
      roles: [RoleSchema.enum.admin],
      validate: (_c, _token) => true,
    }),
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

  app.delete(
    path,
    paramsValidator(
      z.object({
        id: Uuid,
        name: z.string().min(4),
      }),
    ),
    verifyNucAndLoadSubject(bindings),
    enforceCapability<{ param: { id: UUID; name: string } }>({
      path,
      cmd: NucCmd.nil.db.admin,
      roles: [RoleSchema.enum.admin],
      validate: (_c, _token) => true,
    }),
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
