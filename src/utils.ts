import { UnknownException } from "effect/Cause";
import type { StatusCode } from "hono/dist/types/utils/http-status";
import type { Document, MongoClient, WriteError } from "mongodb";
import { customAlphabet } from "nanoid";
import type { BaseLogger } from "pino";
import { ZodError } from "zod";

const prefixGenerator = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz");

export function createShortId(length = 4): string {
  return prefixGenerator(length);
}

export function findRootError(
  error: unknown,
  scope: string,
  log: BaseLogger,
): StatusCode {
  if (error instanceof ZodError) {
    log.error({ err: error }, scope);
    return 404;
  }

  if (error instanceof UnknownException) {
    log.error({ err: error.cause }, scope);
    return 400;
  }

  return 500;
}

async function getUniqueIndexes(
  client: MongoClient,
  collection: string,
): Promise<string[]> {
  const indexes = await client.db().collection(collection).indexes();
  return indexes
    .filter((index) => index.unique)
    .map((index) => Object.keys(index.key)[0]);
}

async function updateDuplicateKeys(
  client: MongoClient,
  collection: string,
  duplicateKeyErrors: WriteError[],
): Promise<void> {
  const uniqueIndexes = await getUniqueIndexes(client, collection);
  const bulkOps: {
    updateOne: {
      filter: Record<string, any>;
      update: { $set: Record<string, any> };
    };
  }[] = [];
  for (const insert_err of duplicateKeyErrors) {
    const doc = insert_err.err?.op;
    if (doc && typeof doc === "object" && "_id" in doc) {
      const { _id, ...update } = doc as Document;
      const filter: Record<string, any> = {};
      for (const pkField of uniqueIndexes) {
        if (doc[pkField] !== undefined) {
          filter[pkField] = doc[pkField];
        }
      }
      bulkOps.push({
        updateOne: {
          filter,
          update: { $set: update },
        },
      });
    }
  }
  if (bulkOps.length > 0) {
    await client.db().collection(collection).bulkWrite(bulkOps);
  }
}

export async function handleInsertErrors(
  client: MongoClient,
  collection: string,
  insertErrors: any,
): Promise<void> {
  const writeErrors = insertErrors?.writeErrors || [];
  if (writeErrors.length > 0) {
    const duplicateKeyErrors = writeErrors.filter(
      (insert_err: WriteError) => insert_err.code === 11000,
    );
    if (duplicateKeyErrors.length > 0) {
      await updateDuplicateKeys(client, collection, duplicateKeyErrors);
    }
  }
}
