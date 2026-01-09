import { type CollectionNotFoundError, DatabaseError } from "@nildb/common/errors";
import { CollectionName, checkCollectionExists } from "@nildb/common/mongo";
import type { AppBindings } from "@nildb/env";
import type { MaintenanceStatusDocument } from "@nildb/system/system.types";
import { Effect as E, pipe } from "effect";
import type { StrictFilter, StrictUpdateFilter, UpdateOptions } from "mongodb";

/**
 * Start maintenance mode.
 */
export function startMaintenance(ctx: AppBindings): E.Effect<void, CollectionNotFoundError | DatabaseError> {
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
    checkCollectionExists<MaintenanceStatusDocument>(ctx, "primary", CollectionName.Config),
    E.tryMapPromise({
      // updateOne with upsert ensures exactly one maintenance document exists
      try: (collection) => collection.updateOne(filter, update, options),
      catch: (cause) => new DatabaseError({ cause, message: "startMaintenance" }),
    }),
    E.as(void 0),
  );
}

/**
 * Stop maintenance mode.
 */
export function stopMaintenance(ctx: AppBindings): E.Effect<void, CollectionNotFoundError | DatabaseError> {
  // Filter targets the singleton maintenance state document
  const filter: StrictFilter<MaintenanceStatusDocument> = {
    _type: "maintenance",
  };

  return pipe(
    checkCollectionExists<MaintenanceStatusDocument>(ctx, "primary", CollectionName.Config),
    E.tryMapPromise({
      // Delete the singleton document to indicate maintenance is inactive
      try: (collection) => collection.deleteOne(filter),
      catch: (cause) => new DatabaseError({ cause, message: "stopMaintenance" }),
    }),
    E.as(void 0),
  );
}

/**
 * Find maintenance configuration.
 */
export function findMaintenanceConfig(
  ctx: AppBindings,
): E.Effect<MaintenanceStatusDocument | null, CollectionNotFoundError | DatabaseError> {
  // Filter targets the singleton maintenance state document
  const filter: StrictFilter<MaintenanceStatusDocument> = {
    _type: "maintenance",
  };

  return pipe(
    checkCollectionExists<MaintenanceStatusDocument>(ctx, "primary", CollectionName.Config),
    E.tryMapPromise({
      // findOne returns the singleton document or null if inactive
      try: (collection) => collection.findOne(filter),
      catch: (cause) => new DatabaseError({ cause, message: "findMaintenanceConfig" }),
    }),
  );
}
