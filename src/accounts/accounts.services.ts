import { Effect as E, pipe } from "effect";
import type { AdminCreateAccountRequest } from "#/admin/admin.types";
import {
  type CollectionNotFoundError,
  type DatabaseError,
  type DataValidationError,
  type DocumentNotFoundError,
  DuplicateEntryError,
} from "#/common/errors";
import type { Did } from "#/common/types";
import type { AppBindings } from "#/env";
import * as AccountRepository from "./accounts.repository";
import type {
  OrganizationAccountDocument,
  RegisterAccountRequest,
} from "./accounts.types";

export function find(
  ctx: AppBindings,
  did: Did,
): E.Effect<
  OrganizationAccountDocument,
  DocumentNotFoundError | CollectionNotFoundError | DatabaseError
> {
  return AccountRepository.findOneOrganization(ctx, did);
}

export function createAccount(
  ctx: AppBindings,
  request: RegisterAccountRequest | AdminCreateAccountRequest,
): E.Effect<
  void,
  | DataValidationError
  | DuplicateEntryError
  | DocumentNotFoundError
  | CollectionNotFoundError
  | DatabaseError
> {
  if (request.did === ctx.node.keypair.toDidString()) {
    const e = new DuplicateEntryError({
      document: { name: request.name, did: request.did },
    });
    return E.fail(e);
  }

  const document = AccountRepository.toOrganizationAccountDocument(request);
  return AccountRepository.insert(ctx, document);
}

export function remove(
  ctx: AppBindings,
  id: Did,
): E.Effect<
  void,
  DocumentNotFoundError | CollectionNotFoundError | DatabaseError
> {
  return pipe(AccountRepository.deleteOneById(ctx, id));
}

export function setPublicKey(
  ctx: AppBindings,
  id: Did,
  publicKey: string,
): E.Effect<
  void,
  DocumentNotFoundError | CollectionNotFoundError | DatabaseError
> {
  return pipe(AccountRepository.setPublicKey(ctx, id, publicKey));
}
