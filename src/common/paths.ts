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
    register: PathSchema.parse("/v1/register"),
    me: PathSchema.parse("/v1/builders/me"),
  },
  data: {
    root: PathSchema.parse("/v1/data"),
    flush: PathSchema.parse("/v1/data/flush"),
    tail: PathSchema.parse("/v1/data/tail"),
    delete: PathSchema.parse("/v1/data/delete"),
    read: PathSchema.parse("/v1/data/read"),
    update: PathSchema.parse("/v1/data/update"),
    createOwned: PathSchema.parse("/v1/data/owned/create"),
    createStandard: PathSchema.parse("/v1/data/standard/create"),
  },
  queries: {
    root: PathSchema.parse("/v1/queries"),
    execute: PathSchema.parse("/v1/queries/execute"),
    job: PathSchema.parse("/v1/queries/job"),
  },
  schemas: {
    root: PathSchema.parse("/v1/schemas"),
    byIdMeta: PathSchema.parse("/v1/schemas/:id/meta"),
    byIdIndexes: PathSchema.parse("/v1/schemas/:id/indexes"),
    byIdIndexesByName: PathSchema.parse("/v1/schemas/:id/indexes/:name"),
  },
  system: {
    about: PathSchema.parse("/about"),
    health: PathSchema.parse("/health"),
    metrics: PathSchema.parse("/metrics"),
    openApiJson: PathSchema.parse("/openapi.json"),
    maintenanceStart: PathSchema.parse("/v1/system/maintenance/start"),
    maintenanceStop: PathSchema.parse("/v1/system/maintenance/stop"),
    logLevel: PathSchema.parse("/v1/system/log-level"),
  },
  users: {
    data: {
      root: PathSchema.parse("/v1/users/data"),
      perms: {
        read: PathSchema.parse("/v1/users/perms/read"),
        add: PathSchema.parse("/v1/users/perms/add"),
        update: PathSchema.parse("/v1/users/perms/update"),
        delete: PathSchema.parse("/v1/users/perms/delete"),
      },
    },
  },
} as const;
