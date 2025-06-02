import { z } from "zod";

export const PathSchema = z
  .string()
  .startsWith("/")
  .regex(/^(\/[a-z0-9_:.-]+)+$/i, {
    message: "Path must follow the format: /parent/child/:param/grandchild",
  })
  .brand<"path">();

export type Path = z.infer<typeof PathSchema>;

export const PathsV1 = {
  accounts: {
    register: PathSchema.parse("/api/v1/register"),
    me: PathSchema.parse("/api/v1/accounts/me"),
  },
  admin: {
    root: PathSchema.parse("/api/v1/admin"),
    maintenance: PathSchema.parse("/api/v1/admin/maintenance"),
    logLevel: PathSchema.parse("/api/v1/admin/log_level"),
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
    job: PathSchema.parse("/api/v1/queries/job"),
  },
  schemas: {
    root: PathSchema.parse("/api/v1/schemas"),
    byIdMeta: PathSchema.parse("/api/v1/schemas/:id/meta"),
    byIdIndexes: PathSchema.parse("/api/v1/schemas/:id/indexes"),
    byIdIndexesByName: PathSchema.parse("/api/v1/schemas/:id/indexes/:name"),
  },
  system: {
    about: PathSchema.parse("/about"),
    health: PathSchema.parse("/health"),
    metrics: PathSchema.parse("/metrics"),
  },
  user: {
    data: {
      root: PathSchema.parse("/api/v1/user/data"),
      perms: {
        read: PathSchema.parse("/api/v1/user/perms/read"),
        add: PathSchema.parse("/api/v1/user/perms/add"),
        update: PathSchema.parse("/api/v1/user/perms/update"),
        delete: PathSchema.parse("/api/v1/user/perms/delete"),
      },
    },
  },
} as const;
