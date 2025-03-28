import { Effect as E, pipe } from "effect";
import { StatusCodes, getReasonPhrase } from "http-status-codes";
import type { App } from "#/app";
import { handleTaggedErrors } from "#/common/handler";
import { PathsV1 } from "#/common/paths";
import { payloadValidator } from "#/common/zod-utils";
import { isRoleAllowed } from "#/middleware/auth.middleware";
import * as AccountService from "./accounts.services";
import {
  RegisterAccountRequestSchema,
  RemoveAccountRequestSchema,
  SetPublicKeyRequestSchema,
} from "./accounts.types";

export function get(app: App): void {
  app.get(PathsV1.accounts.root, async (c) => {
    if (!isRoleAllowed(c, ["admin", "organization"])) {
      return c.text(
        getReasonPhrase(StatusCodes.UNAUTHORIZED),
        StatusCodes.UNAUTHORIZED,
      );
    }

    const account = c.var.account;
    return pipe(
      AccountService.find(c.env, account._id),
      E.map((data) => c.json({ data })),
      handleTaggedErrors(c),
      E.runPromise,
    );
  });
}

export function register(app: App): void {
  app.post(
    PathsV1.accounts.root,
    payloadValidator(RegisterAccountRequestSchema),
    async (c) => {
      const payload = c.req.valid("json");

      return pipe(
        AccountService.createAccount(c.env, payload),
        E.map(() => new Response(null, { status: StatusCodes.CREATED })),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

export function remove(app: App): void {
  app.delete(
    PathsV1.accounts.root,
    payloadValidator(RemoveAccountRequestSchema),
    async (c) => {
      if (!isRoleAllowed(c, ["root", "admin"])) {
        return c.text(
          getReasonPhrase(StatusCodes.UNAUTHORIZED),
          StatusCodes.UNAUTHORIZED,
        );
      }

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

export function setPublicKey(app: App): void {
  app.post(
    PathsV1.accounts.publicKey,
    payloadValidator(SetPublicKeyRequestSchema),
    async (c) => {
      // TODO: this is really replace owner so (a) it might need a better name
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

export function getSubscription(app: App): void {
  app.get(PathsV1.accounts.subscription, async (c) => {
    if (!isRoleAllowed(c, ["admin", "organization"])) {
      return c.text("Unauthorized", StatusCodes.UNAUTHORIZED);
    }

    const account = c.var.account;
    return pipe(
      AccountService.getSubscriptionState(c.env, account._id),
      E.map((data) => c.json({ data })),
      handleTaggedErrors(c),
      E.runPromise,
    );
  });
}
