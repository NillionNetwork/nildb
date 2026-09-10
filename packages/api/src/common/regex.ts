/**
 * Screening for builder-supplied regular expressions.
 *
 * Collection schemas are written by builders and compiled with Ajv, which
 * turns a `pattern` keyword into a native `RegExp`. Node's regex engine
 * backtracks, so a pattern with nested quantifiers such as `^(a+)+$` matched
 * against a crafted string blocks the event loop for the whole process:
 * validation cost roughly doubles per added character.
 *
 * The complete fix is a non-backtracking engine. Ajv supports one through its
 * `code.regExp` option, so installing `re2` and constructing Ajv with
 * `new Ajv({ code: { regExp: RE2 } })` removes the class of problem entirely.
 * Until that native dependency is acceptable, the static screen below rejects
 * the shapes that actually cause exponential blow-up.
 */

/** Long patterns are both suspicious and expensive to analyse. */
const MAX_PATTERN_LENGTH = 300;

type GroupFrame = {
  /** Whether this group contains a quantifier at any depth. */
  hasQuantifier: boolean;
};

function isQuantifierAt(pattern: string, index: number): boolean {
  const char = pattern[index];
  if (char === "*" || char === "+") {
    return true;
  }
  if (char !== "{") {
    return false;
  }
  // `{n,}` and `{n,m}` are unbounded enough to matter; `{n}` is not.
  const close = pattern.indexOf("}", index);
  if (close === -1) {
    return false;
  }
  return pattern.slice(index + 1, close).includes(",");
}

/**
 * Detect a pattern whose star height exceeds one, i.e. a quantified group that
 * itself contains a quantifier. This is the classic catastrophic-backtracking
 * shape: `(a+)+`, `(a*)*`, `(\d+)+`.
 *
 * Known limitation: alternation blow-up such as `(a|a)*` has star height one
 * and is not caught here. A non-backtracking engine is the only complete
 * answer.
 */
export function hasNestedQuantifier(pattern: string): boolean {
  const stack: GroupFrame[] = [{ hasQuantifier: false }];
  let inCharacterClass = false;

  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i];

    if (char === "\\") {
      // Skip the escaped character; it is a literal, never structure.
      i++;
      continue;
    }

    if (inCharacterClass) {
      if (char === "]") {
        inCharacterClass = false;
      }
      continue;
    }

    if (char === "[") {
      inCharacterClass = true;
      continue;
    }

    if (char === "(") {
      stack.push({ hasQuantifier: false });
      continue;
    }

    if (char === ")") {
      const frame = stack.pop();
      if (!frame) {
        // Unbalanced pattern; let the engine reject it.
        return false;
      }
      const parent = stack[stack.length - 1] ?? { hasQuantifier: false };
      const quantified = isQuantifierAt(pattern, i + 1);

      if (quantified && frame.hasQuantifier) {
        return true;
      }

      parent.hasQuantifier = parent.hasQuantifier || frame.hasQuantifier || quantified;
      continue;
    }

    if (isQuantifierAt(pattern, i)) {
      stack[stack.length - 1].hasQuantifier = true;
    }
  }

  return false;
}

/**
 * Return a reason if the pattern should not be compiled, otherwise null.
 */
export function screenPattern(pattern: string): string | null {
  if (pattern.length > MAX_PATTERN_LENGTH) {
    return `pattern exceeds ${MAX_PATTERN_LENGTH} characters`;
  }
  if (hasNestedQuantifier(pattern)) {
    return "pattern contains nested quantifiers and could backtrack catastrophically";
  }
  return null;
}

/**
 * Walk a JSON schema and return the first unsafe regular expression found,
 * looking at both `pattern` values and `patternProperties` keys.
 */
export function findUnsafePattern(schema: unknown): { pattern: string; reason: string } | null {
  if (Array.isArray(schema)) {
    for (const item of schema) {
      const found = findUnsafePattern(item);
      if (found) {
        return found;
      }
    }
    return null;
  }

  if (typeof schema !== "object" || schema === null) {
    return null;
  }

  for (const [key, value] of Object.entries(schema)) {
    if (key === "pattern" && typeof value === "string") {
      const reason = screenPattern(value);
      if (reason) {
        return { pattern: value, reason };
      }
      continue;
    }

    if (key === "patternProperties" && typeof value === "object" && value !== null) {
      for (const patternKey of Object.keys(value)) {
        const reason = screenPattern(patternKey);
        if (reason) {
          return { pattern: patternKey, reason };
        }
      }
    }

    const found = findUnsafePattern(value);
    if (found) {
      return found;
    }
  }

  return null;
}
