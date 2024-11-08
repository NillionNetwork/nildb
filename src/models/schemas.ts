import { Effect as E, pipe } from "effect";
import type { MongoClient } from "mongodb";
import { type OrgDocument, OrgDocumentModel } from "#/models/orgs";
import { handleInsertErrors } from "#/utils";

export function addOrgSchemaRecord(
  orgId: string,
  schemaName: string,
  schema: object,
): E.Effect<OrgDocument, Error> {
  return pipe(
    E.tryPromise(() =>
      OrgDocumentModel.findOneAndUpdate(
        { _id: orgId },
        {
          $set: {
            [`schemas.${schemaName}`]: JSON.stringify(schema),
          },
        },
      ),
    ),
    E.flatMap((doc) =>
      doc === null
        ? E.fail(new Error(`Failed to find orgs/${orgId}`))
        : E.succeed(doc as OrgDocument),
    ),
    E.mapError(
      (cause) =>
        new Error(`Failed to add orgs/${orgId}/schemas/${schemaName}`, {
          cause,
        }),
    ),
    E.map((result) => result as OrgDocument),
  );
}

export function createOrgSchemaCollection(
  client: MongoClient,
  primaryKeys: string[],
  name: string,
): E.Effect<string, Error> {
  return pipe(
    E.tryPromise(async () => {
      await client.db().createCollection(name);

      const indexes = primaryKeys.map((key) => ({
        key: { [key]: 1 },
        unique: true,
      }));

      return client.db().collection(name).createIndexes(indexes);
    }),
    E.map(() => name),
  );
}

export function removeOrgSchemaRecord(
  orgId: string,
  name: string,
): E.Effect<OrgDocument, Error> {
  return pipe(
    E.tryPromise(() =>
      OrgDocumentModel.findOneAndUpdate(
        { _id: orgId },
        { $unset: { [`schemas.${name}`]: "" } },
      ),
    ),
    E.flatMap((doc) =>
      doc === null
        ? E.fail(new Error(`Failed to remove orgs/${orgId}/schemas/${name}`))
        : E.succeed(doc as OrgDocument),
    ),
    E.mapError(
      (cause) =>
        new Error(`Failed to remove orgs/${orgId}/schemas/${name}`, {
          cause,
        }),
    ),
  );
}

export function removeOrgSchemaCollection(
  client: MongoClient,
  name: string,
): E.Effect<string, Error> {
  return pipe(
    E.tryPromise(async () => {
      const collections = await client
        .db()
        .listCollections({ name }, { nameOnly: true })
        .toArray();

      if (collections.length === 0) {
        throw new Error(`Unknown schema collection: ${name}`);
      }
      return client.db().dropCollection(name);
    }),
    E.flatMap((success) =>
      success
        ? E.succeed(name)
        : E.fail(new Error(`Failed to delete collection/${name}`)),
    ),
    E.mapError((cause) => {
      return new Error(`Failed to delete collection/${name}`, {
        cause,
      });
    }),
  );
}

export function listOrgSchemas(
  orgId: string,
): E.Effect<{ id: string; schema: string }[], Error> {
  return pipe(
    E.tryPromise(() => {
      return OrgDocumentModel.findById(orgId);
    }),
    E.flatMap((doc) =>
      doc
        ? E.succeed(doc.toObject().schemas)
        : E.fail(new Error(`Failed to find orgs/${orgId}`)),
    ),
    E.mapError((cause) => new Error(`Failed to find orgs/${orgId}`, { cause })),
    E.map((schemas) =>
      Array.from(schemas.entries()).map(([id, schema]) => {
        return {
          id,
          schema,
        };
      }),
    ),
  );
}

export function insertSchemaData(
  client: MongoClient,
  collection: string,
  data: object[],
): E.Effect<string, Error> {
  return pipe(
    E.tryPromise(async () => {
      try {
        await client
          .db()
          .collection(collection)
          .insertMany(data, { ordered: false });
      } catch (insert_errors) {
        await handleInsertErrors(client, collection, insert_errors);
      }
    }),
    E.map(() => collection),
  );
}
