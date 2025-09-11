import { Effect as E, Exit } from "effect";
import { UUID } from "mongodb";
import { describe, expect, it, type Mock, vi } from "vitest";
import * as CollectionsService from "#/collections/collections.services";
import type { CollectionDocument } from "#/collections/collections.types";
import { buildAccessControlledFilter } from "#/common/acl";

// Mock the entire collections service module
vi.mock("#/collections/collections.services");

describe("buildAccessControlledFilter", () => {
  const collectionId = new UUID();
  const builderOwnerDid = "did:nil:zowner";
  const requestingBuilderDid = "did:nil:zrequester";
  const otherBuilderDid = "did:nil:zother";

  describe("for a standard collection", () => {
    const mockStandardCollection: CollectionDocument = {
      _id: collectionId,
      name: "test-standard",
      type: "standard",
      owner: builderOwnerDid,
      schema: {},
      _created: new Date(),
      _updated: new Date(),
    };

    it("should return the original filter when the requester is the owner", () => {
      (CollectionsService.find as Mock).mockReturnValue(
        E.succeed(mockStandardCollection),
      );

      const originalFilter = { a: 1 };
      const result = E.runSync(
        buildAccessControlledFilter(
          {} as any,
          builderOwnerDid,
          collectionId,
          "read",
          originalFilter,
        ),
      );

      expect(result).toEqual(originalFilter);
    });

    it("should fail with ResourceAccessDeniedError if the requester is not the owner", () => {
      (CollectionsService.find as Mock).mockReturnValue(
        E.succeed(mockStandardCollection),
      );

      const exit = E.runSyncExit(
        buildAccessControlledFilter(
          {} as any,
          otherBuilderDid,
          collectionId,
          "read",
          {},
        ),
      );

      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const tag: string = (exit.cause as any).error._tag;
        expect(tag).toEqual("ResourceAccessDeniedError");
      }
    });
  });

  describe("for an owned collection", () => {
    const mockOwnedCollection: CollectionDocument = {
      _id: collectionId,
      name: "test-owned",
      type: "owned",
      owner: builderOwnerDid,
      schema: {},
      _created: new Date(),
      _updated: new Date(),
    };

    it("should return only the ACL filter if the original filter is empty", () => {
      (CollectionsService.find as Mock).mockReturnValue(
        E.succeed(mockOwnedCollection),
      );

      const result = E.runSync(
        buildAccessControlledFilter(
          {} as any,
          requestingBuilderDid,
          collectionId,
          "read",
          {},
        ),
      );

      expect(result).toEqual({
        _acl: {
          $elemMatch: {
            grantee: requestingBuilderDid,
            read: true,
          },
        },
      });
    });

    it("should combine the original filter and ACL filter with $and", () => {
      (CollectionsService.find as Mock).mockReturnValue(
        E.succeed(mockOwnedCollection),
      );

      const originalFilter = { "data.field": "value" };
      const result = E.runSync(
        buildAccessControlledFilter(
          {} as any,
          requestingBuilderDid,
          collectionId,
          "write",
          originalFilter,
        ),
      );

      expect(result).toEqual({
        $and: [
          originalFilter,
          {
            _acl: {
              $elemMatch: {
                grantee: requestingBuilderDid,
                write: true,
              },
            },
          },
        ],
      });
    });

    it("should combine the original filter and ACL filter for 'execute'", () => {
      (CollectionsService.find as Mock).mockReturnValue(
        E.succeed(mockOwnedCollection),
      );

      const originalFilter = { "data.field": "value" };
      const result = E.runSync(
        buildAccessControlledFilter(
          {} as any,
          requestingBuilderDid,
          collectionId,
          "execute",
          originalFilter,
        ),
      );

      expect(result).toEqual({
        $and: [
          originalFilter,
          {
            _acl: {
              $elemMatch: {
                grantee: requestingBuilderDid,
                execute: true,
              },
            },
          },
        ],
      });
    });
  });
});
