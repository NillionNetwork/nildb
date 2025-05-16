import type { NucToken } from "@nillion/nuc";
import { Effect as E, pipe } from "effect";
import { StatusCodes } from "http-status-codes";
import { handleTaggedErrors } from "#/common/handler";
import { NucCmd } from "#/common/nuc-cmd-tree";
import { PathsV1 } from "#/common/paths";
import type { ControllerOptions } from "#/common/types";
import { payloadValidator } from "#/common/zod-utils";
import type { AppContext } from "#/env";
import {
  enforceCapability,
  RoleSchema,
  verifyNucAndLoadSubject,
} from "#/middleware/capability.middleware";
import * as AccountService from "./accounts.services";
import {
  RegisterAccountRequestSchema,
  RemoveAccountRequestSchema,
  SetPublicKeyRequestSchema,
} from "./accounts.types";

export function get(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.accounts.root;
  const guard = {
    path,
    cmd: NucCmd.nil.db.accounts,
    roles: [RoleSchema.enum.organization],
    // TODO: implement policy validation fix json on body type inference
    validate: (_c: AppContext, _token: NucToken) => true,
  };

  app.get(
    path,
    verifyNucAndLoadSubject(bindings),
    enforceCapability(bindings, guard),
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
  const guard = {
    path,
    cmd: NucCmd.nil.db.accounts,
    roles: [RoleSchema.enum.organization],
    // TODO: implement policy validation fix json on body type inference
    validate: (_c: AppContext, _token: NucToken) => true,
  };

  app.delete(
    path,
    payloadValidator(RemoveAccountRequestSchema),
    verifyNucAndLoadSubject(bindings),
    enforceCapability(bindings, guard),
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
  const guard = {
    path,
    cmd: NucCmd.nil.db.accounts,
    roles: [RoleSchema.enum.organization],
    // TODO: implement policy validation fix json on body type inference
    validate: (_c: AppContext, _token: NucToken) => true,
  };

  app.post(
    path,
    payloadValidator(SetPublicKeyRequestSchema),
    verifyNucAndLoadSubject(bindings),
    enforceCapability(bindings, guard),
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

export function getSubscription(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.accounts.subscription;
  const guard = {
    path,
    cmd: NucCmd.nil.db.accounts,
    roles: [RoleSchema.enum.organization],
    // TODO: implement policy validation fix json on body type inference
    validate: (_c: AppContext, _token: NucToken) => true,
  };

  app.get(
    path,
    verifyNucAndLoadSubject(bindings),
    enforceCapability(bindings, guard),
    async (c) => {
      const account = c.get("account");

      return pipe(
        AccountService.getSubscriptionState(c.env, account._id),
        E.map((data) => c.json({ data })),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}
