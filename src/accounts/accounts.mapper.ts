import type { UUID } from "mongodb";
import type {
  GetProfileResponse,
  RegisterAccountRequest,
} from "#/accounts/accounts.dto";
import type { Did } from "#/common/types";

/**
 * Represents an organisation account document in the database.
 *
 * This type serves as the common data model across all layers,
 * maintaining consistency between service and repository operations.
 */
export type OrganizationAccountDocument = {
  _id: Did;
  _role: "organization";
  _created: Date;
  _updated: Date;
  name: string;
  schemas: UUID[];
  queries: UUID[];
};

/**
 * Transforms data between HTTP DTOs and domain models.
 *
 * Centralises all data transformations to maintain clean layer boundaries.
 * Higher layers (controllers) use these functions to convert DTOs to domain
 * models before passing them to lower layers (services).
 */
export const AccountDataMapper = {
  /**
   * Converts a registration request DTO to a complete account document.
   *
   * Initialises system fields (_created, _updated) and sets empty
   * collections for schemas and queries.
   *
   * @param data - Registration request containing DID and name
   * @returns Complete organisation account document
   */
  fromRegisterAccountRequest(
    data: RegisterAccountRequest,
  ): OrganizationAccountDocument {
    const now = new Date();

    return {
      _id: data.did,
      _role: "organization",
      _created: now,
      _updated: now,
      name: data.name,
      schemas: [],
      queries: [],
    };
  },

  /**
   * Creates a document copy with empty schema/query arrays.
   *
   * @deprecated This function appears to be unused and may be removed
   * @param data - Source document
   * @returns Document copy with empty arrays
   */
  toDocument(data: OrganizationAccountDocument): OrganizationAccountDocument {
    return {
      _id: data._id,
      _role: "organization",
      _created: data._created,
      _updated: data._updated,
      name: data.name,
      schemas: [],
      queries: [],
    };
  },

  /**
   * Identity function that returns the document unchanged.
   *
   * @deprecated Currently serves no transformation purpose
   * @param data - Source document
   * @returns Same document
   */
  fromDocument(data: OrganizationAccountDocument): OrganizationAccountDocument {
    return {
      _id: data._id,
      _role: "organization",
      _created: data._created,
      _updated: data._updated,
      name: data.name,
      schemas: data.schemas,
      queries: data.queries,
    };
  },

  /**
   * Converts a domain account document to an API response DTO.
   *
   * Transforms dates to ISO strings and UUIDs to strings for
   * JSON serialisation compatibility.
   *
   * @param data - Organisation account document from domain layer
   * @returns Profile response DTO for HTTP layer
   */
  toGetProfileResponse(data: OrganizationAccountDocument): GetProfileResponse {
    return {
      data: {
        _id: data._id,
        _created: data._created.toISOString(),
        _updated: data._updated.toISOString(),
        name: data.name,
        schemas: data.schemas.map((s) => s.toString()),
        queries: data.queries.map((q) => q.toString()),
      },
    };
  },
};
