import * as ecies from "eciesjs";

export function encryptWithNodePk(pk: string, data: string): Uint8Array {
  const bytes = new TextEncoder().encode(data);
  return ecies.encrypt(pk, bytes);
}

export function convertB64ToBigint(data: string): bigint {
  const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
  const str = new TextDecoder().decode(bytes);
  return BigInt(str);
}
