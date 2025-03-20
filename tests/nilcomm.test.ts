import * as amqp from "amqplib";
import { UUID } from "mongodb";
import { describe } from "vitest";
import { ExchangeName, QueueName, RoutingKey } from "#/common/amqp";
import type { DocumentBase } from "#/common/mongo";
import { uuidFromBytes } from "#/common/shares";
import {
  type DappEventQueryExecutionCompleted,
  NILCOMM_COMMIT_REVEAL_QUERY_ID,
  NILCOMM_COMMIT_REVEAL_SCHEMA_ID,
} from "#/nilcomm/nilcomm.types";
import { bindQueues, purgeQueues } from "./fixture/amqp";
import { createTestFixtureExtension } from "./fixture/it";
import { convertB64ToBigint, encryptWithNodePk } from "./fixture/share";

type TestShare = {
  name: string;
  id: UUID;
  pt: bigint;
};

/**
 * Testing individual share uploads requires correlating async responses with their source.
 * While using correlation ids would be ideal, this introduces complexity in tracking message
 * origins across parallel tests. This test suite opts for a serial approach: processing all
 * messages through a single consumer to simplify verification at the cost of reduced parallelism.
 *
 * Test sequence rationale:
 * 1. Setup consumer first - Ensures no events are missed during publishing
 * 2. Publish messages sequentially - Avoids race conditions between tests
 * 3. Verify `SecretStored` events - Confirms AMQP layer functionality
 * 4. Validate database entries - Checks persistence layer independently
 * 5. Execute commit-reveal command - Tests full workflow integration
 * 6. Check result event - Validates end-to-end system behavior
 */
describe("nilcomm.test.ts > blind auction", () => {
  const { beforeAll, afterAll, it } = createTestFixtureExtension({
    enableNilcomm: true,
  });

  let channel: amqp.Channel;
  const shares: TestShare[] = [777n, -1n, 4042n, 0n].map((bid) => ({
    name: bid.toString(),
    id: new UUID(),
    pt: bid,
  }));

  beforeAll(async (ctx) => {
    const connection = await amqp.connect(ctx.bindings.config.mqUri);
    channel = await connection.createChannel();
    await bindQueues(channel);
  });

  afterAll(async (_ctx) => {
    await purgeQueues(channel);
  });

  it("handles secret store commands and emits stored events", async ({
    expect,
    bindings,
  }) => {
    const receivedIds = new Set<string>();
    let consumerTag = "";

    // 1. Set up consumer
    const consumptionPromise = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Timeout waiting for responses")),
        15000,
      );

      channel
        .consume(QueueName.nilCommEventSecretStored, (msg) => {
          if (!msg) return;

          try {
            const data = JSON.parse(msg.content.toString()) as { id: number[] };
            const storeId = uuidFromBytes(Buffer.from(data.id)).toString();
            receivedIds.add(storeId);
            channel.ack(msg);

            if (receivedIds.size === shares.length) {
              clearTimeout(timer);
              resolve();
            }
          } catch (error) {
            channel.nack(msg);
            reject(error);
          }
        })
        .then((consume) => {
          consumerTag = consume.consumerTag;
        });
    });

    // 2. Publish messages
    for (const share of shares) {
      const encryptedShare = encryptWithNodePk(
        bindings.node.identity.pk,
        share.pt.toString(),
      );

      const published = channel.publish(
        ExchangeName.Commands,
        RoutingKey.commandDappStoreSecret,
        Buffer.from(
          JSON.stringify({
            owner_pubkey: Array.from(
              Buffer.from(bindings.config.nilcommPublicKey!, "hex"),
            ),
            mapping_id: Array.from(share.id.buffer),
            share: Array.from(encryptedShare),
          }),
        ),
      );
      expect(published).toBeTruthy();
    }

    // 3. Wait for all responses
    await consumptionPromise;

    // 4. Cleanup consumer
    await channel.cancel(consumerTag);

    // 5. Verify store secret shares events were received
    for (const share of shares) {
      expect(receivedIds).toContain(share.id.toString());
    }
  });

  it("stores plain text shares in the database", async ({
    expect,
    bindings,
  }) => {
    // Verify all shares exist in DB
    const collection = bindings.db.data.collection<
      DocumentBase & { share: string }
    >(NILCOMM_COMMIT_REVEAL_SCHEMA_ID.toString());

    await Promise.all(
      shares.map(async ({ id, pt }) => {
        const document = await collection.findOne({ _id: id });
        expect(document).toBeTruthy();
        expect(convertB64ToBigint(document!.share)).toEqual(pt);
      }),
    );
  });

  it("handles the commit reveal command and emits the result ", async ({
    expect,
    bindings,
  }) => {
    const mapping_id = new UUID();
    let consumerTag = "";

    // 1. Set up consumer
    const consumptionPromise = new Promise<DappEventQueryExecutionCompleted>(
      (resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error("Timeout waiting for responses")),
          15000,
        );

        channel
          .consume(QueueName.nilCommEventQueryExecutionCompleted, (msg) => {
            if (!msg) return;

            try {
              const data = JSON.parse(
                msg.content.toString(),
              ) as DappEventQueryExecutionCompleted;

              channel.ack(msg);
              clearTimeout(timer);
              resolve(data);
            } catch (error) {
              channel.nack(msg);
              reject(error);
            }
          })
          .then((consume) => {
            consumerTag = consume.consumerTag;
          });
      },
    );

    // 2. Publish nilCommStartQueryExecution
    const published = channel.publish(
      ExchangeName.Commands,
      RoutingKey.commandDappStartQueryExecution,
      Buffer.from(
        JSON.stringify({
          owner_pubkey: Array.from(
            Buffer.from(bindings.config.nilcommPublicKey!, "hex"),
          ),
          mapping_id: Array.from(mapping_id.buffer),
          query_id: Array.from(NILCOMM_COMMIT_REVEAL_QUERY_ID.buffer),
          variables: shares.map((s) => Array.from(s.id.buffer)),
        }),
      ),
    );
    expect(published).toBeTruthy();

    // 3. Wait for response
    const result = await consumptionPromise;

    // 4. Cleanup consumer
    await channel.cancel(consumerTag);

    // 5. Validate the blind query execution result
    const actualMappingId = uuidFromBytes(new Uint8Array(result!.mapping_id));
    expect(actualMappingId.equals(mapping_id)).toBeTruthy();

    const bids = [];
    for (const [idAsString, shareAsArray] of Object.entries(result!.data)) {
      const uuid = new UUID(idAsString);
      const bid = BigInt(Buffer.from(shareAsArray).toString());

      const share = shares.find((s) => s.id.equals(uuid))!;
      expect(share.pt).toEqual(bid);
      bids.push(bid);
    }

    const expectedTopBid = shares
      .map((s) => s.pt)
      .sort()
      .at(0)!;
    const actualTopBid = bids.sort().at(0)!;

    expect(expectedTopBid).toBe(actualTopBid);
  });
});
