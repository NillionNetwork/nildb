/**
 * Result type for API operations.
 *
 * Enables clean error handling without exceptions, making it easier to
 * compose operations and aggregate results from multiple sources.
 *
 * @example
 * ```typescript
 * const result = await client.getProfile();
 * if (result.ok) {
 *   console.log(result.data);
 * } else {
 *   console.error(result.error, result.status);
 * }
 * ```
 */
export type Result<T, E = string> = { ok: true; data: T } | { ok: false; error: E; status?: number };
