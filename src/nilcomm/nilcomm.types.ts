import { UUID } from "mongodb";
import { z } from "zod";
import { EncryptedShare, uuidFromBytes, uuidToBytes } from "#/common/shares";

// nilcomm schema and query ids are fixed
export const NILCOMM_COMMIT_REVEAL_SCHEMA_ID = new UUID(
  "a6c3680d-dd3e-4060-9793-c3cd6d5f683b",
);
export const NILCOMM_COMMIT_REVEAL_QUERY_ID = new UUID(
  "2cd3f20f-05e5-40df-96f4-e1b0a8800081",
);

/**
 * Schema for validating and transforming arrays of numbers (0-255) into Uint8Array
 */
export const BytesArraySchema = z
  .array(z.number().min(0).max(255))
  .transform((data) => new Uint8Array(data));

export const DappCommandStoreSecretSchema = z
  .object({
    owner_pubkey: BytesArraySchema,
    mapping_id: BytesArraySchema,
    share: BytesArraySchema,
  })
  .transform((d) => {
    // nilcomm supports multiple chains, and so we don't use a did:nil which is nilchain specific
    const ownerPk = Buffer.from(d.owner_pubkey).toString("hex");
    const mappingId = uuidFromBytes(d.mapping_id);
    const share = EncryptedShare.from(d.share);

    return {
      ownerPk,
      mappingId,
      share,
    };
  });

export type DappCommandStoreSecret = z.infer<
  typeof DappCommandStoreSecretSchema
>;

export const DappEventSecretStoredSchema = z
  .object({
    mappingId: z.custom<UUID>(),
  })
  .transform((d) => ({
    mapping_id: uuidToBytes(d.mappingId),
  }));

export type DappEventSecretStored = z.infer<typeof DappEventSecretStoredSchema>;

export const DappEventStoreSecretCommandFailedSchema = z
  .object({
    storeId: z.instanceof(UUID),
    cause: z.string(),
  })
  .transform((d) => ({
    mapping_id: uuidToBytes(d.storeId),
    cause: d.cause,
  }));

export type DappEventStoreSecretCommandFailed = z.infer<
  typeof DappEventStoreSecretCommandFailedSchema
>;

export const DappCommandStartQueryExecutionSchema = z
  .object({
    owner_pubkey: BytesArraySchema,
    mapping_id: BytesArraySchema,
    query_id: BytesArraySchema,
    variables: z.array(BytesArraySchema),
  })
  .transform((d) => {
    // nilcomm supports multiple chains, and so we don't use a did:nil which is nilchain specific
    const ownerPk = Buffer.from(d.owner_pubkey).toString("hex");
    const mappingId = uuidFromBytes(d.mapping_id);
    const queryId = uuidFromBytes(d.query_id);
    const variables = d.variables.map(uuidFromBytes);

    return {
      ownerPk,
      mappingId,
      queryId,
      variables,
    };
  });

export type DappCommandStartQueryExecution = z.infer<
  typeof DappCommandStartQueryExecutionSchema
>;

export const DappEventQueryExecutionCompletedSchema = z
  .object({
    mappingId: z.instanceof(UUID),
    data: z.record(z.string(), z.array(z.number())),
  })
  .transform((d) => {
    return {
      mapping_id: Array.from(d.mappingId.buffer),
      data: d.data,
    };
  });

export type DappEventQueryExecutionCompleted = z.infer<
  typeof DappEventQueryExecutionCompletedSchema
>;

export const DappEventExecuteQueryCommandFailedSchema = z
  .object({
    queryId: z.instanceof(UUID),
    cause: z.string(),
  })
  .transform((d) => ({
    query_id: uuidToBytes(d.queryId),
    cause: d.cause,
  }));

export type DappEventExecuteQueryCommandFailed = z.infer<
  typeof DappEventExecuteQueryCommandFailedSchema
>;
