import { Temporal } from "temporal-polyfill";

type CacheValue<V> = {
  value: V;
  expires: Temporal.Instant;
};

const DEFAULT_TTL = Temporal.Duration.from({ minutes: 1 });
// There is a limitation in Duration in that it does not let you add years directly
// because of the ambiguity introduced (eg leap years, etc). So we convert 10 years to hours.
export const CACHE_FOREVER = Temporal.Duration.from({ hours: 87600 });

export class Cache<K, V> {
  private _db = new Map<K, CacheValue<V>>();
  constructor(private ttl = DEFAULT_TTL) {}

  set(key: K, value: V, ttl = this.ttl): void {
    const expires = Temporal.Now.instant().add(ttl);

    this._db.set(key, {
      value,
      expires,
    });
  }

  get(key: K): V | null {
    const entry = this._db.get(key);
    if (!entry) return null;

    const now = Temporal.Now.instant();
    const expired = Temporal.Instant.compare(now, entry.expires) > 0;

    if (expired) {
      this._db.delete(key);
      return null;
    }

    return entry.value;
  }

  delete(key: K): boolean {
    return this._db.delete(key);
  }

  taint(key: K): void {
    const entry = this._db.get(key);
    if (entry) {
      entry.expires = Temporal.Instant.fromEpochMilliseconds(0);
    }
  }
}
