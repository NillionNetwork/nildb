import { randomUUID } from "node:crypto";
import argon2 from "argon2";
import { Effect as E, Option as O, pipe } from "effect";
import { UUID } from "mongodb";
import mongoose from "mongoose";
import { type DbError, succeedOrMapToDbError } from "./errors";
import { CollectionName, getPrimaryDbName } from "./names";

export type UserBase = {
  _id: UUID;
  email: string;
  password: string;
  type: "root" | "admin";
};

const UserDocumentSchema = new mongoose.Schema(
  {
    _id: {
      type: mongoose.Schema.Types.UUID,
      default: () => randomUUID(),
      get: (val: Buffer) => new UUID(val),
    },
    email: { type: String, unique: true, index: true },
    password: String,
    type: { type: String, enum: ["root", "admin"] },
  },
  { timestamps: true },
);

const Model = mongoose.model(CollectionName.Users, UserDocumentSchema);

export const UsersRepository = {
  findByEmail(email: string): E.Effect<UserBase, DbError> {
    const filter = { email: email.toLowerCase() };

    return pipe(
      E.tryPromise(async () => {
        const result = await Model.findOne(filter).lean<UserBase>();
        return O.fromNullable(result);
      }),
      succeedOrMapToDbError({
        db: getPrimaryDbName(),
        collection: CollectionName.Users,
        name: "findByEmail",
        params: { filter },
      }),
    );
  },

  create(data: Omit<UserBase, "_id">): E.Effect<UUID, Error> {
    return E.Do.pipe(
      E.bind("data", () =>
        E.tryPromise(async () => {
          const salted = await argon2.hash(data.password);
          return {
            email: data.email.toLowerCase(),
            password: salted,
            type: data.type,
          };
        }),
      ),
      E.bind("document", ({ data }) =>
        E.tryPromise(async () => {
          const document = await Model.create(data);
          return new UUID(document._id);
        }),
      ),
      E.flatMap(({ document, data }) => {
        return pipe(
          E.succeed(document),
          succeedOrMapToDbError({
            db: getPrimaryDbName(),
            collection: CollectionName.Users,
            name: "create",
            params: { data },
          }),
        );
      }),
    );
  },

  delete(email: string): E.Effect<boolean, DbError> {
    const filter = { email };
    return pipe(
      E.tryPromise(async () => {
        const result = await Model.deleteOne(filter);
        return result.deletedCount === 1;
      }),
      succeedOrMapToDbError({
        db: getPrimaryDbName(),
        collection: CollectionName.Users,
        name: "delete",
        params: { filter },
      }),
    );
  },
} as const;
