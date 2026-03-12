import type { Acl } from "@nildb/users/users.types";
import { Data } from "effect";
import type { JsonObject } from "type-fest";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";

export class DuplicateEntryError extends Data.TaggedError("DuplicateEntryError")<{
  document: JsonObject;
}> {
  humanize(): string[] {
    return [this._tag, `document: ${JSON.stringify(this.document)}`];
  }
}

export class ResourceAccessDeniedError extends Data.TaggedError("ResourceAccessDeniedError")<{
  type: string;
  id: string;
  user: string;
}> {
  humanize(): string[] {
    return [this._tag, `type: ${this.type}`, `object: ${this.id}`, `user: ${this.user}`];
  }
}

export class InvalidIndexOptionsError extends Data.TaggedError("InvalidIndexOptionsError")<{
  collection: string;
  message: string;
}> {
  humanize(): string[] {
    return [this._tag, `collection: ${this.collection}`, this.message];
  }
}

export class IndexNotFoundError extends Data.TaggedError("IndexNotFoundError")<{
  collection: string;
  index: string;
}> {
  humanize(): string[] {
    return [this._tag, `collection: ${this.collection}`, `index: ${this.index}`];
  }
}

export class DatabaseError extends Data.TaggedError("DatabaseError")<{
  cause: unknown;
  message: string;
}> {
  humanize(): string[] {
    return [this._tag, this.message, `cause: ${JSON.stringify(this.cause)}`];
  }
}

export class DocumentNotFoundError extends Data.TaggedError("DocumentNotFoundError")<{
  collection: string;
  filter: Record<string, unknown>;
}> {
  humanize(): string[] {
    return [this._tag, `collection: ${this.collection}`, `filter: ${JSON.stringify(this.filter)}`];
  }
}

export class CollectionNotFoundError extends Data.TaggedError("CollectionNotFoundError")<{
  dbName: string;
  name: string;
}> {
  humanize(): string[] {
    return [this._tag, `db: ${this.dbName}, collection: ${this.name}`];
  }
}

export type QueryValidationError = VariableInjectionError | DataValidationError;

export class DataValidationError extends Data.TaggedError("DataValidationError")<{
  issues: (string | ZodError)[];
  cause: unknown;
}> {
  humanize(): string[] {
    const flattenedIssues = this.issues.flatMap((issue) => {
      if (issue instanceof ZodError) {
        const errorMessage = fromZodError(issue, {
          prefix: null,
          issueSeparator: ";",
        }).message;
        return errorMessage.split(";");
      }
      return issue;
    });

    return [this._tag, ...flattenedIssues];
  }
}

export class VariableInjectionError extends Data.TaggedError("VariableInjectionError")<{
  message: string;
}> {
  humanize(): string[] {
    return [this._tag, this.message];
  }
}

export class TimeoutError extends Data.TaggedError("TimeoutError")<{
  message: string;
}> {
  humanize(): string[] {
    return [this._tag, this.message];
  }
}

export class GrantAccessError extends Data.TaggedError("GrantAccessError")<{
  type: string;
  id: string;
  acl: Acl;
}> {
  humanize(): string[] {
    return [
      this._tag,
      `type: ${this.type}`,
      `object: ${this.id}`,
      `grantee: ${this.acl.grantee}`,
      `acl: [r=${this.acl.read}, w=${this.acl.write}, x=${this.acl.execute}]`,
    ];
  }
}

export class RevokeAccessError extends Data.TaggedError("RevokeAccessError")<{
  type: string;
  id: string;
  grantee: string;
}> {
  humanize(): string[] {
    return [this._tag, `type: ${this.type}`, `object: ${this.id}`, `grantee: ${this.grantee}`];
  }
}

export class InvalidDidError extends Data.TaggedError("InvalidDidError")<{
  message: string;
}> {
  humanize(): string[] {
    return [this._tag, this.message];
  }
}

export class PaymentValidationError extends Data.TaggedError("PaymentValidationError")<{
  message: string;
}> {
  humanize(): string[] {
    return [this._tag, this.message];
  }
}

export class PaymentAlreadyProcessedError extends Data.TaggedError("PaymentAlreadyProcessedError")<{
  txHash: string;
  chainId: number;
}> {
  humanize(): string[] {
    return [this._tag, `txHash: ${this.txHash}`, `chainId: ${this.chainId}`];
  }
}

export class CreditsNotEnabledError extends Data.TaggedError("CreditsNotEnabledError")<{
  builderDid: string;
}> {
  humanize(): string[] {
    return [this._tag, `builder ${this.builderDid} does not have credits enabled`];
  }
}

export class InsufficientCreditsError extends Data.TaggedError("InsufficientCreditsError")<{
  required: string;
  available: number;
}> {
  humanize(): string[] {
    return [this._tag, `required: ${this.required}`, `available: ${this.available}`];
  }
}
