import { Effect as E, pipe } from "effect";
import type { CreateIndexesOptions, IndexSpecification, UUID } from "mongodb";
import type { OrganizationAccountDocument } from "#/accounts/accounts.types";
import type { CreateSchemaIndexRequest } from "#/admin/admin.types";
import type {
  DataCollectionNotFoundError,
  DatabaseError,
  DocumentNotFoundError,
  IndexNotFoundError,
  InvalidIndexOptionsError,
  PrimaryCollectionNotFoundError,
} from "#/common/errors";
import type { Did } from "#/common/types";
import { validateSchema } from "#/common/validator";
import * as DataRepository from "#/data/data.repository";
import type { AppBindings } from "#/env";
import * as OrganizationRepository from "#/organizations/organizations.repository";
import type { AddSchemaRequest, SchemaMetadata } from "#/schemas/schemas.types";
import type { SchemaDocument } from "./schemas.repository";
import * as SchemasRepository from "./schemas.repository";

export function getOrganizationSchemas(
  ctx: AppBindings,
  organization: OrganizationAccountDocument,
): E.Effect<
  SchemaDocument[],
  DocumentNotFoundError | PrimaryCollectionNotFoundError | DatabaseError
> {
  return SchemasRepository.findMany(ctx, { owner: organization._id });
}

export function addSchema(
  ctx: AppBindings,
  request: AddSchemaRequest & { owner: Did },
): E.Effect<
  void,
  | DocumentNotFoundError
  | InvalidIndexOptionsError
  | PrimaryCollectionNotFoundError
  | DatabaseError
> {
  const now = new Date();
  const document: SchemaDocument = {
    ...request,
    _created: now,
    _updated: now,
  };

  return pipe(
    validateSchema(request.schema),
    () => SchemasRepository.insert(ctx, document),
    E.flatMap(() =>
      E.all([
        E.succeed(ctx.cache.accounts.taint(document.owner)),
        OrganizationRepository.addSchema(ctx, request.owner, document._id),
        DataRepository.createCollection(ctx, document._id),
      ]),
    ),
  );
}

export function deleteSchema(
  ctx: AppBindings,
  schemaId: UUID,
): E.Effect<
  void,
  | DocumentNotFoundError
  | DataCollectionNotFoundError
  | PrimaryCollectionNotFoundError
  | DatabaseError
> {
  return pipe(
    SchemasRepository.deleteOne(ctx, { _id: schemaId }),
    E.flatMap((schema) =>
      E.all([
        E.succeed(ctx.cache.accounts.taint(schema.owner)),
        OrganizationRepository.removeSchema(ctx, schema.owner, schemaId),
        DataRepository.deleteCollection(ctx, schemaId),
      ]),
    ),
    E.as(void 0),
  );
}

export function getSchemaMetadata(
  ctx: AppBindings,
  _id: UUID,
): E.Effect<SchemaMetadata, DataCollectionNotFoundError | DatabaseError> {
  return pipe(SchemasRepository.getCollectionStats(ctx, _id));
}

export function createIndex(
  ctx: AppBindings,
  schema: UUID,
  request: CreateSchemaIndexRequest,
): E.Effect<
  void,
  InvalidIndexOptionsError | PrimaryCollectionNotFoundError | DatabaseError
> {
  const specification: IndexSpecification = request.keys;
  const options: CreateIndexesOptions = {
    name: request.name,
    unique: request.unique,
  };

  if (request.ttl) {
    options.expireAfterSeconds = request.ttl;
  }

  return pipe(
    SchemasRepository.createIndex(ctx, schema, specification, options),
    E.as(void 0),
  );
}

export function dropIndex(
  ctx: AppBindings,
  schema: UUID,
  name: string,
): E.Effect<
  void,
  IndexNotFoundError | PrimaryCollectionNotFoundError | DatabaseError
> {
  return pipe(SchemasRepository.dropIndex(ctx, schema, name), E.as(void 0));
}
