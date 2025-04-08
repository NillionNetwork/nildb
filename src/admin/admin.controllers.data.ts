import type { NucToken } from "@nillion/nuc";
import { Effect as E, pipe } from "effect";
import { handleTaggedErrors } from "#/common/handler";
import { NucCmd } from "#/common/nuc-cmd-tree";
import { PathsV1 } from "#/common/paths";
import type { ControllerOptions } from "#/common/types";
import { payloadValidator } from "#/common/zod-utils";
import * as DataService from "#/data/data.services";
import {
  DeleteDataRequestSchema,
  FlushDataRequestSchema,
  ReadDataRequestSchema,
  TailDataRequestSchema,
  UpdateDataRequestSchema,
  UploadDataRequestSchema,
} from "#/data/data.types";
import type { AppContext } from "#/env";
import {
  RoleSchema,
  enforceCapability,
  verifyNucAndLoadSubject,
} from "#/middleware/capability.middleware";

export function remove(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.admin.data.delete;
  const guard = {
    path,
    cmd: NucCmd.nil.db.admin,
    roles: [RoleSchema.enum.admin],
    // TODO: implement policy validation fix json on body type inference
    validate: (_c: AppContext, _token: NucToken) => true,
  };

  app.post(
    path,
    payloadValidator(DeleteDataRequestSchema),
    verifyNucAndLoadSubject(bindings),
    enforceCapability(bindings, guard),
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
  const guard = {
    path,
    cmd: NucCmd.nil.db.admin,
    roles: [RoleSchema.enum.admin],
    // TODO: implement policy validation fix json on body type inference
    validate: (_c: AppContext, _token: NucToken) => true,
  };

  app.post(
    path,
    payloadValidator(FlushDataRequestSchema),
    verifyNucAndLoadSubject(bindings),
    enforceCapability(bindings, guard),
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
  const guard = {
    path,
    cmd: NucCmd.nil.db.admin,
    roles: [RoleSchema.enum.admin],
    // TODO: implement policy validation fix json on body type inference
    validate: (_c: AppContext, _token: NucToken) => true,
  };

  app.post(
    path,
    payloadValidator(ReadDataRequestSchema),
    verifyNucAndLoadSubject(bindings),
    enforceCapability(bindings, guard),
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
  const guard = {
    path,
    cmd: NucCmd.nil.db.admin,
    roles: [RoleSchema.enum.admin],
    // TODO: implement policy validation fix json on body type inference
    validate: (_c: AppContext, _token: NucToken) => true,
  };

  app.post(
    path,
    payloadValidator(TailDataRequestSchema),
    verifyNucAndLoadSubject(bindings),
    enforceCapability(bindings, guard),
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
  const guard = {
    path,
    cmd: NucCmd.nil.db.admin,
    roles: [RoleSchema.enum.admin],
    // TODO: implement policy validation fix json on body type inference
    validate: (_c: AppContext, _token: NucToken) => true,
  };

  app.post(
    path,
    payloadValidator(UpdateDataRequestSchema),
    verifyNucAndLoadSubject(bindings),
    enforceCapability(bindings, guard),
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
  const guard = {
    path,
    cmd: NucCmd.nil.db.admin,
    roles: [RoleSchema.enum.admin],
    // TODO: implement policy validation fix json on body type inference
    validate: (_c: AppContext, _token: NucToken) => true,
  };

  app.post(
    path,
    payloadValidator(UploadDataRequestSchema),
    verifyNucAndLoadSubject(bindings),
    enforceCapability(bindings, guard),
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
