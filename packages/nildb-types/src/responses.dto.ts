import z from "zod";

export const ApiErrorResponse = z
  .object({
    errors: z.array(z.string()),
    ts: z.string(),
  })
  .meta({ ref: "ApiErrorResponse" });
export type ApiErrorResponse = z.infer<typeof ApiErrorResponse>;

export const ApiSuccessResponse = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    data: dataSchema,
  });

export type ApiSuccessResponse<T> = {
  data: T;
};
