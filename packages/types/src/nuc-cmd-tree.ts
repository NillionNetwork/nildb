function createNucNamespace(base: string) {
  return {
    root: base,
    create: `${base}/create`,
    read: `${base}/read`,
    update: `${base}/update`,
    delete: `${base}/delete`,
    execute: `${base}/execute`,
  };
}

export const NucCmd = {
  nil: {
    db: {
      root: "/nil/db",
      system: createNucNamespace("/nil/db/system"),
      builders: createNucNamespace("/nil/db/builders"),
      data: createNucNamespace("/nil/db/data"),
      collections: createNucNamespace("/nil/db/collections"),
      queries: createNucNamespace("/nil/db/queries"),
      users: createNucNamespace("/nil/db/users"),
    },
  },
} as const;
