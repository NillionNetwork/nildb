import { Effect as E, pipe } from "effect";
import type { OrganizationAccountDocument } from "#/accounts/accounts.mapper";
import { handleTaggedErrors } from "#/common/handler";
import { NucCmd } from "#/common/nuc-cmd-tree";
import { enforceSchemaOwnership } from "#/common/ownership";
import { PathsV1 } from "#/common/paths";
import type { ControllerOptions } from "#/common/types";
import { payloadValidator } from "#/common/zod-utils";
import {
  enforceCapability,
  RoleSchema,
  verifyNucAndLoadSubject,
} from "#/middleware/capability.middleware";
import * as DataService from "./data.services";
import {
  type AddPermissionsRequest,
  AddPermissionsRequestSchema,
  type DeleteDataRequest,
  DeleteDataRequestSchema,
  type DeletePermissionsRequest,
  DeletePermissionsRequestSchema,
  type FlushDataRequest,
  FlushDataRequestSchema,
  type ReadDataRequest,
  ReadDataRequestSchema,
  type ReadPermissionsRequest,
  ReadPermissionsRequestSchema,
  type TailDataRequest,
  TailDataRequestSchema,
  type UpdateDataRequest,
  UpdateDataRequestSchema,
  type UpdatePermissionsRequest,
  UpdatePermissionsRequestSchema,
  type UploadDataRequest,
  UploadDataRequestSchema,
} from "./data.types";

export function remove(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.data.delete;

  app.post(
    path,
    payloadValidator(DeleteDataRequestSchema),
    verifyNucAndLoadSubject(bindings),
    enforceCapability<{ json: DeleteDataRequest }>({
      path,
      cmd: NucCmd.nil.db.data,
      roles: [RoleSchema.enum.organization],
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const account = c.get("account") as OrganizationAccountDocument;
      const payload = c.req.valid("json");

      return pipe(
        enforceSchemaOwnership(account, payload.schema),
        E.flatMap(() => DataService.deleteRecords(c.env, payload)),
        E.map((data) => c.json({ data })),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

export function flush(options: ControllerOptions): void {
  const { app, bindings } = options;

  const path = PathsV1.data.flush;

  app.post(
    path,
    payloadValidator(FlushDataRequestSchema),
    verifyNucAndLoadSubject(bindings),
    enforceCapability<{ json: FlushDataRequest }>({
      path,
      cmd: NucCmd.nil.db.data,
      roles: [RoleSchema.enum.organization],
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const account = c.get("account") as OrganizationAccountDocument;
      const payload = c.req.valid("json");

      return pipe(
        enforceSchemaOwnership(account, payload.schema),
        E.flatMap(() => DataService.flushCollection(c.env, payload.schema)),
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

export function read(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.data.read;

  app.post(
    path,
    payloadValidator(ReadDataRequestSchema),
    verifyNucAndLoadSubject(bindings),
    enforceCapability<{ json: ReadDataRequest }>({
      path,
      cmd: NucCmd.nil.db.data,
      roles: [RoleSchema.enum.organization],
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const account = c.get("account") as OrganizationAccountDocument;
      const payload = c.req.valid("json");

      return pipe(
        enforceSchemaOwnership(account, payload.schema),
        E.flatMap(() => DataService.readRecords(c.env, payload)),
        E.map((data) => c.json({ data })),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

export function tail(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.data.tail;

  app.post(
    path,
    payloadValidator(TailDataRequestSchema),
    verifyNucAndLoadSubject(bindings),
    enforceCapability<{ json: TailDataRequest }>({
      path,
      cmd: NucCmd.nil.db.data,
      roles: [RoleSchema.enum.organization],
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const account = c.get("account") as OrganizationAccountDocument;
      const payload = c.req.valid("json");

      return pipe(
        enforceSchemaOwnership(account, payload.schema),
        E.flatMap(() => DataService.tailData(c.env, payload.schema)),
        E.map((data) => c.json({ data })),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

export function update(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.data.update;

  app.post(
    path,
    payloadValidator(UpdateDataRequestSchema),
    verifyNucAndLoadSubject(bindings),
    enforceCapability<{ json: UpdateDataRequest }>({
      path,
      cmd: NucCmd.nil.db.data,
      roles: [RoleSchema.enum.organization],
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const account = c.get("account") as OrganizationAccountDocument;
      const payload = c.req.valid("json");

      return pipe(
        enforceSchemaOwnership(account, payload.schema),
        E.flatMap(() => DataService.updateRecords(c.env, payload)),
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

export function upload(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.data.upload;

  app.post(
    path,
    payloadValidator(UploadDataRequestSchema),
    verifyNucAndLoadSubject(bindings),
    enforceCapability<{ json: UploadDataRequest }>({
      path,
      cmd: NucCmd.nil.db.data,
      roles: [RoleSchema.enum.organization],
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const account = c.get("account") as OrganizationAccountDocument;
      const payload = c.req.valid("json");

      return pipe(
        enforceSchemaOwnership(account, payload.schema),
        E.flatMap(() =>
          DataService.createRecords(
            c.env,
            payload.userId,
            payload.schema,
            payload.data,
            account._id,
          ),
        ),
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

export function readPermissions(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.data.perms.read;

  app.post(
    path,
    payloadValidator(ReadPermissionsRequestSchema),
    verifyNucAndLoadSubject(bindings),
    enforceCapability<{ json: ReadPermissionsRequest }>({
      path,
      cmd: NucCmd.nil.db.data,
      roles: [RoleSchema.enum.organization],
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const account = c.get("account") as OrganizationAccountDocument;
      const payload = c.req.valid("json");

      return pipe(
        enforceSchemaOwnership(account, payload.schema),
        E.flatMap(() => DataService.readPermissions(c.env, payload)),
        E.map((data) => c.json({ data })),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

export function addPermissions(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.data.perms.add;

  app.post(
    path,
    payloadValidator(AddPermissionsRequestSchema),
    verifyNucAndLoadSubject(bindings),
    enforceCapability<{ json: AddPermissionsRequest }>({
      path,
      cmd: NucCmd.nil.db.data,
      roles: [RoleSchema.enum.organization],
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const account = c.get("account") as OrganizationAccountDocument;
      const payload = c.req.valid("json");

      return pipe(
        enforceSchemaOwnership(account, payload.schema),
        E.flatMap(() => DataService.addPermissions(c.env, payload)),
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

export function updatePermissions(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.data.perms.update;

  app.post(
    path,
    payloadValidator(UpdatePermissionsRequestSchema),
    verifyNucAndLoadSubject(bindings),
    enforceCapability<{ json: UpdatePermissionsRequest }>({
      path,
      cmd: NucCmd.nil.db.data,
      roles: [RoleSchema.enum.organization],
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const account = c.get("account") as OrganizationAccountDocument;
      const payload = c.req.valid("json");

      return pipe(
        enforceSchemaOwnership(account, payload.schema),
        E.flatMap(() => DataService.updatePermissions(c.env, payload)),
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

export function deletePermissions(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.data.perms.delete;

  app.post(
    path,
    payloadValidator(DeletePermissionsRequestSchema),
    verifyNucAndLoadSubject(bindings),
    enforceCapability<{ json: DeletePermissionsRequest }>({
      path,
      cmd: NucCmd.nil.db.data,
      roles: [RoleSchema.enum.organization],
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const account = c.get("account") as OrganizationAccountDocument;
      const payload = c.req.valid("json");

      return pipe(
        enforceSchemaOwnership(account, payload.schema),
        E.flatMap(() => DataService.deletePermissions(c.env, payload)),
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
