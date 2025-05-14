import { z } from "zod";

export const PathSchema = z
  .string()
  .startsWith("/")
  .regex(/^(\/[a-z0-9_:.-]+)+$/i, {
    message: "Path must follow format: /parent/child/:param/grandchild",
  })
  .brand<"path">();

export type Path = z.infer<typeof PathSchema>;

export const PathsV1 = {
  accounts: {
    root: PathSchema.parse("/api/v1/accounts"),
    publicKey: PathSchema.parse("/api/v1/accounts/public_key"),
    subscription: PathSchema.parse("/api/v1/accounts/subscription"),
  },
  admin: {
    root: PathSchema.parse("/api/v1/admin"),
    accounts: {
      root: PathSchema.parse("/api/v1/admin/accounts"),
      subscription: PathSchema.parse("/api/v1/admin/accounts/subscription"),
      subscriptionByDid: PathSchema.parse(
        "/api/v1/admin/accounts/subscription/:did",
      ),
    },
    data: {
      delete: PathSchema.parse("/api/v1/admin/data/delete"),
      flush: PathSchema.parse("/api/v1/admin/data/flush"),
      read: PathSchema.parse("/api/v1/admin/data/read"),
      tail: PathSchema.parse("/api/v1/admin/data/tail"),
      update: PathSchema.parse("/api/v1/admin/data/update"),
      upload: PathSchema.parse("/api/v1/admin/data/create"),
    },
    queries: {
      root: PathSchema.parse("/api/v1/admin/queries"),
      execute: PathSchema.parse("/api/v1/admin/queries/execute"),
    },
    schemas: {
      root: PathSchema.parse("/api/v1/admin/schemas"),
    },
    system: {
      maintenance: PathSchema.parse("/api/v1/admin/maintenance"),
      logLevel: PathSchema.parse("/api/v1/admin/log_level"),
    },
  },
  data: {
    root: PathSchema.parse("/api/v1/data"),
    delete: PathSchema.parse("/api/v1/data/delete"),
    flush: PathSchema.parse("/api/v1/data/flush"),
    read: PathSchema.parse("/api/v1/data/read"),
    tail: PathSchema.parse("/api/v1/data/tail"),
    update: PathSchema.parse("/api/v1/data/update"),
    upload: PathSchema.parse("/api/v1/data/create"),
  },
  docs: PathSchema.parse("/api/v1/openapi/docs"),
  openai: {
    openApiJson: PathSchema.parse("/api/v1/openai/openapi.json"),

    accounts: {
      profile: PathSchema.parse("/api/v1/openai/accounts/me"),
    },

    schemas: {
      list: PathSchema.parse("/api/v1/openai/schemas/list"),
      create: PathSchema.parse("/api/v1/openai/schemas/create"),
      remove: PathSchema.parse("/api/v1/openai/schemas/remove"),
      metadata: PathSchema.parse("/api/v1/openai/schemas/metadata/:id"),
    },

    queries: {
      list: PathSchema.parse("/api/v1/openai/queries/list"),
      create: PathSchema.parse("/api/v1/openai/queries/create"),
      remove: PathSchema.parse("/api/v1/openai/queries/remove"),
      execute: PathSchema.parse("/api/v1/openai/queries/execute"),
    },

    data: {
      tail: PathSchema.parse("/api/v1/openai/data/tail"),
      upload: PathSchema.parse("/api/v1/openai/data/upload"),
      read: PathSchema.parse("/api/v1/openai/data/read"),
      remove: PathSchema.parse("/api/v1/openai/data/find"),
    },
  },
  queries: {
    root: PathSchema.parse("/api/v1/queries"),
    execute: PathSchema.parse("/api/v1/queries/execute"),
  },
  schemas: {
    root: PathSchema.parse("/api/v1/schemas"),
  },
  system: {
    about: PathSchema.parse("/about"),
    health: PathSchema.parse("/health"),
    metrics: PathSchema.parse("/metrics"),
  },
} as const;

export const PathsBeta = {
  admin: {
    schemas: {
      byIdMeta: PathSchema.parse("/api/beta/admin/schemas/:id/meta"),
      byIdIndexes: PathSchema.parse("/api/beta/admin/schemas/:id/indexes"),
      byIdIndexesByName: PathSchema.parse(
        "/api/beta/admin/schemas/:id/indexes/:name",
      ),
    },
  },
  schemas: {
    byIdMeta: PathSchema.parse("/api/beta/schemas/:id/meta"),
    byIdIndexes: PathSchema.parse("/api/beta/schemas/:id/indexes"),
    byIdIndexesByName: PathSchema.parse("/api/beta/schemas/:id/indexes/:name"),
  },
} as const;
