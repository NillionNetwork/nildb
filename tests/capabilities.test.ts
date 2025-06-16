import {
  DelegationBody,
  Did,
  Equals,
  InvocationBody,
  NucTokenBuilder,
  type NucTokenEnvelope,
  NucTokenEnvelopeSchema,
  SelectorSchema,
} from "@nillion/nuc";
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

  let root: NucTokenEnvelope;
  let delegation: NucTokenEnvelope;

  beforeAll(async (c) => {
    const { builder, user } = c;

    const audience = Did.fromHex(user._options.keypair.publicKey("hex"));
    root = await builder.getRootToken();

    const delegationRaw = NucTokenBuilder.extending(root)
      .command(NucCmd.nil.db.builders.read)
      .body(
        new DelegationBody([
          new Equals(SelectorSchema.parse("$.req.headers.origin"), "good.com"),
        ]),
      )
      .audience(audience)
      .build(builder.keypair.privateKey());

    delegation = NucTokenEnvelopeSchema.parse(delegationRaw);
  });

  afterAll(async (_c) => {});

  it("rejects if origin policy fails", async ({ c }) => {
    const { expect, user } = c;

    const audience = Did.fromHex(user._options.nodePublicKey);

    const invocation = NucTokenBuilder.extending(delegation)
      .audience(audience)
      .body(new InvocationBody({}))
      .build(user.keypair.privateKey());

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

    const audience = Did.fromHex(user._options.nodePublicKey);

    const invocation = NucTokenBuilder.extending(delegation)
      .audience(audience)
      .body(new InvocationBody({}))
      .build(user.keypair.privateKey());

    const response = await user.app.request(PathsV1.builders.me, {
      headers: {
        origin: "good.com",
        authorization: `bearer ${invocation}`,
      },
    });

    expect(response.ok).toBeTruthy();
  });
});
