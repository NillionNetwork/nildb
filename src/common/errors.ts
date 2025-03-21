import { Data } from "effect";
import type { JsonObject } from "type-fest";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import type { NilDid } from "#/common/nil-did";

export class DuplicateEntryError extends Data.TaggedError(
  "DuplicateEntryError",
)<{
  document: JsonObject;
}> {
  humanize(): string[] {
    return [this._tag, `document: ${JSON.stringify(this.document)}`];
  }
}

export class ResourceAccessDeniedError extends Data.TaggedError(
  "ResourceAccessDeniedError",
)<{
  type: string;
  id: string;
  user: NilDid;
}> {
  humanize(): string[] {
    return [
      this._tag,
      `type: ${this.type}`,
      `object: ${this.id}`,
      `user: ${this.user}`,
    ];
  }
}

export class InvalidIndexOptionsError extends Data.TaggedError(
  "InvalidIndexOptionsError",
)<{
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
    return [
      this._tag,
      `collection: ${this.collection}`,
      `index: ${this.index}`,
    ];
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

export class DocumentNotFoundError extends Data.TaggedError(
  "DocumentNotFoundError",
)<{
  collection: string;
  filter: Record<string, unknown>;
}> {
  humanize(): string[] {
    return [
      this._tag,
      `collection: ${this.collection}`,
      `filter: ${JSON.stringify(this.filter)}`,
    ];
  }
}

export class PrimaryCollectionNotFoundError extends Data.TaggedError(
  "PrimaryCollectionNotFoundError",
)<{
  name: string;
}> {
  humanize(): string[] {
    return [this._tag, `collection: ${this.name}`];
  }
}

export class DataCollectionNotFoundError extends Data.TaggedError(
  "DataCollectionNotFoundError",
)<{
  name: string;
}> {
  humanize(): string[] {
    return [this._tag, `collection: ${this.name}`];
  }
}

export class DataValidationError extends Data.TaggedError(
  "DataValidationError",
)<{
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

export class VariableInjectionError extends Data.TaggedError(
  "VariableInjectionError",
)<{
  message: string;
}> {
  humanize(): string[] {
    return [this._tag, this.message];
  }
}
