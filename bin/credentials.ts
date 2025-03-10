import { Command } from "commander";
import { z } from "zod";
import { Identity } from "#/common/identity";
import { PRIVATE_KEY_LENGTH, PUBLIC_KEY_LENGTH } from "#/env";

const Args = z.object({
  secretKey: z.string().length(PRIVATE_KEY_LENGTH).optional(),
  nodePublicKey: z.string().length(PUBLIC_KEY_LENGTH).optional(),
});
type Args = z.infer<typeof Args>;

type Output = {
  client: {
    sk: string;
    pk: string;
    did: string;
    jwt?: string;
  };
  node?: {
    pk: string;
    did: string;
  };
};

async function main(): Promise<void> {
  const program = new Command();

  program
    .name("nilDB credential utils")
    .description("Create credentials for nilDB communications")
    .option("-s, --secret-key <key>", "The client's hex-encoded secret key")
    .option(
      "-n, --node-public-key <key>",
      "The node's hex-encoded public key. Required for JWT generation.",
    )
    .version("0.0.1");

  program.parse(process.argv);
  const options = Args.parse(program.opts<Args>());

  const result: Partial<Output> = {};

  const identity = options.secretKey
    ? Identity.fromSk(options.secretKey)
    : Identity.new();
  result.client = {
    sk: identity.sk,
    pk: identity.pk,
    did: identity.did,
  };

  if (options.nodePublicKey) {
    const nodePk = options.nodePublicKey;
    const nodeDid = Identity.didFromPkHex(nodePk);
    const jwt = await identity.createJwt({ aud: nodeDid });

    result.client.jwt = jwt;
    result.node = {
      did: nodeDid,
      pk: nodePk,
    };
  }

  console.log(result);
}

await main();
