import type { NucToken } from "@nillion/nuc";
import { Effect as E, pipe } from "effect";
import type { DeleteResult, UpdateResult, UUID } from "mongodb";
import type {
  CollectionNotFoundError,
  DatabaseError,
  DataValidationError,
  DocumentNotFoundError,
} from "#/common/errors";
import type { Did, UuidDto } from "#/common/types";
import { validateData } from "#/common/validator";
import type { AppBindings } from "#/env";
import * as SchemasRepository from "#/schemas/schemas.repository";
import * as UserRepository from "#/user/user.repository";
import type { DataDocument, UploadResult } from "./data.repository";
import * as DataRepository from "./data.repository";
import type {
  DeleteDataRequest,
  PartialDataDocumentDto,
  ReadDataRequest,
  UpdateDataRequest,
} from "./data.types";

export function createRecords(
  ctx: AppBindings,
  owner: Did,
  schemaId: UUID,
  data: Record<string, unknown>[],
  tokens: NucToken[],
): E.Effect<
  UploadResult,
  | DataValidationError
  | DocumentNotFoundError
  | CollectionNotFoundError
  | DatabaseError
> {
  return E.Do.pipe(
    E.bind("document", () =>
      SchemasRepository.findOne(ctx, {
        _id: schemaId,
      }),
    ),
    E.bind("data", ({ document }) =>
      validateData<PartialDataDocumentDto[]>(document.schema, data),
    ),
    E.bind("result", ({ document, data }) =>
      DataRepository.insert(ctx, document, data, owner, tokens),
    ),
    E.flatMap(({ document, result }) => {
      if (document.documentType === "owned") {
        return UserRepository.upsert(ctx, owner, result.created, tokens).pipe(
          E.flatMap(() => E.succeed(result)),
        );
      }
      return E.succeed(result);
    }),
  );
}

export function updateRecords(
  ctx: AppBindings,
  request: UpdateDataRequest,
): E.Effect<
  UpdateResult,
  CollectionNotFoundError | DatabaseError | DataValidationError
> {
  return DataRepository.updateMany(
    ctx,
    request.schema,
    request.filter,
    request.update,
  );
}

export function readRecords(
  ctx: AppBindings,
  request: ReadDataRequest,
): E.Effect<
  DataDocument[],
  CollectionNotFoundError | DatabaseError | DataValidationError
> {
  return DataRepository.findMany(ctx, request.schema, request.filter);
}

export function deleteRecords(
  ctx: AppBindings,
  request: DeleteDataRequest,
  owner: Did,
): E.Effect<
  DeleteResult,
  CollectionNotFoundError | DatabaseError | DataValidationError,
  never
> {
  return DataRepository.findMany(ctx, request.schema, request.filter).pipe(
    E.flatMap((docs) =>
      UserRepository.removeData(
        ctx,
        owner,
        docs.map((doc) => doc._id.toString() as UuidDto),
      ),
    ),
    E.flatMap(() =>
      DataRepository.deleteMany(ctx, request.schema, request.filter),
    ),
  );
}

export function flushCollection(
  ctx: AppBindings,
  schema: UUID,
): E.Effect<DeleteResult, CollectionNotFoundError | DatabaseError, never> {
  return pipe(DataRepository.flushCollection(ctx, schema));
}

export function tailData(
  ctx: AppBindings,
  schema: UUID,
): E.Effect<DataDocument[], CollectionNotFoundError | DatabaseError, never> {
  return pipe(DataRepository.tailCollection(ctx, schema));
}
