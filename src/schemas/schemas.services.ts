import { Effect as E, pipe } from "effect";
import type { CreateIndexesOptions, IndexSpecification, UUID } from "mongodb";
import type { OrganizationAccountDocument } from "#/accounts/accounts.types";
import type { CreateSchemaIndexRequest } from "#/admin/admin.types";
import { ServiceError } from "#/common/app-error";
import type {
  DatabaseError,
  IndexNotFoundError,
  InvalidIndexOptionsError,
  SchemaNotFoundError,
} from "#/common/errors";
import type { NilDid } from "#/common/nil-did";
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
): E.Effect<SchemaDocument[], ServiceError> {
  return pipe(
    E.succeed(organization._id),
    E.flatMap((owner) => SchemasRepository.findMany(ctx, { owner })),
    E.mapError((cause) => {
      const reason = [`Get organization schemas failed: ${organization._id}`];
      return new ServiceError({ reason, cause });
    }),
  );
}

export function addSchema(
  ctx: AppBindings,
  request: AddSchemaRequest & { owner: NilDid },
): E.Effect<UUID, ServiceError> {
  return pipe(
    validateSchema(request.schema),
    E.flatMap(() => {
      const now = new Date();
      const document: SchemaDocument = {
        ...request,
        _created: now,
        _updated: now,
      };
      return SchemasRepository.insert(ctx, document);
    }),
    E.tap((schemaId) => {
      return DataRepository.createCollection(ctx, schemaId);
    }),
    E.tap((schemaId) => {
      return OrganizationRepository.addSchema(ctx, request.owner, schemaId);
    }),
    E.mapError((cause) => {
      const reason = ["Add schema failed"];
      return new ServiceError({ reason, cause });
    }),
  );
}

export function deleteSchema(
  ctx: AppBindings,
  schemaId: UUID,
): E.Effect<SchemaDocument, ServiceError> {
  return pipe(
    SchemasRepository.deleteOne(ctx, { _id: schemaId }),
    E.tap((schema) => {
      return OrganizationRepository.removeSchema(ctx, schema.owner, schemaId);
    }),
    E.tap((_orgId) => {
      return DataRepository.deleteCollection(ctx, schemaId);
    }),
    E.mapError((cause) => {
      const reason = [`Delete schema failed: ${schemaId.toString()}`];
      return new ServiceError({ reason, cause });
    }),
  );
}

export function getSchemaMetadata(
  ctx: AppBindings,
  _id: UUID,
): E.Effect<SchemaMetadata, SchemaNotFoundError | DatabaseError> {
  return pipe(SchemasRepository.getCollectionStats(ctx, _id));
}

export function createIndex(
  ctx: AppBindings,
  schema: UUID,
  request: CreateSchemaIndexRequest,
): E.Effect<
  void,
  SchemaNotFoundError | InvalidIndexOptionsError | DatabaseError
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
): E.Effect<void, SchemaNotFoundError | IndexNotFoundError | DatabaseError> {
  return pipe(
    SchemasRepository.dropIndex(ctx, schema, name),
    E.tap((document) => {
      ctx.log.info(document);
    }),
    E.as(void 0),
  );
}
