import { UUID } from "mongodb";
import { Did } from "#/common/types";
import type { FindDataCommand, OwnedDocumentBase } from "#/data/data.types";
import type {
  DeleteDocumentRequestParams,
  GrantAccessToDataRequest,
  ListDataReferencesResponse,
  ReadDataAccessResponse,
  ReadDataAclRequestParams,
  ReadDataRequestParams,
  ReadDataResponse,
  ReadProfileResponse,
  RevokeAccessToDataRequest,
} from "./users.dto";
import type {
  Acl,
  DataDocumentReference,
  DeleteDataCommand,
  GrantAccessToDataCommand,
  ReadDataAclCommand,
  RevokeAccessToDataCommand,
  UserDocument,
} from "./users.types";

export const UserDataMapper = {
  toDeleteDataCommand(
    user: UserDocument,
    params: DeleteDocumentRequestParams,
  ): DeleteDataCommand {
    return {
      owner: Did.parse(user._id),
      collection: new UUID(params.collection),
      document: new UUID(params.document),
    };
  },

  toReadProfileResponse(user: UserDocument): ReadProfileResponse {
    return {
      data: {
        _id: user._id,
        _created: user._created.toISOString(),
        _updated: user._updated.toISOString(),
        // TODO: if op = "auth" then acl should be returned
        log: user.log.map((l) => ({ col: l.col.toString(), op: l.op })),
        data: user.data.map((d) => ({
          collection: d.collection.toString(),
          id: d.document.toString(),
        })),
      },
    };
  },

  /**
   *
   */
  toListDataReferencesResponse(
    references: DataDocumentReference[],
  ): ListDataReferencesResponse {
    return {
      data: references.map((r) => ({
        builder: r.builder,
        collection: r.collection.toString(),
        document: r.document.toString(),
      })),
    };
  },

  /**
   *
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
   *
   */
  toReadDataAclCommand(
    user: UserDocument,
    dto: ReadDataAclRequestParams,
  ): ReadDataAclCommand {
    return {
      owner: user._id,
      collection: new UUID(dto.collection),
      document: new UUID(dto.document),
    };
  },

  /**
   *
   */
  toGrantDataAccessCommand(
    user: UserDocument,
    body: GrantAccessToDataRequest,
  ): GrantAccessToDataCommand {
    return {
      collection: new UUID(body.collection),
      document: new UUID(body.document),
      owner: user._id,
      acl: {
        grantee: body.acl.grantee,
        read: body.acl.read,
        write: body.acl.write,
        execute: body.acl.execute,
      },
    };
  },

  /**
   *
   */
  toRevokeDataAccessCommand(
    user: UserDocument,
    body: RevokeAccessToDataRequest,
  ): RevokeAccessToDataCommand {
    return {
      collection: new UUID(body.collection),
      document: new UUID(body.document),
      grantee: body.builder,
      owner: user._id as Did,
    };
  },

  /**
   *
   */
  toFindDataCommand(
    user: UserDocument,
    body: ReadDataRequestParams,
  ): FindDataCommand {
    return {
      collection: new UUID(body.collection),
      filter: {
        _id: new UUID(body.document),
        _owner: user._id,
      },
    };
  },

  toReadDataResponse(documents: OwnedDocumentBase[]): ReadDataResponse {
    return {
      data: documents.map((d) => ({
        ...d,
        _id: d._id.toString(),
        _created: d._created.toISOString(),
        _updated: d._updated.toISOString(),
      })),
    };
  },
} as const;
