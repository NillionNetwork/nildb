import { decrypt } from "eciesjs";
import { UUID } from "mongodb";

export class EncryptedShare {
  constructor(public inner: Uint8Array) {}

  decrypt(secretKey: string): Share {
    const pt = decrypt(secretKey, this.inner);
    return new Share(pt);
  }

  static from(value: Uint8Array): EncryptedShare {
    return new EncryptedShare(value);
  }
}

export class Share {
  constructor(public inner: Uint8Array) {}

  toBase64(): string {
    return Buffer.from(this.inner).toString("base64");
  }

  static fromBase64(value: string): Share {
    const inner = Buffer.from(value, "base64");
    return new Share(inner);
  }
}

export function uuidToBytes(value: UUID): number[] {
  return Array.from(value.buffer);
}

export function uuidFromBytes(value: Uint8Array): UUID {
  return new UUID(value);
}
