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
    register: PathSchema.parse("/v1/builders/register"),
    me: PathSchema.parse("/v1/builders/me"),
  },
  data: {
    root: PathSchema.parse("/v1/data"),
    search: PathSchema.parse("/v1/data/search"),
    update: PathSchema.parse("/v1/data/update"),
    delete: PathSchema.parse("/v1/data/delete"),
    flushById: PathSchema.parse("/v1/data/:id/flush"),
    tailById: PathSchema.parse("/v1/data/:id/tail"),
    createOwned: PathSchema.parse("/v1/data/owned"),
    createStandard: PathSchema.parse("/v1/data/standard"),
  },
  queries: {
    root: PathSchema.parse("/v1/queries"),
    byId: PathSchema.parse("/v1/queries/:id"),
    run: PathSchema.parse("/v1/queries/run"),
    runById: PathSchema.parse("/v1/queries/run/:id"),
  },
  schemas: {
    root: PathSchema.parse("/v1/schemas"),
    byId: PathSchema.parse("/v1/schemas/:id"),
    indexesById: PathSchema.parse("/v1/schemas/:id/indexes"),
    indexesByNameById: PathSchema.parse("/v1/schemas/:id/indexes/:name"),
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
    me: PathSchema.parse("/v1/users/me"),
    data: {
      root: PathSchema.parse("/v1/users/data"),
      byId: PathSchema.parse("/v1/users/data/:schema/:document"),
      aclById: PathSchema.parse("/v1/users/data/:schema/:document/acl"),
      acl: {
        grant: PathSchema.parse("/v1/users/data/acl/grant"),
        update: PathSchema.parse("/v1/users/data/acl/update"),
        revoke: PathSchema.parse("/v1/users/data/acl/revoke"),
      },
    },
  },
} as const;
