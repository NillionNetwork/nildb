import { Effect as E, Option as O, pipe } from "effect";
import type { StrictFilter, StrictUpdateFilter } from "mongodb";
import { Temporal } from "temporal-polyfill";
import type { AdminSetMaintenanceWindowRequest } from "#/admin/admin.types";
import {
  DatabaseError,
  DocumentNotFoundError,
  type PrimaryCollectionNotFoundError,
} from "#/common/errors";
import { CollectionName, checkPrimaryCollectionExists } from "#/common/mongo";
import type { AppBindings } from "#/env";
import type { ConfigDocument, MaintenanceWindow } from "./system.types";

export function setMaintenanceWindow(
  ctx: AppBindings,
  data: AdminSetMaintenanceWindowRequest,
): E.Effect<void, PrimaryCollectionNotFoundError | DatabaseError> {
  const filter: StrictFilter<ConfigDocument> = { _type: "maintenance" };
  const update: StrictUpdateFilter<ConfigDocument> = {
    $set: { window: { start: data.start, end: data.end } },
  };

  return pipe(
    checkPrimaryCollectionExists<ConfigDocument>(ctx, CollectionName.Config),
    E.flatMap((collection) =>
      E.tryPromise({
        try: () =>
          collection.updateOne(filter, update, {
            upsert: true,
          }),
        catch: (cause) =>
          new DatabaseError({ cause, message: "setMaintenanceWindow" }),
      }),
    ),
    E.as(void 0),
  );
}

export function findMaintenanceWindow(
  ctx: AppBindings,
): E.Effect<
  O.Option<MaintenanceWindow>,
  PrimaryCollectionNotFoundError | DatabaseError | DocumentNotFoundError
> {
  const filter: StrictFilter<ConfigDocument> = {
    _type: "maintenance",
  };

  return pipe(
    checkPrimaryCollectionExists<ConfigDocument>(ctx, CollectionName.Config),
    E.flatMap((collection) =>
      E.tryPromise({
        try: () => collection.findOne(filter),
        catch: (cause) =>
          new DatabaseError({ cause, message: "findMaintenanceWindow" }),
      }),
    ),
    E.flatMap((result) => {
      if (!result || !result.window) {
        return O.none();
      }

      const window = {
        start: Temporal.Instant.from(result.window.start.toISOString()),
        end: Temporal.Instant.from(result.window.end.toISOString()),
      };
      return E.succeed(O.some(window));
    }),
    E.mapError(
      () =>
        new DocumentNotFoundError({
          collection: CollectionName.Config,
          filter,
        }),
    ),
  );
}

export function deleteMaintenanceWindow(
  ctx: AppBindings,
): E.Effect<
  void,
  PrimaryCollectionNotFoundError | DatabaseError | DocumentNotFoundError
> {
  const filter: StrictFilter<ConfigDocument> = { _type: "maintenance" };

  return pipe(
    checkPrimaryCollectionExists<ConfigDocument>(ctx, CollectionName.Config),
    E.flatMap((collection) =>
      E.tryPromise({
        try: () =>
          collection.updateOne(filter, {
            $unset: { window: "" },
          }),
        catch: (cause) =>
          new DatabaseError({ cause, message: "deleteMaintenanceWindow" }),
      }),
    ),
    E.mapError(
      () =>
        new DocumentNotFoundError({
          collection: CollectionName.Config,
          filter,
        }),
    ),
    E.as(void 0),
  );
}
