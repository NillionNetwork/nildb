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
  builders: {
    register: PathSchema.parse("/api/v1/register"),
    me: PathSchema.parse("/api/v1/builders/me"),
  },
  admin: {
    root: PathSchema.parse("/api/v1/admin"),
  },
  data: {
    root: PathSchema.parse("/api/v1/data"),
    flush: PathSchema.parse("/api/v1/data/flush"),
    tail: PathSchema.parse("/api/v1/data/tail"),
    delete: PathSchema.parse("/api/v1/data/delete"),
    read: PathSchema.parse("/api/v1/data/read"),
    update: PathSchema.parse("/api/v1/data/update"),
    createOwned: PathSchema.parse("/api/v1/data/owned/create"),
    createStandard: PathSchema.parse("/api/v1/data/standard/create"),
  },
  docs: PathSchema.parse("/openapi.json"),
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
    maintenanceStart: PathSchema.parse("/api/v1/system/maintenance/start"),
    maintenanceStop: PathSchema.parse("/api/v1/system/maintenance/stop"),
    logLevel: PathSchema.parse("/api/v1/system/log-level"),
  },
  users: {
    data: {
      root: PathSchema.parse("/api/v1/users/data"),
      perms: {
        read: PathSchema.parse("/api/v1/users/perms/read"),
        add: PathSchema.parse("/api/v1/users/perms/add"),
        update: PathSchema.parse("/api/v1/users/perms/update"),
        delete: PathSchema.parse("/api/v1/users/perms/delete"),
      },
    },
  },
} as const;
