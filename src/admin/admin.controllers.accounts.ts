import { Effect as E, pipe } from "effect";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import * as AccountService from "#/accounts/accounts.services";
import type { App } from "#/app";
import { handleTaggedErrors } from "#/common/handler";
import { NilDidSchema } from "#/common/nil-did";
import { PathsV1 } from "#/common/paths";
import { paramsValidator, payloadValidator } from "#/common/zod-utils";
import * as AdminService from "./admin.services";
import {
  AdminCreateAccountRequestSchema,
  AdminDeleteAccountRequestSchema,
  AdminSetSubscriptionStateRequestSchema,
} from "./admin.types";

export function create(app: App): void {
  app.post(
    PathsV1.admin.accounts.root,
    payloadValidator(AdminCreateAccountRequestSchema),
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
    PathsV1.admin.accounts.root,
    payloadValidator(AdminDeleteAccountRequestSchema),
    async (c) => {
      const payload = c.req.valid("json");

      return pipe(
        AdminService.deleteAccount(c.env, payload.id),
        E.map(() => new Response(null, { status: StatusCodes.NO_CONTENT })),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

export function list(app: App): void {
  app.get(PathsV1.admin.accounts.root, async (c) => {
    return pipe(
      AdminService.listAllAccounts(c.env),
      E.map((data) => c.json({ data })),
      handleTaggedErrors(c),
      E.runPromise,
    );
  });
}

export function setSubscriptionState(app: App): void {
  app.post(
    PathsV1.admin.accounts.subscription,
    payloadValidator(AdminSetSubscriptionStateRequestSchema),
    async (c) => {
      const payload = c.req.valid("json");

      return pipe(
        AccountService.setSubscriptionState(c.env, payload),
        E.map(() => new Response(null, { status: StatusCodes.OK })),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

export function getSubscriptionState(app: App): void {
  app.get(
    PathsV1.admin.accounts.subscriptionByDid,
    paramsValidator(
      z.object({
        did: NilDidSchema,
      }),
    ),
    async (c) => {
      const payload = c.req.valid("param");

      return pipe(
        AccountService.getSubscriptionState(c.env, payload.did),
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
