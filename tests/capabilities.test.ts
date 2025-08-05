import { Builder, Did, type Envelope, Signer } from "@nillion/nuc";
import { StatusCodes } from "http-status-codes";
import { describe } from "vitest";
import { NucCmd } from "#/common/nuc-cmd-tree";
import { PathsV1 } from "#/common/paths";
import collectionJson from "./data/simple.collection.json";
import queryJson from "./data/simple.query.json";
import type { CollectionFixture, QueryFixture } from "./fixture/fixture";
import { createTestFixtureExtension } from "./fixture/it";

describe("update data", () => {
  const collection = collectionJson as unknown as CollectionFixture;
  const query = queryJson as unknown as QueryFixture;
  const { it, beforeAll, afterAll } = createTestFixtureExtension({
    collection: collection,
    query,
  });

  let root: Envelope;
  let delegation: Envelope;

  beforeAll(async (c) => {
    const { builder, user } = c;

    const audience = user._options.keypair.toDid();
    root = await builder.getRootToken();

    delegation = await Builder.delegating(root)
      .command(NucCmd.nil.db.builders.read)
      .addPolicy(["==", "$.req.headers.origin", "good.com"])
      .audience(audience)
      .build(Signer.fromKeypair(builder.keypair));
  });

  afterAll(async (_c) => {});

  it("rejects if origin policy fails", async ({ c }) => {
    const { expect, user } = c;

    const audience = Did.fromPublicKey(user._options.nodePublicKey);

    const invocation = await Builder.invoking(delegation)
      .audience(audience)
      .signAndSerialize(Signer.fromKeypair(user.keypair));

    const response = await user.app.request(PathsV1.builders.me, {
      headers: {
        origin: "bad.com",
        authorization: `bearer ${invocation}`,
      },
    });

    expect(response.ok).toBeFalsy();
    expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
  });

  it("accepts if correct origin passes", async ({ c }) => {
    const { expect, user } = c;

    const invocation = await Builder.invoking(delegation)
      .audience(Did.fromPublicKey(user._options.nodePublicKey))
      .signAndSerialize(Signer.fromKeypair(user.keypair));

    const response = await user.app.request(PathsV1.builders.me, {
      headers: {
        origin: "good.com",
        authorization: `bearer ${invocation}`,
      },
    });

    expect(response.ok).toBeTruthy();
  });
});
