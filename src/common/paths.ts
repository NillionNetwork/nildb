export const PathsV1 = {
  accounts: {
    root: "/api/v1/accounts",
    publicKey: "/api/v1/accounts/public_key",
  },
  admin: {
    root: "/api/v1/admin",
    accounts: {
      root: "/api/v1/admin/accounts",
      subscriptions: "/api/v1/admin/accounts/subscription",
    },
    data: {
      delete: "/api/v1/admin/data/delete",
      flush: "/api/v1/admin/data/flush",
      read: "/api/v1/admin/data/read",
      tail: "/api/v1/admin/data/tail",
      update: "/api/v1/admin/data/update",
      upload: "/api/v1/admin/data/create",
    },
    queries: {
      root: "/api/v1/admin/queries",
      execute: "/api/v1/admin/queries/execute",
    },
    schemas: {
      root: "/api/v1/admin/schemas",
    },
    system: {
      maintenance: "/api/v1/admin/maintenance",
      byDidMaintenance: "/api/v1/admin/maintenance/:did",
    },
  },
  data: {
    root: "/api/v1/data",
    delete: "/api/v1/data/delete",
    flush: "/api/v1/data/flush",
    read: "/api/v1/data/read",
    tail: "/api/v1/data/tail",
    update: "/api/v1/data/update",
    upload: "/api/v1/data/create",
  },
  docs: "/api/v1/openapi/docs",
  queries: {
    root: "/api/v1/queries",
    execute: "/api/v1/queries/execute",
  },
  schemas: {
    root: "/api/v1/schemas",
  },
  system: {
    about: "/about",
    health: "/health",
    metrics: "/metrics",
  },
} as const;

export const PathsBeta = {
  admin: {
    schemas: {
      byIdMeta: "/api/beta/admin/schemas/:id/meta",
      byIdIndexes: "/api/beta/admin/schemas/:id/indexes",
      byIdIndexesByName: "/api/beta/admin/schemas/:id/indexes/:name",
    },
  },
  schemas: {
    byIdMeta: "/api/beta/schemas/:id/meta",
    byIdIndexes: "/api/beta/schemas/:id/indexes",
    byIdIndexesByName: "/api/beta/schemas/:id/indexes/:name",
  },
} as const;
