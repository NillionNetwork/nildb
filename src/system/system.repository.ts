import { Effect as E, Option as O, pipe } from "effect";
import type { StrictFilter, StrictUpdateFilter } from "mongodb";
import { Temporal } from "temporal-polyfill";
import type { AdminSetMaintenanceWindowRequest } from "#/admin/admin.types";
import {
  type CollectionNotFoundError,
  DatabaseError,
  DocumentNotFoundError,
} from "#/common/errors";
import { checkCollectionExists, CollectionName } from "#/common/mongo";
import type { AppBindings } from "#/env";
import type { ConfigDocument, MaintenanceWindow } from "./system.types";

export function setMaintenanceWindow(
  ctx: AppBindings,
  data: AdminSetMaintenanceWindowRequest,
): E.Effect<void, CollectionNotFoundError | DatabaseError> {
  const filter: StrictFilter<ConfigDocument> = { _type: "maintenance" };
  const update: StrictUpdateFilter<ConfigDocument> = {
    $set: { window: { start: data.start, end: data.end } },
  };

  return pipe(
    checkCollectionExists<ConfigDocument>(
      ctx,
      "primary",
      CollectionName.Config,
    ),
    E.tryMapPromise({
      try: (collection) =>
        collection.updateOne(filter, update, {
          upsert: true,
        }),
      catch: (cause) =>
        new DatabaseError({ cause, message: "setMaintenanceWindow" }),
    }),
    E.as(void 0),
  );
}

export function findMaintenanceWindow(
  ctx: AppBindings,
): E.Effect<
  O.Option<MaintenanceWindow>,
  CollectionNotFoundError | DatabaseError | DocumentNotFoundError
> {
  const filter: StrictFilter<ConfigDocument> = {
    _type: "maintenance",
  };

  return pipe(
    checkCollectionExists<ConfigDocument>(
      ctx,
      "primary",
      CollectionName.Config,
    ),
    E.tryMapPromise({
      try: (collection) => collection.findOne(filter),
      catch: (cause) =>
        new DatabaseError({ cause, message: "findMaintenanceWindow" }),
    }),
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
  CollectionNotFoundError | DatabaseError | DocumentNotFoundError
> {
  const filter: StrictFilter<ConfigDocument> = { _type: "maintenance" };

  return pipe(
    checkCollectionExists<ConfigDocument>(
      ctx,
      "primary",
      CollectionName.Config,
    ),
    E.tryMapPromise({
      try: (collection) =>
        collection.updateOne(filter, {
          $unset: { window: "" },
        }),
      catch: (cause) =>
        new DatabaseError({ cause, message: "deleteMaintenanceWindow" }),
    }),
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
