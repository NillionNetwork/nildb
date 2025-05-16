import { Effect as E, pipe } from "effect";
import { handleTaggedErrors } from "#/common/handler";
import { NucCmd } from "#/common/nuc-cmd-tree";
import { PathsV1 } from "#/common/paths";
import type { ControllerOptions } from "#/common/types";
import { payloadValidator } from "#/common/zod-utils";
import * as DataService from "#/data/data.services";
import {
  type DeleteDataRequest,
  DeleteDataRequestSchema,
  type FlushDataRequest,
  FlushDataRequestSchema,
  type ReadDataRequest,
  ReadDataRequestSchema,
  type TailDataRequest,
  TailDataRequestSchema,
  type UpdateDataRequest,
  UpdateDataRequestSchema,
  type UploadDataRequest,
  UploadDataRequestSchema,
} from "#/data/data.types";
import {
  enforceCapability,
  RoleSchema,
  verifyNucAndLoadSubject,
} from "#/middleware/capability.middleware";

export function remove(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.admin.data.delete;

  app.post(
    path,
    payloadValidator(DeleteDataRequestSchema),
    verifyNucAndLoadSubject(bindings),
    enforceCapability<{ json: DeleteDataRequest }>({
      path,
      cmd: NucCmd.nil.db.admin,
      roles: [RoleSchema.enum.admin],
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const payload = c.req.valid("json");

      return pipe(
        DataService.deleteRecords(c.env, payload),
        E.map((data) => c.json({ data })),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

export function flush(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.admin.data.flush;

  app.post(
    path,
    payloadValidator(FlushDataRequestSchema),
    verifyNucAndLoadSubject(bindings),
    enforceCapability<{ json: FlushDataRequest }>({
      path,
      cmd: NucCmd.nil.db.admin,
      roles: [RoleSchema.enum.admin],
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const payload = c.req.valid("json");

      return pipe(
        DataService.flushCollection(c.env, payload.schema),
        E.map((data) => c.json({ data })),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

export function read(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.admin.data.read;

  app.post(
    path,
    payloadValidator(ReadDataRequestSchema),
    verifyNucAndLoadSubject(bindings),
    enforceCapability<{ json: ReadDataRequest }>({
      path,
      cmd: NucCmd.nil.db.admin,
      roles: [RoleSchema.enum.admin],
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const payload = c.req.valid("json");

      return pipe(
        DataService.readRecords(c.env, payload),
        E.map((data) => c.json({ data })),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

export function tail(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.admin.data.tail;

  app.post(
    path,
    payloadValidator(TailDataRequestSchema),
    verifyNucAndLoadSubject(bindings),
    enforceCapability<{ json: TailDataRequest }>({
      path,
      cmd: NucCmd.nil.db.admin,
      roles: [RoleSchema.enum.admin],
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const payload = c.req.valid("json");

      return pipe(
        DataService.tailData(c.env, payload.schema),
        E.map((data) => c.json({ data })),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

export function update(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.admin.data.update;

  app.post(
    path,
    payloadValidator(UpdateDataRequestSchema),
    verifyNucAndLoadSubject(bindings),
    enforceCapability<{ json: UpdateDataRequest }>({
      path,
      cmd: NucCmd.nil.db.admin,
      roles: [RoleSchema.enum.admin],
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const payload = c.req.valid("json");

      return pipe(
        DataService.updateRecords(c.env, payload),
        E.map((data) => c.json({ data })),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

export function upload(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.admin.data.upload;

  app.post(
    path,
    payloadValidator(UploadDataRequestSchema),
    verifyNucAndLoadSubject(bindings),
    enforceCapability<{ json: UploadDataRequest }>({
      path,
      cmd: NucCmd.nil.db.admin,
      roles: [RoleSchema.enum.admin],
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const payload = c.req.valid("json");

      return pipe(
        DataService.createRecords(c.env, payload.schema, payload.data),
        E.map((data) => c.json({ data })),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}
