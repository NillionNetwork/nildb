import type { OwnedDocumentBase, ReadDataCommand, StandardDocumentBase } from "@nildb/data/data.types";
import { UUID } from "mongodb";
import type { Logger } from "pino";

import { normalizeIdentifier } from "@nillion/nildb-shared";
import type {
  DeleteDocumentRequestParams,
  GrantAccessToDataRequest,
  ListDataReferencesResponse,
  Paginated,
  ReadDataAccessResponse,
  ReadDataAclRequestParams,
  ReadDataRequestParams,
  ReadDataResponse,
  ReadUserProfileResponse,
  RevokeAccessToDataRequest,
  UpdateUserDataRequest,
  UserDataLogs,
} from "@nillion/nildb-types";

import type {
  Acl,
  DataDocumentReference,
  DeleteUserDataCommand,
  GrantAccessToDataCommand,
  ReadDataAclCommand,
  RevokeAccessToDataCommand,
  UpdateUserDataCommand,
  UserDocument,
} from "./users.types.js";

/**
 * User data mapper.
 */
export const UserDataMapper = {
  /**
   * Converts update data request DTO to domain command.
   */
  toUpdateDataCommand(dto: UpdateUserDataRequest): UpdateUserDataCommand {
    return {
      document: new UUID(dto.document),
      collection: new UUID(dto.collection),
      filter: {
        _id: new UUID(dto.document),
      },
      update: dto.update,
    };
  },

  /**
   * Convert delete params to command.
   */
  toDeleteDataCommand(user: UserDocument, params: DeleteDocumentRequestParams): DeleteUserDataCommand {
    return {
      owner: user.did,
      collection: new UUID(params.collection),
      document: new UUID(params.document),
      filter: {
        _id: new UUID(params.document),
      },
    };
  },

  /**
   * Convert user document to profile response.
   */
  toReadProfileResponse(user: UserDocument): ReadUserProfileResponse {
    return {
      data: {
        _id: user.did,
        _created: user._created.toISOString(),
        _updated: user._updated.toISOString(),
        logs: user.logs,
        data: user.data.map((d) => ({
          collection: d.collection.toString(),
          id: d.document.toString(),
        })),
      },
    };
  },

  /**
   * Converts a paginated result of data references into a paginated Api response.
   *
   * @param paginatedResult The paginated data from the service layer.
   * @returns The final Api response object for listing user data references.
   */
  toListDataReferencesResponse(paginatedResult: Paginated<DataDocumentReference>): ListDataReferencesResponse {
    return {
      data: paginatedResult.data.map((r) => ({
        builder: r.builder,
        collection: r.collection.toString(),
        document: r.document.toString(),
      })),
      pagination: {
        total: paginatedResult.total,
        limit: paginatedResult.limit,
        offset: paginatedResult.offset,
      },
    };
  },

  /**
   * Convert ACLs to access response.
   */
  toReadDataAccessResponse(acls: Acl[]): ReadDataAccessResponse {
    return {
      data: acls.map((acl) => ({
        grantee: acl.grantee,
        read: acl.read,
        write: acl.write,
        execute: acl.execute,
      })),
    };
  },

  /**
   * Convert ACL params to command.
   */
  toReadDataAclCommand(user: UserDocument, dto: ReadDataAclRequestParams): ReadDataAclCommand {
    return {
      owner: user.did,
      collection: new UUID(dto.collection),
      document: new UUID(dto.document),
    };
  },

  /**
   * Convert grant request to command.
   */
  toGrantDataAccessCommand(user: UserDocument, body: GrantAccessToDataRequest, log: Logger): GrantAccessToDataCommand {
    return {
      collection: new UUID(body.collection),
      document: new UUID(body.document),
      owner: user.did,
      acl: {
        ...body.acl,
        grantee: normalizeIdentifier(body.acl.grantee, log),
      },
    };
  },

  /**
   * Convert revoke request to command.
   */
  toRevokeDataAccessCommand(
    user: UserDocument,
    body: RevokeAccessToDataRequest,
    log: Logger,
  ): RevokeAccessToDataCommand {
    return {
      collection: new UUID(body.collection),
      document: new UUID(body.document),
      grantee: normalizeIdentifier(body.grantee, log),
      owner: user.did,
    };
  },

  /**
   * Convert read params to read command.
   */
  toReadDataCommand(user: UserDocument, body: ReadDataRequestParams): ReadDataCommand {
    return {
      document: new UUID(body.document),
      collection: new UUID(body.collection),
      filter: {
        _id: new UUID(body.document),
        _owner: user.did,
      },
    };
  },

  /**
   * Convert document to read response.
   */
  toReadDataResponse(document: OwnedDocumentBase): ReadDataResponse {
    return {
      data: {
        ...document,
        _id: document._id.toString(),
        _created: document._created.toISOString(),
        _updated: document._updated.toISOString(),
      },
    };
  },

  /**
   * Groups documents by their owner.
   * @param documents - Array of documents to group
   * @return Record where keys are owner IDs and values are arrays of document IDs
   */
  groupByOwner(documents: StandardDocumentBase[]): Record<string, UUID[]> {
    return documents.reduce<Record<string, UUID[]>>((acc, data) => {
      if ("_owner" in data) {
        const document = data as OwnedDocumentBase;
        const { _owner } = document;

        if (!acc[_owner]) {
          acc[_owner] = [];
        }

        acc[_owner].push(data._id);
      }

      return acc;
    }, {});
  },
} as const;

/**
 * Transforms data between HTTP DTOs and domain models for user log operations.
 *
 * Centralizes all data transformations to maintain clean layer boundaries.
 */
export const UserLoggerMapper = {
  toCreateDataLogs(collections: UUID[]): UserDataLogs[] {
    return collections.map(this.toCreateDataLog);
  },

  toCreateDataLog(collection: UUID): UserDataLogs {
    return { op: "create-data", collection: collection.toString() };
  },

  toDeleteDataLogs(documents: UUID[]): UserDataLogs[] {
    return documents.map(this.toDeleteDataLog);
  },

  toDeleteDataLog(collection: UUID): UserDataLogs {
    return { op: "delete-data", collection: collection.toString() };
  },

  toUpdateDataLogs(documents: UUID[]): UserDataLogs[] {
    return documents.map(this.toUpdateDataLog);
  },

  toUpdateDataLog(collection: UUID): UserDataLogs {
    return { op: "update-data", collection: collection.toString() };
  },

  toGrantAccessLogs(collections: UUID[], acl?: Acl): UserDataLogs[] {
    if (!acl) {
      return [];
    }
    return collections.map((d) => this.toGrantAccessLog(d, acl));
  },

  toGrantAccessLog(collection: UUID, acl: Acl): UserDataLogs {
    return {
      op: "grant-access",
      collection: collection.toString(),
      acl,
    };
  },

  toRevokeAccessLog(collection: UUID, grantee: string): UserDataLogs {
    return {
      op: "revoke-access",
      collection: collection.toString(),
      grantee,
    };
  },
} as const;
