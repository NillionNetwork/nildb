import { Effect as E, pipe } from "effect";
import type { RequestHandler } from "express";
import type { EmptyObject } from "type-fest";
import { z } from "zod";
import type { OrganizationAccountDocument } from "#/accounts/repository";
import { AccountService } from "#/accounts/service";
import { type ApiResponse, foldToApiResponse } from "#/common/handler";
import { NilDid } from "#/common/nil-did";
import { parseUserData } from "#/common/zod-utils";
import { PUBLIC_KEY_LENGTH } from "#/env";
import { isRoleAllowed } from "#/middleware/auth";

export type GetAccountRequest = EmptyObject;
export type GetAccountResponse = ApiResponse<OrganizationAccountDocument>;

const get: RequestHandler<
  EmptyObject,
  GetAccountResponse,
  GetAccountRequest
> = async (req, res) => {
  const { ctx, account } = req;

  if (!isRoleAllowed(req, ["admin", "organization"])) {
    res.sendStatus(401);
    return;
  }

  await pipe(
    AccountService.find(ctx, account._id),
    foldToApiResponse(req, res),
    E.runPromise,
  );
};

export const RegisterAccountRequest = z.object({
  did: NilDid,
  publicKey: z.string().length(PUBLIC_KEY_LENGTH),
  name: z.string(),
});
export type RegisterAccountRequest = z.infer<typeof RegisterAccountRequest>;
export type RegisterAccountResponse = ApiResponse<NilDid>;

const register: RequestHandler<
  EmptyObject,
  RegisterAccountResponse,
  RegisterAccountRequest
> = async (req, res) => {
  const { ctx, body } = req;

  await pipe(
    parseUserData<RegisterAccountRequest>(() =>
      RegisterAccountRequest.parse(body),
    ),
    E.flatMap((payload) => AccountService.register(ctx, payload)),
    foldToApiResponse(req, res),
    E.runPromise,
  );
};

export const RemoveAccountRequest = z.object({
  id: NilDid,
});
export type RemoveAccountRequest = z.infer<typeof RemoveAccountRequest>;
export type RemoveAccountResponse = ApiResponse<string>;

const remove: RequestHandler<
  EmptyObject,
  RemoveAccountResponse,
  RemoveAccountRequest
> = async (req, res) => {
  const { ctx, body } = req;

  if (!isRoleAllowed(req, ["root", "admin"])) {
    res.sendStatus(401);
    return;
  }

  await pipe(
    parseUserData<RemoveAccountRequest>(() => RemoveAccountRequest.parse(body)),
    E.flatMap((payload) => AccountService.remove(ctx, payload.id)),
    foldToApiResponse(req, res),
    E.runPromise,
  );
};

export const AccountController = {
  get,
  register,
  remove,
};
