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
