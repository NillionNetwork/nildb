import { Effect as E, pipe } from "effect";
import type { OrganizationAccountDocument } from "#/accounts/accounts.types";
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
      const token = c.get("envelope").token.token;
      const payload = c.req.valid("json");

      return pipe(
        enforceSchemaOwnership(account, payload.schema),
        E.flatMap(
          () =>
            DataService.deleteRecords(
              c.env,
              payload,
              token.audience.toString(),
            ), // TODO We need to revisit the owner assignment
        ),
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
      const token = c.get("envelope").token.token;
      const payload = c.req.valid("json");

      return pipe(
        enforceSchemaOwnership(account, payload.schema),
        E.flatMap(() =>
          DataService.createRecords(
            c.env,
            token.audience.toString(), // TODO We need to revisit the owner assignment
            payload.schema,
            payload.data,
            [token],
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
