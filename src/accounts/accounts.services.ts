import { Effect as E, pipe } from "effect";
import * as AdminAccountRepository from "#/admin/admin.repository";
import type { AdminCreateAccountRequest } from "#/admin/admin.types";
import {
  DataValidationError,
  type DatabaseError,
  type DocumentNotFoundError,
  DuplicateEntryError,
  type PrimaryCollectionNotFoundError,
} from "#/common/errors";
import { Identity } from "#/common/identity";
import type { NilDid } from "#/common/nil-did";
import type { AppBindings } from "#/env";
import * as AccountRepository from "./accounts.repository";
import type {
  OrganizationAccountDocument,
  RegisterAccountRequest,
} from "./accounts.types";

export function find(
  ctx: AppBindings,
  did: NilDid,
): E.Effect<
  OrganizationAccountDocument,
  DocumentNotFoundError | PrimaryCollectionNotFoundError | DatabaseError
> {
  return pipe(AccountRepository.findOneOrganization(ctx, did));
}

export function createAccount(
  ctx: AppBindings,
  request: RegisterAccountRequest | AdminCreateAccountRequest,
): E.Effect<
  void,
  | DataValidationError
  | DuplicateEntryError
  | DocumentNotFoundError
  | PrimaryCollectionNotFoundError
  | DatabaseError
> {
  if (request.did === ctx.node.identity.did) {
    const e = new DuplicateEntryError({ document: request });
    return E.fail(e);
  }

  if (!Identity.isDidFromPublicKey(request.did, request.publicKey)) {
    const e = new DataValidationError({
      issues: ["DID not derived from public key"],
      cause: request,
    });
    return E.fail(e);
  }

  const isAdminRegistration =
    "type" in request && request.type.toLocaleLowerCase() === "admin";

  if (isAdminRegistration) {
    const document = AdminAccountRepository.toAdminAccountDocument(request);
    return AdminAccountRepository.insert(ctx, document);
  }

  const document = AccountRepository.toOrganizationAccountDocument(
    request,
    ctx.config.env,
  );
  return AccountRepository.insert(ctx, document);
}

export function remove(
  ctx: AppBindings,
  id: NilDid,
): E.Effect<
  void,
  DocumentNotFoundError | PrimaryCollectionNotFoundError | DatabaseError
> {
  return pipe(AccountRepository.deleteOneById(ctx, id));
}

export function setSubscriptionState(
  ctx: AppBindings,
  ids: NilDid[],
  active: boolean,
): E.Effect<
  void,
  DocumentNotFoundError | PrimaryCollectionNotFoundError | DatabaseError
> {
  return pipe(AccountRepository.setSubscriptionState(ctx, ids, active));
}

export function setPublicKey(
  ctx: AppBindings,
  id: NilDid,
  publicKey: string,
): E.Effect<
  void,
  DocumentNotFoundError | PrimaryCollectionNotFoundError | DatabaseError
> {
  return pipe(AccountRepository.setPublicKey(ctx, id, publicKey));
}
