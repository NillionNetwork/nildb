import { Effect as E, pipe } from "effect";
import {
  type OrgDocument,
  OrgDocumentModel,
  type OrgQuery,
} from "#/models/orgs";

export function removeOrgQueryRecord(
  orgId: string,
  queryName: string,
): E.Effect<OrgDocument, Error> {
  return pipe(
    E.tryPromise(() =>
      OrgDocumentModel.findOneAndUpdate(
        { _id: orgId },
        { $unset: { [`queries.${queryName}`]: "" } },
      ),
    ),
    E.flatMap((doc) =>
      doc === null
        ? E.fail(
            new Error(`Failed to remove orgs/${orgId}/queries/${queryName}`),
          )
        : E.succeed(doc as OrgDocument),
    ),
    E.mapError(
      (cause) =>
        new Error(`Failed to remove orgs/${orgId}/queries/${queryName}`, {
          cause,
        }),
    ),
  );
}

export function addOrgQueryRecord(
  orgId: string,
  queryName: string,
  pipeline: string,
  schema: string,
): E.Effect<OrgDocument, Error> {
  return pipe(
    E.tryPromise<OrgDocument | null>(() =>
      OrgDocumentModel.findOneAndUpdate(
        { _id: orgId },
        {
          $set: {
            [`queries.${queryName}`]: {
              pipeline,
              schema,
            },
          },
        },
      ),
    ),
    E.flatMap(E.fromNullable),
    E.mapError(
      (cause) =>
        new Error(`Failed to add orgs/${orgId}/queries/${queryName}`, {
          cause,
        }),
    ),
  );
}

export function listOrgQueries(
  orgId: string,
): E.Effect<Map<string, OrgQuery>, Error> {
  return pipe(
    E.tryPromise<OrgDocument | null>(() =>
      OrgDocumentModel.findOne({ _id: orgId }),
    ),
    E.flatMap(E.fromNullable),
    E.mapError((cause) => new Error(`Failed to find orgs/${orgId}`, { cause })),
    E.map((record) => record.queries),
  );
}
