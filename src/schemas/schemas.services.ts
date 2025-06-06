import { Effect as E, pipe } from "effect";
import type { CreateIndexesOptions, IndexSpecification, UUID } from "mongodb";
import type { OrganizationAccountDocument } from "#/accounts/accounts.types";
import type {
  CollectionNotFoundError,
  DatabaseError,
  DataValidationError,
  DocumentNotFoundError,
  IndexNotFoundError,
  InvalidIndexOptionsError,
} from "#/common/errors";
import { validateSchema } from "#/common/validator";
import * as DataRepository from "#/data/data.repository";
import type { AppBindings } from "#/env";
import * as OrganizationRepository from "#/organizations/organizations.repository";
import type {
  AddSchemaCommand,
  CreateIndexCommand,
  DeleteSchemaCommand,
  DropIndexCommand,
  SchemaDocument,
  SchemaMetadata,
} from "#/schemas/schemas.types";
import * as SchemasRepository from "./schemas.repository";

export function getOrganizationSchemas(
  ctx: AppBindings,
  organization: OrganizationAccountDocument,
): E.Effect<
  SchemaDocument[],
  | DocumentNotFoundError
  | CollectionNotFoundError
  | DatabaseError
  | DataValidationError
> {
  return SchemasRepository.findMany(ctx, { owner: organization._id });
}

export function addSchema(
  ctx: AppBindings,
  command: AddSchemaCommand,
): E.Effect<
  void,
  | DocumentNotFoundError
  | InvalidIndexOptionsError
  | CollectionNotFoundError
  | DatabaseError
> {
  const now = new Date();
  const document: SchemaDocument = {
    _id: command._id,
    name: command.name,
    schema: command.schema,
    documentType: command.documentType,
    owner: command.owner,
    _created: now,
    _updated: now,
  };

  return pipe(
    validateSchema(command.schema),
    () => SchemasRepository.insert(ctx, document),
    E.flatMap(() =>
      E.all([
        E.succeed(ctx.cache.accounts.taint(document.owner)),
        OrganizationRepository.addSchema(ctx, command.owner, document._id),
        DataRepository.createCollection(ctx, document._id),
      ]),
    ),
    E.as(void 0),
  );
}

export function deleteSchema(
  ctx: AppBindings,
  command: DeleteSchemaCommand,
): E.Effect<
  void,
  | DocumentNotFoundError
  | CollectionNotFoundError
  | DatabaseError
  | DataValidationError
> {
  return pipe(
    SchemasRepository.deleteOne(ctx, { _id: command.id }),
    E.flatMap((schema) =>
      E.all([
        E.succeed(ctx.cache.accounts.taint(schema.owner)),
        OrganizationRepository.removeSchema(ctx, schema.owner, command.id),
        DataRepository.deleteCollection(ctx, command.id),
      ]),
    ),
    E.as(void 0),
  );
}

export function getSchemaMetadata(
  ctx: AppBindings,
  _id: UUID,
): E.Effect<SchemaMetadata, CollectionNotFoundError | DatabaseError> {
  return pipe(SchemasRepository.getCollectionStats(ctx, _id));
}

export function createIndex(
  ctx: AppBindings,
  command: CreateIndexCommand,
): E.Effect<
  void,
  InvalidIndexOptionsError | CollectionNotFoundError | DatabaseError
> {
  const specification: IndexSpecification = command.keys;
  const options: CreateIndexesOptions = {
    name: command.name,
    unique: command.unique,
  };

  if (command.ttl) {
    options.expireAfterSeconds = command.ttl;
  }

  return pipe(
    SchemasRepository.createIndex(ctx, command.schema, specification, options),
    E.as(void 0),
  );
}

export function dropIndex(
  ctx: AppBindings,
  command: DropIndexCommand,
): E.Effect<
  void,
  IndexNotFoundError | CollectionNotFoundError | DatabaseError
> {
  return pipe(
    SchemasRepository.dropIndex(ctx, command.schema, command.name),
    E.as(void 0),
  );
}
