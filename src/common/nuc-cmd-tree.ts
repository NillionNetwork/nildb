import { Command } from "@nillion/nuc";

export const NucCmd = {
  nil: {
    db: {
      admin: new Command(["nil", "db", "admin"]),
      accounts: new Command(["nil", "db", "accounts"]),
      data: new Command(["nil", "db", "data"]),
      schemas: new Command(["nil", "db", "schemas"]),
      queries: new Command(["nil", "db", "queries", "add"]),
    },
  },
} as const;
