import type { ObjectId } from "mongodb";
import type { Did } from "#/common/types";

/**
 * Domain types for system configuration and node management.
 *
 * These types define the structure for system-level operations including
 * maintenance mode control, node information, and configuration management.
 */

/**
 * Base document structure for system configuration entries.
 *
 * Provides common fields for all system configuration documents
 * stored in the database.
 */
export type BaseConfigDocument = {
  /** Unique identifier for the configuration document */
  _id: ObjectId;
  /** Timestamp when the document was created */
  _created: Date;
  /** Timestamp when the document was last updated */
  _updated: Date;
  /** Type discriminator for configuration document variants */
  _type: string;
};

/**
 * Document structure for maintenance mode status tracking.
 *
 * Extends the base configuration document to store the current
 * maintenance mode state and activation timestamp.
 */
export type MaintenanceStatusDocument = BaseConfigDocument & {
  /** Type discriminator for maintenance status documents */
  _type: "maintenance";
  /** Whether maintenance mode is currently active */
  active: boolean;
  /** Timestamp when maintenance mode was last activated */
  startedAt: Date;
};

/**
 * Comprehensive node information structure.
 *
 * Contains all essential information about a NilDB node including
 * runtime status, build details, identity, and operational state.
 */
export type AboutNode = {
  /** Timestamp when the node was started */
  started: Date;
  /** Build and version information */
  build: BuildInfo;
  /** Node's decentralized identifier */
  did: Did;
  /** Node's public key for cryptographic operations */
  publicKey: string;
  /** Public URL endpoint for the node */
  url: string;
  /** Current maintenance mode information */
  maintenance: MaintenanceInfo;
};

/**
 * Maintenance mode status information.
 *
 * Tracks the current state of maintenance mode for operational
 * awareness and client communication.
 */
export type MaintenanceInfo = {
  /** Whether maintenance mode is currently active */
  active: boolean;
  /** Timestamp when maintenance mode was last activated */
  startedAt: Date;
};

/**
 * Node build and version information.
 *
 * Contains metadata about the node's software build including
 * version, commit hash, and build timestamp for debugging
 * and compatibility purposes.
 */
export type BuildInfo = {
  /** ISO timestamp when the build was created */
  time: string;
  /** Git commit hash for the build */
  commit: string;
  /** Semantic version string for the build */
  version: string;
};

/**
 * Domain command types for system operations.
 *
 * These types represent business operations that can be performed
 * on the system, converted from DTOs at the boundary layer.
 */

/**
 * Command for setting the node's log level.
 *
 * Encapsulates the request to change the logging verbosity
 * for the node's runtime operations.
 */
export type SetLogLevelCommand = {
  /** The new log level to set */
  level: "trace" | "debug" | "info" | "warn" | "error" | "fatal";
};

/**
 * Command for starting maintenance mode.
 *
 * Initiates maintenance mode to signal that the node
 * should not accept new requests.
 */
export type StartMaintenanceCommand = Record<string, never>;

/**
 * Command for stopping maintenance mode.
 *
 * Deactivates maintenance mode to resume normal node operations.
 */
export type StopMaintenanceCommand = Record<string, never>;
