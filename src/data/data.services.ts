import { Effect as E, pipe } from "effect";
import type { DeleteResult, UUID, UpdateResult } from "mongodb";
import type {
  DataCollectionNotFoundError,
  DataValidationError,
  DatabaseError,
  DocumentNotFoundError,
  PrimaryCollectionNotFoundError,
} from "#/common/errors";
import { validateData } from "#/common/validator";
import type { AppBindings } from "#/env";
import * as SchemasRepository from "#/schemas/schemas.repository";
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
  schemaId: UUID,
  data: Record<string, unknown>[],
): E.Effect<
  UploadResult,
  | DataValidationError
  | DocumentNotFoundError
  | DataCollectionNotFoundError
  | PrimaryCollectionNotFoundError
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
    E.flatMap(({ document, data }) =>
      DataRepository.insert(ctx, document, data),
    ),
  );
}

export function updateRecords(
  ctx: AppBindings,
  request: UpdateDataRequest,
): E.Effect<UpdateResult, DataCollectionNotFoundError | DatabaseError> {
  return pipe(
    DataRepository.updateMany(
      ctx,
      request.schema,
      request.filter,
      request.update,
    ),
  );
}

export function readRecords(
  ctx: AppBindings,
  request: ReadDataRequest,
): E.Effect<DataDocument[], DataCollectionNotFoundError | DatabaseError> {
  return pipe(
    E.succeed(request),
    E.map(({ schema, filter }) => {
      return {
        schema,
        filter,
      };
    }),
    E.flatMap(({ schema, filter }) =>
      DataRepository.findMany(ctx, schema, filter),
    ),
  );
}

export function deleteRecords(
  ctx: AppBindings,
  request: DeleteDataRequest,
): E.Effect<DeleteResult, DataCollectionNotFoundError | DatabaseError, never> {
  return pipe(DataRepository.deleteMany(ctx, request.schema, request.filter));
}

export function flushCollection(
  ctx: AppBindings,
  schema: UUID,
): E.Effect<DeleteResult, DataCollectionNotFoundError | DatabaseError, never> {
  return pipe(DataRepository.flushCollection(ctx, schema));
}

export function tailData(
  ctx: AppBindings,
  schema: UUID,
): E.Effect<
  DataDocument[],
  DataCollectionNotFoundError | DatabaseError,
  never
> {
  return pipe(DataRepository.tailCollection(ctx, schema));
}
