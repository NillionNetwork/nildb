import { z } from "zod";

export const Path = z
  .string()
  .startsWith("/")
  .regex(/^(\/[a-z0-9_:.-]+)+$/i, {
    message: "Path must follow the format: /parent/child/:param/grandchild",
  })
  .brand<"path">();

export type Path = z.infer<typeof Path>;

export const PathsV1 = {
  builders: {
    register: Path.parse("/v1/builders/register"),
    me: Path.parse("/v1/builders/me"),
  },
  data: {
    root: Path.parse("/v1/data"),
    find: Path.parse("/v1/data/find"),
    update: Path.parse("/v1/data/update"),
    delete: Path.parse("/v1/data/delete"),
    flushById: Path.parse("/v1/data/:id/flush"),
    tailById: Path.parse("/v1/data/:id/tail"),
    createOwned: Path.parse("/v1/data/owned"),
    createStandard: Path.parse("/v1/data/standard"),
  },
  queries: {
    root: Path.parse("/v1/queries"),
    byId: Path.parse("/v1/queries/:id"),
    run: Path.parse("/v1/queries/run"),
    runById: Path.parse("/v1/queries/run/:id"),
  },
  collections: {
    root: Path.parse("/v1/collections"),
    byId: Path.parse("/v1/collections/:id"),
    indexesById: Path.parse("/v1/collections/:id/indexes"),
    indexesByNameById: Path.parse("/v1/collections/:id/indexes/:name"),
  },
  system: {
    about: Path.parse("/about"),
    health: Path.parse("/health"),
    metrics: Path.parse("/metrics"),
    openApiJson: Path.parse("/openapi.json"),
    maintenanceStart: Path.parse("/v1/system/maintenance/start"),
    maintenanceStop: Path.parse("/v1/system/maintenance/stop"),
    logLevel: Path.parse("/v1/system/log-level"),
  },
  users: {
    me: Path.parse("/v1/users/me"),
    data: {
      root: Path.parse("/v1/users/data"),
      byId: Path.parse("/v1/users/data/:collection/:document"),
      aclById: Path.parse("/v1/users/data/:collection/:document/acl"),
      acl: {
        grant: Path.parse("/v1/users/data/acl/grant"),
        update: Path.parse("/v1/users/data/acl/update"),
        revoke: Path.parse("/v1/users/data/acl/revoke"),
      },
    },
  },
} as const;
