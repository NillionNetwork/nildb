import { Effect as E, pipe } from "effect";
import type { StrictFilter, StrictUpdateFilter, UpdateOptions } from "mongodb";
import { type CollectionNotFoundError, DatabaseError } from "#/common/errors";
import { CollectionName, checkCollectionExists } from "#/common/mongo";
import type { AppBindings } from "#/env";
import type { MaintenanceStatusDocument } from "#/system/system.types";

/**
 * Maintenance state is managed as a singleton document in the config collection.
 * The document uses `_type: "maintenance"` as its unique identifier.
 *
 * State model:
 * - No document exists = maintenance is inactive
 * - Document exists with `active: true` = maintenance is active
 */
export function startMaintenance(
  ctx: AppBindings,
): E.Effect<void, CollectionNotFoundError | DatabaseError> {
  // Filter targets the singleton maintenance state document
  const filter: StrictFilter<MaintenanceStatusDocument> = {
    _type: "maintenance",
  };
  const update: StrictUpdateFilter<MaintenanceStatusDocument> = {
    $set: {
      _type: "maintenance",
      active: true,
      startedAt: new Date(),
    },
  };
  const options: UpdateOptions = { upsert: true };

  return pipe(
    checkCollectionExists<MaintenanceStatusDocument>(
      ctx,
      "primary",
      CollectionName.Config,
    ),
    E.tryMapPromise({
      // updateOne with upsert ensures exactly one maintenance document exists
      try: (collection) => collection.updateOne(filter, update, options),
      catch: (cause) =>
        new DatabaseError({ cause, message: "startMaintenance" }),
    }),
    E.as(void 0),
  );
}

export function stopMaintenance(
  ctx: AppBindings,
): E.Effect<void, CollectionNotFoundError | DatabaseError> {
  // Filter targets the singleton maintenance state document
  const filter: StrictFilter<MaintenanceStatusDocument> = {
    _type: "maintenance",
  };

  return pipe(
    checkCollectionExists<MaintenanceStatusDocument>(
      ctx,
      "primary",
      CollectionName.Config,
    ),
    E.tryMapPromise({
      // Delete the singleton document to indicate maintenance is inactive
      try: (collection) => collection.deleteOne(filter),
      catch: (cause) =>
        new DatabaseError({ cause, message: "stopMaintenance" }),
    }),
    E.as(void 0),
  );
}

export function findMaintenanceConfig(
  ctx: AppBindings,
): E.Effect<
  MaintenanceStatusDocument | null,
  CollectionNotFoundError | DatabaseError
> {
  // Filter targets the singleton maintenance state document
  const filter: StrictFilter<MaintenanceStatusDocument> = {
    _type: "maintenance",
  };

  return pipe(
    checkCollectionExists<MaintenanceStatusDocument>(
      ctx,
      "primary",
      CollectionName.Config,
    ),
    E.tryMapPromise({
      // findOne returns the singleton document or null if inactive
      try: (collection) => collection.findOne(filter),
      catch: (cause) =>
        new DatabaseError({ cause, message: "findMaintenanceConfig" }),
    }),
  );
}
