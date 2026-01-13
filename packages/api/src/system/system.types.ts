import type { ObjectId } from "mongodb";

/**
 * Base configuration document.
 */
export type BaseConfigDocument = {
  _id: ObjectId;
  _created: Date;
  _updated: Date;
  _type: string;
};

/**
 * Maintenance status document.
 */
export type MaintenanceStatusDocument = BaseConfigDocument & {
  _type: "maintenance";
  active: boolean;
  startedAt: Date;
};

/**
 * Node information.
 */
export type AboutNode = {
  started: Date;
  build: BuildInfo;
  publicKey: string;
  url: string;
  maintenance: MaintenanceInfo;
};

/**
 * Maintenance status info.
 */
export type MaintenanceInfo = {
  active: boolean;
  startedAt: Date;
};

/**
 * Build information.
 */
export type BuildInfo = {
  time: string;
  commit: string;
  version: string;
};

/**
 * Set log level command.
 */
export type SetLogLevelCommand = {
  level: "debug" | "info" | "warn" | "error";
};

/**
 * Start maintenance command.
 */
export type StartMaintenanceCommand = Record<string, never>;

/**
 * Stop maintenance command.
 */
export type StopMaintenanceCommand = Record<string, never>;
