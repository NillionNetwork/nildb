import { ripemd160 } from "@noble/hashes/ripemd160";
import { sha256 } from "@noble/hashes/sha256";
import * as secp256k1 from "@noble/secp256k1";
import { bech32 } from "bech32";
import * as didJwt from "did-jwt";
import {
  type NilChainAddress,
  type NilDid,
  NilDidSchema,
} from "#/common/nil-did";

// 10 minutes
const DEFAULT_JWT_TTL = 1000 * 60 * 10;

export class Identity {
  private constructor(public _sk: Uint8Array) {}

  get pk(): string {
    const pubKey = secp256k1.getPublicKey(this._sk, true);
    return Buffer.from(pubKey).toString("hex");
  }

  get sk(): string {
    return Buffer.from(this._sk).toString("hex").padStart(64, "0");
  }

  get address(): NilChainAddress {
    const pubKeyBytes = Buffer.from(this.pk, "hex");
    const sha256Hash = sha256(pubKeyBytes);
    const ripemd160Hash = ripemd160(sha256Hash);

    const prefix = "nillion";
    const address = bech32.encode(prefix, bech32.toWords(ripemd160Hash));
    return address as NilChainAddress;
  }

  get did(): NilDid {
    return NilDidSchema.parse(`did:nil:${this.address}`);
  }

  createJwt(payload: { aud: NilDid }): Promise<string> {
    const signer = didJwt.ES256KSigner(Buffer.from(this.sk, "hex"));
    return didJwt.createJWT(payload, {
      signer,
      issuer: this.did,
      expiresIn: DEFAULT_JWT_TTL,
    });
  }

  static fromSk(skAsHex: string): Identity {
    const secretKey = Buffer.from(skAsHex, "hex");
    if (!secp256k1.utils.isValidPrivateKey(secretKey)) {
      throw new Error("Invalid private key");
    }
    return new Identity(secretKey);
  }

  static new(): Identity {
    const secretKey = secp256k1.utils.randomPrivateKey();
    return new Identity(secretKey);
  }

  static isDidFromPublicKey(did: NilDid, publicKeyAsHex: string): boolean {
    const address = did.split(":")[2];
    const pubKeyBytes = Buffer.from(publicKeyAsHex, "hex");

    const sha256Hash = sha256(pubKeyBytes);
    const ripemd160Hash = ripemd160(sha256Hash);

    const prefix = "nillion";
    const expected = bech32.encode(prefix, bech32.toWords(ripemd160Hash));

    return expected === address;
  }

  static didFromPkHex(pk: string): NilDid {
    const pubKeyBytes = Buffer.from(pk, "hex");
    const sha256Hash = sha256(pubKeyBytes);
    const ripemd160Hash = ripemd160(sha256Hash);

    const prefix = "nillion";
    const address = bech32.encode(prefix, bech32.toWords(ripemd160Hash));

    return NilDidSchema.parse(`did:nil:${address}`);
  }

  static didFromPkBytes(pk: Uint8Array): NilDid {
    const sha256Hash = sha256(pk);
    const ripemd160Hash = ripemd160(sha256Hash);

    const prefix = "nillion";
    const address = bech32.encode(prefix, bech32.toWords(ripemd160Hash));

    return NilDidSchema.parse(`did:nil:${address}`);
  }
}
