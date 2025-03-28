import { Effect as E, pipe } from "effect";
import * as AdminAccountRepository from "#/admin/admin.repository";
import type {
  AdminCreateAccountRequest,
  AdminSetSubscriptionStateRequest,
} from "#/admin/admin.types";
import { advance } from "#/common/date";
import {
  type DataValidationError,
  type DatabaseError,
  type DocumentNotFoundError,
  DuplicateEntryError,
  type PrimaryCollectionNotFoundError,
} from "#/common/errors";
import type { Did } from "#/common/types";
import type { AppBindings } from "#/env";
import * as AccountRepository from "./accounts.repository";
import type {
  AccountSubscriptionDocument,
  OrganizationAccountDocument,
  RegisterAccountRequest,
} from "./accounts.types";

export function find(
  ctx: AppBindings,
  did: Did,
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
  if (request.did === ctx.node.keypair.toDidString()) {
    const e = new DuplicateEntryError({
      document: { name: request.name, did: request.did },
    });
    return E.fail(e);
  }

  const isAdminRegistration =
    "type" in request && request.type.toLocaleLowerCase() === "admin";

  if (isAdminRegistration) {
    const document = AdminAccountRepository.toAdminAccountDocument(request);
    return AdminAccountRepository.insert(ctx, document);
  }

  const document = AccountRepository.toOrganizationAccountDocument(request);
  return AccountRepository.insert(ctx, document);
}

export function remove(
  ctx: AppBindings,
  id: Did,
): E.Effect<
  void,
  DocumentNotFoundError | PrimaryCollectionNotFoundError | DatabaseError
> {
  return pipe(AccountRepository.deleteOneById(ctx, id));
}

export function setSubscriptionState(
  ctx: AppBindings,
  payload: AdminSetSubscriptionStateRequest,
): E.Effect<
  void,
  DocumentNotFoundError | PrimaryCollectionNotFoundError | DatabaseError
> {
  const {
    did,
    start = new Date(),
    end = advance(start, 30),
    txHash = "",
  } = payload;
  return pipe(
    AccountRepository.setSubscriptionState(ctx, did, start, end, txHash),
  );
}

export function getSubscriptionState(
  ctx: AppBindings,
  did: Did,
): E.Effect<
  AccountSubscriptionDocument,
  DocumentNotFoundError | PrimaryCollectionNotFoundError | DatabaseError
> {
  return AccountRepository.getSubscriptionState(ctx, did);
}

export function setPublicKey(
  ctx: AppBindings,
  id: Did,
  publicKey: string,
): E.Effect<
  void,
  DocumentNotFoundError | PrimaryCollectionNotFoundError | DatabaseError
> {
  return pipe(AccountRepository.setPublicKey(ctx, id, publicKey));
}
