import { Effect as E } from "effect";
import { cloneDeep, get, set } from "es-toolkit/compat";
import { UUID } from "mongodb";
import { type ZodType, z } from "zod";
import { DataValidationError } from "#/common/errors";

/**
 * The set of supported types that a json value can be coerced into.
 */
export const CoercibleTypesSchema = z.enum([
  "string",
  "number",
  "boolean",
  "date",
  "uuid",
] as const);
export type CoercibleTypes = z.infer<typeof CoercibleTypesSchema>;

/**
 * Represents the base object containing key-value data that may be subject to
 * type coercion. This is the payload to which a `$coerce` map is applied.
 */
export const CoercibleValuesSchema = z.record(z.string(), z.unknown());
export type CoercibleValues = z.infer<typeof CoercibleValuesSchema>;

/**
 * Defines a data structure that pairs a data object with an optional `$coerce`
 * map. The `$coerce` map provides instructions on how to transform the types
 * of values within the data object, supporting nested paths via dot notation.
 *
 * @example
 * ```json
 * {
 *   "filter": {
 *     "amount": "100",
 *     "user": {
 *       "id": "a1b2c3d4-1234-5678-9abc-def123456789"
 *     }
 *   },
 *   "$coerce": {
 *     "filter.amount": "number",
 *     "filter.user.id": "uuid"
 *   }
 * }
 * ```
 */
export const CoercibleMapSchema = z.intersection(
  CoercibleValuesSchema,
  z.object({
    $coerce: z.record(z.string(), CoercibleTypesSchema).optional(),
  }),
);
export type CoercibleMap = z.infer<typeof CoercibleMapSchema>;

// A map of Zod schemas, one for each type we can coerce to.
const coercers: Record<CoercibleTypes, ZodType> = {
  string: z.coerce.string(),
  number: z.coerce.number(),
  boolean: z.coerce.boolean(),
  date: z.coerce.date(),
  uuid: z.uuid().transform((s) => new UUID(s)),
};

/**
 * Applies type coercions to a data object based on a provided `$coerce` map.
 * This function supports deeply nested paths using dot notation and returns
 * a new, coerced object without mutating the original.
 *
 * @param coercibleMap - The object containing the data and the `$coerce` instructions.
 * @returns An `Effect` that resolves to the new, coerced object or fails with a `DataValidationError`.
 *
 * @example
 * ```ts
 * const input = {
 *   filter: {
 *     amount: "100",
 *     user: {
 *       id: "a1b2c3d4-1234-5678-9abc-def123456789"
 *     }
 *   },
 *   $coerce: {
 *     "filter.amount": "number",
 *     "filter.user.id": "uuid"
 *   }
 * };
 *
 * const coerced = E.runSync(applyCoercions(input));
 *
 * // coerced.filter.amount is now the number 100
 * // coerced.filter.user.id is now a UUID object
 * ```
 */
export function applyCoercions(
  coercibleMap: CoercibleMap,
): E.Effect<Record<string, unknown>, DataValidationError> {
  const { $coerce, ...values } = coercibleMap;
  if (!$coerce) {
    return E.succeed(values);
  }

  const result = cloneDeep(values);

  for (const [path, type] of Object.entries($coerce)) {
    const originalValue = get(result, path);

    // Path does not exist in the object, so skip it.
    if (originalValue === undefined) {
      continue;
    }

    const coercer = coercers[type];

    if (Array.isArray(originalValue)) {
      const coercedArray: unknown[] = [];
      for (const item of originalValue) {
        const parsed = coercer.safeParse(item);
        if (!parsed.success) {
          return E.fail(
            new DataValidationError({
              issues: [parsed.error],
              cause: { value: item, path, type },
            }),
          );
        }
        coercedArray.push(parsed.data);
      }
      set(result, path, coercedArray);
      continue; // Move to the next path
    }

    const parsed = coercer.safeParse(originalValue);

    if (!parsed.success) {
      return E.fail(
        new DataValidationError({
          issues: [parsed.error],
          cause: { value: originalValue, path, type },
        }),
      );
    }

    set(result, path, parsed.data);
  }

  return E.succeed(result);
}
