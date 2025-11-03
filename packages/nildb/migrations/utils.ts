import type { MongoClient } from "mongodb";

/**
 * Checks if the connected MongoDB instance supports transactions.
 * It does this by running the `hello` command and checking the server's response
 * for indicators of a replica set or sharded cluster topology.
 */
export async function checkTransactionSupport(
  client: MongoClient,
): Promise<boolean> {
  try {
    const admin = client.db().admin();
    const hello = await admin.command({ hello: 1 });
    const isReplicaSet = hello.setName !== undefined;
    const isSharded = hello.msg === "isdbgrid";
    return isReplicaSet || isSharded;
  } catch (error) {
    console.error("Failed to check deployment type:", error);
    return false;
  }
}
