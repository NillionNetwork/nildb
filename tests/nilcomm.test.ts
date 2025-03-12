import * as amqp from "amqplib";
import { UUID } from "mongodb";
import { describe } from "vitest";
import { ExchangeName, QueueName, RoutingKey } from "#/common/amqp";
import { uuidFromBytes, uuidToBytes } from "#/common/shares";
import type { DataDocument } from "#/data/data.repository";
import {
  NILCOMM_COMMIT_REVEAL_QUERY_ID,
  NILCOMM_COMMIT_REVEAL_SCHEMA_ID,
} from "#/nilcomm/nilcomm.types";
import { bindQueues, purgeQueues } from "./fixture/amqp";
import { createTestFixtureExtension } from "./fixture/it";

describe("nilcomm.test.ts", () => {
  const { it, beforeAll, afterAll } = createTestFixtureExtension({
    keepDbs: true,
  });

  let channel: amqp.Channel;
  const storeId = new UUID();
  const share = Array.from(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]));
  let pubKey: number[];

  beforeAll(async (ctx) => {
    const connection = await amqp.connect(ctx.bindings.config.mqUri);
    channel = await connection.createChannel();
    await bindQueues(channel);

    pubKey = Array.from(
      Buffer.from(ctx.bindings.config.nilcommPublicKey!, "hex"),
    );
  });

  afterAll(async (_ctx) => {
    await purgeQueues(channel);
  });

  it("handles store secret command", async ({ expect }) => {
    const payload = {
      owner_pubkey: pubKey,
      mapping_id: Array.from(storeId.buffer),
      share: share,
    };

    const published = channel.publish(
      ExchangeName.Commands,
      RoutingKey.commandDappStoreSecret,
      Buffer.from(JSON.stringify(payload)),
    );

    expect(published).toBeTruthy();
  });

  it("emits secret stored event", async ({ expect }) => {
    const promise = new Promise<void>((resolve, reject) => {
      setTimeout(() => reject(), 5000);
      channel
        .consume(QueueName.nilCommEventSecretStored, (msg) => {
          if (!msg) return;
          const content = msg.content.toString();
          channel.ack(msg!);

          const parsed = JSON.parse(content);
          const id = uuidFromBytes(new Uint8Array(parsed.id));
          expect(id.toString()).toEqual(storeId.toString());
          resolve();
        })
        .catch((err) => {
          console.error(err);
          throw err;
        });
    });

    await expect(promise).resolves.toBeUndefined();
  });

  it("stores the secret in database", async ({ expect, bindings }) => {
    const promise = new Promise<void>((resolve, reject) => {
      setTimeout(() => reject(), 5000);
      bindings.db.data
        .collection<DataDocument>(NILCOMM_COMMIT_REVEAL_SCHEMA_ID.toString())
        .findOne({
          _id: storeId,
        })
        .then((document) => {
          expect(document?._id.toString()).toBe(storeId.toString());
          resolve();
        });
    });
    await expect(promise).resolves.toBeUndefined();
  });

  const queryMappingId = new UUID();

  it("handles start query execution command", async ({ expect }) => {
    const payload = {
      owner_pubkey: pubKey,
      mapping_id: uuidToBytes(queryMappingId),
      query_id: uuidToBytes(NILCOMM_COMMIT_REVEAL_QUERY_ID),
      variables: [Array.from(storeId.buffer)],
    };

    const published = channel.publish(
      ExchangeName.Commands,
      RoutingKey.commandDappStartQueryExecution,
      Buffer.from(JSON.stringify(payload)),
    );

    expect(published).toBeTruthy();
  });

  it("emits query execution completed event", async ({ expect }) => {
    const promise = new Promise<void>((resolve, reject) => {
      setTimeout(() => reject(), 5000);
      channel
        .consume(QueueName.nilCommEventQueryExecutionCompleted, (msg) => {
          if (!msg) return;

          const content = msg.content.toString();
          channel.ack(msg);

          const parsed = JSON.parse(content);
          const id = uuidFromBytes(new Uint8Array(parsed.mapping_id));
          expect(id.toString()).toEqual(queryMappingId.toString());
          resolve();
        })
        .catch((err) => {
          console.error(err);
          throw err;
        });
    });

    await expect(promise).resolves.toBeUndefined();
  });
});
