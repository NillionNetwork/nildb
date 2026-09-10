import { toPath } from "es-toolkit/compat";

/**
 * Path segments that let a write escape its target object and reach a shared
 * prototype.
 *
 * `es-toolkit`'s `set()` refuses `__proto__` but nothing else, so a path such
 * as `constructor.prototype.toString` walks to `Object.prototype` and corrupts
 * every object in the process. Any path that originates from a request body
 * must be screened before it reaches `get()`/`set()`.
 */
const FORBIDDEN_PATH_SEGMENTS: ReadonlySet<string> = new Set(["__proto__", "constructor", "prototype"]);

/**
 * Split a dotted/bracketed path into its segments.
 *
 * Uses the same parser as `get()`/`set()` so that the segments screened here
 * are exactly the segments those functions will walk.
 */
export function splitPath(path: string): string[] {
  return toPath(path);
}

/**
 * Returns true when any segment of the path could reach a prototype.
 *
 * Screens the parsed segments rather than the raw string so that bracket and
 * quote notation (`a["constructor"].prototype`) cannot smuggle a segment past
 * a substring check.
 */
export function isUnsafePath(path: string): boolean {
  return splitPath(path).some((segment) => FORBIDDEN_PATH_SEGMENTS.has(segment));
}
