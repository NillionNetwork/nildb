import { Command } from "@nillion/nuc";

function createNucNamespace(prefix: string) {
  const base = prefix.split("/");
  return {
    root: new Command([...base]),
    create: new Command([...base, "create"]),
    read: new Command([...base, "read"]),
    update: new Command([...base, "update"]),
    delete: new Command([...base, "delete"]),
    execute: new Command([...base, "execute"]),
  };
}

export const NucCmd = {
  nil: {
    db: {
      system: createNucNamespace("nil/db/system"),
      builders: createNucNamespace("nil/db/builders"),
      data: createNucNamespace("nil/db/data"),
      collections: createNucNamespace("nil/db/collections"),
      queries: createNucNamespace("nil/db/queries"),
      users: createNucNamespace("nil/db/users"),
    } as const,
  } as const,
} as const;
