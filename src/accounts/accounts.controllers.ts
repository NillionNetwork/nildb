import { Effect as E, pipe } from "effect";
import { StatusCodes } from "http-status-codes";
import { handleTaggedErrors } from "#/common/handler";
import { NucCmd } from "#/common/nuc-cmd-tree";
import { PathsV1 } from "#/common/paths";
import type { ControllerOptions } from "#/common/types";
import { payloadValidator } from "#/common/zod-utils";
import {
  enforceCapability,
  RoleSchema,
  verifyNucAndLoadSubject,
} from "#/middleware/capability.middleware";
import * as AccountService from "./accounts.services";
import {
  RegisterAccountRequestSchema,
  type RemoveAccountRequest,
  RemoveAccountRequestSchema,
  type SetPublicKeyRequest,
  SetPublicKeyRequestSchema,
} from "./accounts.types";

export function get(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.accounts.root;

  app.get(
    path,
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
        E.map((data) => c.json({ data })),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

export function register(options: ControllerOptions): void {
  const { app } = options;
  const path = PathsV1.accounts.root;

  app.post(path, payloadValidator(RegisterAccountRequestSchema), async (c) => {
    const payload = c.req.valid("json");

    return pipe(
      AccountService.createAccount(c.env, payload),
      E.map(() => new Response(null, { status: StatusCodes.CREATED })),
      handleTaggedErrors(c),
      E.runPromise,
    );
  });
}

export function remove(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.accounts.root;

  app.delete(
    path,
    payloadValidator(RemoveAccountRequestSchema),
    verifyNucAndLoadSubject(bindings),
    enforceCapability<{ json: RemoveAccountRequest }>({
      path,
      cmd: NucCmd.nil.db.accounts,
      roles: [RoleSchema.enum.organization],
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const payload = c.req.valid("json");

      return pipe(
        AccountService.remove(c.env, payload.id),
        E.map(() => new Response(null, { status: StatusCodes.NO_CONTENT })),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

export function setPublicKey(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.accounts.publicKey;

  app.post(
    path,
    payloadValidator(SetPublicKeyRequestSchema),
    verifyNucAndLoadSubject(bindings),
    enforceCapability<{ json: SetPublicKeyRequest }>({
      path,
      cmd: NucCmd.nil.db.accounts,
      roles: [RoleSchema.enum.organization],
      validate: (_c, _token) => true,
    }),
    async (c) => {
      // TODO: this is really replace the org owner so (a) it might need a better name
      //  and (b) should we to enforce a cooldown period or add additional protections?
      const payload = c.req.valid("json");

      return pipe(
        AccountService.setPublicKey(c.env, payload.did, payload.publicKey),
        E.map(() => new Response(null, { status: StatusCodes.OK })),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}
