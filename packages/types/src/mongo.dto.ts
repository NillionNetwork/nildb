import { z } from "zod";

/**
 * MongoDB operators that execute server-side JavaScript.
 *
 * Filters and update documents are accepted as free-form objects and handed
 * to the driver, so without this screen a caller can run arbitrary JavaScript
 * inside MongoDB (`{"$where": "while(true){}"}`) whenever server-side
 * scripting is enabled, which it is by default. Access control still applies
 * to the documents returned, but the execution itself is a denial of service
 * and a timing side channel.
 *
 * Disabling scripting on the server (`security.javascriptEnabled: false`) is
 * the belt to this braces and is recommended in the admin guide.
 */
const SERVER_SIDE_JS_OPERATORS: ReadonlySet<string> = new Set(["$where", "$function", "$accumulator"]);

/** Bounds the walk over deliberately deeply nested input. */
const MAX_SCAN_DEPTH = 32;

function findServerSideJsOperator(value: unknown, depth = 0): string | null {
  if (depth > MAX_SCAN_DEPTH) {
    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findServerSideJsOperator(item, depth + 1);
      if (found) {
        return found;
      }
    }
    return null;
  }

  if (typeof value !== "object" || value === null) {
    return null;
  }

  for (const [key, nested] of Object.entries(value)) {
    if (SERVER_SIDE_JS_OPERATORS.has(key)) {
      return key;
    }
    const found = findServerSideJsOperator(nested, depth + 1);
    if (found) {
      return found;
    }
  }

  return null;
}

/**
 * A free-form MongoDB filter or update document that may not invoke
 * server-side JavaScript.
 */
export const MongoExpression = z.record(z.string(), z.unknown()).superRefine((value, ctx) => {
  const operator = findServerSideJsOperator(value);
  if (operator) {
    ctx.addIssue({
      code: "custom",
      message: `Operator '${operator}' is not permitted`,
    });
  }
});
export type MongoExpression = z.infer<typeof MongoExpression>;

const PROTECTED_DOCUMENT_FIELDS: ReadonlySet<string> = new Set(["_id", "_owner", "_acl", "_created", "_updated"]);

function protectedField(path: string): string | null {
  const root = path.split(".", 1)[0];
  return PROTECTED_DOCUMENT_FIELDS.has(root) ? root : null;
}

/** Mongo update document that cannot alter nilDB-managed metadata. */
export const MongoUpdateExpression = MongoExpression.superRefine((update, ctx) => {
  for (const [operatorOrPath, operand] of Object.entries(update)) {
    if (!operatorOrPath.startsWith("$")) {
      const field = protectedField(operatorOrPath);
      if (field) {
        ctx.addIssue({ code: "custom", message: `Field '${field}' is managed by nilDB and cannot be updated` });
      }
      continue;
    }

    if (typeof operand !== "object" || operand === null || Array.isArray(operand)) continue;
    for (const [path, value] of Object.entries(operand)) {
      const field = protectedField(path);
      if (field) {
        ctx.addIssue({ code: "custom", message: `Field '${field}' is managed by nilDB and cannot be updated` });
      }
      if (operatorOrPath === "$rename" && typeof value === "string") {
        const destination = protectedField(value);
        if (destination) {
          ctx.addIssue({
            code: "custom",
            message: `Field '${destination}' is managed by nilDB and cannot be a rename target`,
          });
        }
      }
    }
  }
});
export type MongoUpdateExpression = z.infer<typeof MongoUpdateExpression>;
