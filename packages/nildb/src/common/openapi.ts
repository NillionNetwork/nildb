import { ApiErrorResponse } from "@nillion/nildb-types";
import { resolver } from "hono-openapi";
import { ReasonPhrases } from "http-status-codes";

export const OpenApiSpecEmptySuccessResponses = {
  200: { description: ReasonPhrases.OK },
  201: { description: ReasonPhrases.CREATED },
  204: { description: ReasonPhrases.NO_CONTENT },
} as const;

// biome-ignore lint/suspicious/noExplicitAny: Avoid TypeScript portability errors in monorepo — full type is would be very noisy
export const OpenApiSpecCommonErrorResponses: Record<string, any> = {
  400: {
    description: ReasonPhrases.BAD_REQUEST,
    content: {
      "application/json": {
        schema: resolver(ApiErrorResponse),
      },
    },
  },
  401: {
    description: ReasonPhrases.UNAUTHORIZED,
  },
  403: {
    description: ReasonPhrases.FORBIDDEN,
  },
  404: {
    description: ReasonPhrases.NOT_FOUND,
  },
  500: {
    description: ReasonPhrases.INTERNAL_SERVER_ERROR,
  },
};
