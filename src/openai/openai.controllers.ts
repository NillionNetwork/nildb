import { Effect as E, pipe } from "effect";
import { z } from "zod";
import * as AccountService from "#/accounts/accounts.services";
import type { OrganizationAccountDocument } from "#/accounts/accounts.types";
import { handleTaggedErrors } from "#/common/handler";
import {
  enforceQueryOwnership,
  enforceSchemaOwnership,
} from "#/common/ownership";
import { PathsV1 } from "#/common/paths";
import { type ControllerOptions, Uuid } from "#/common/types";
import { paramsValidator, payloadValidator } from "#/common/zod-utils";
import * as DataService from "#/data/data.services";
import {
  DeleteDataRequestSchema,
  ReadDataRequestSchema,
  TailDataRequestSchema,
  UploadDataRequestSchema,
} from "#/data/data.types";
import { verifyNucAndLoadSubject } from "#/middleware/capability.middleware";
import * as QueriesService from "#/queries/queries.services";
import {
  AddQueryRequestSchema,
  DeleteQueryRequestSchema,
  ExecuteQueryRequestSchema,
} from "#/queries/queries.types";
import * as SchemasService from "#/schemas/schemas.services";
import {
  AddSchemaRequestSchema,
  DeleteSchemaRequestSchema,
} from "#/schemas/schemas.types";
import openApiJson from "./openapi.json";

export function getOpenApiJson(options: ControllerOptions): void {
  const { app } = options;
  app.get(PathsV1.openai.openApiJson, async (c) => {
    return c.json(openApiJson);
  });
}

// Start account api

export function getProfile(options: ControllerOptions): void {
  const { app, bindings } = options;

  app.get(
    PathsV1.openai.accounts.profile,
    verifyNucAndLoadSubject(bindings),
    async (c) => {
      const account = c.get("account");
      return pipe(
        AccountService.find(c.env, account._id),
        E.map((data) => c.json({ data })),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

// End account api

// Start schema api

export function listSchemas(options: ControllerOptions): void {
  const { app, bindings } = options;

  app.get(
    PathsV1.openai.schemas.list,
    verifyNucAndLoadSubject(bindings),
    async (c) => {
      const account = c.get("account") as OrganizationAccountDocument;

      return pipe(
        SchemasService.getOrganizationSchemas(c.env, account),
        E.map((data) => c.json({ data })),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

export function createSchema(options: ControllerOptions): void {
  const { app, bindings } = options;

  app.post(
    PathsV1.openai.schemas.create,
    payloadValidator(AddSchemaRequestSchema),
    verifyNucAndLoadSubject(bindings),
    async (c) => {
      const account = c.get("account") as OrganizationAccountDocument;
      const payload = c.req.valid("json");

      return pipe(
        SchemasService.addSchema(c.env, {
          ...payload,
          owner: account._id,
        }),
        E.map(() => c.json({ result: "Schema created" })),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

export function removeSchema(options: ControllerOptions): void {
  const { app, bindings } = options;

  app.post(
    PathsV1.openai.schemas.remove,
    payloadValidator(DeleteSchemaRequestSchema),
    verifyNucAndLoadSubject(bindings),
    async (c) => {
      const account = c.get("account") as OrganizationAccountDocument;
      const payload = c.req.valid("json");

      return pipe(
        enforceSchemaOwnership(account, payload.id),
        E.flatMap(() => SchemasService.deleteSchema(c.env, payload.id)),
        E.map(() => c.json({ result: "Schema deleted" })),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

export function metadataSchema(options: ControllerOptions): void {
  const { app, bindings } = options;

  app.get(
    PathsV1.openai.schemas.metadata,
    paramsValidator(
      z.object({
        id: Uuid,
      }),
    ),
    verifyNucAndLoadSubject(bindings),
    async (c) => {
      const account = c.get("account") as OrganizationAccountDocument;
      const payload = c.req.valid("param");

      return pipe(
        enforceSchemaOwnership(account, payload.id),
        E.flatMap(() => SchemasService.getSchemaMetadata(c.env, payload.id)),
        E.map((data) =>
          c.json({
            data,
          }),
        ),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

// End schema api

// Start queries api

export function listQueries(options: ControllerOptions): void {
  const { app, bindings } = options;

  app.get(
    PathsV1.openai.queries.list,
    verifyNucAndLoadSubject(bindings),
    async (c) => {
      const account = c.get("account") as OrganizationAccountDocument;

      return pipe(
        QueriesService.findQueries(c.env, account._id),
        E.map((data) => c.json({ data })),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

export function createQuery(options: ControllerOptions): void {
  const { app, bindings } = options;

  app.post(
    PathsV1.openai.queries.create,
    payloadValidator(AddQueryRequestSchema),
    verifyNucAndLoadSubject(bindings),
    async (c) => {
      const account = c.get("account") as OrganizationAccountDocument;
      const payload = c.req.valid("json");

      return pipe(
        QueriesService.addQuery(c.env, {
          ...payload,
          owner: account._id,
        }),
        E.map(() => c.json({ result: "Query created" })),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

export function removeQuery(options: ControllerOptions): void {
  const { app, bindings } = options;

  app.post(
    PathsV1.openai.queries.remove,
    payloadValidator(DeleteQueryRequestSchema),
    verifyNucAndLoadSubject(bindings),
    async (c) => {
      const account = c.get("account") as OrganizationAccountDocument;
      const payload = c.req.valid("json");

      return pipe(
        enforceQueryOwnership(account, payload.id),
        E.flatMap(() => QueriesService.removeQuery(c.env, payload.id)),
        E.map(() => c.json({ result: "Query removed" })),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

export function executeQuery(options: ControllerOptions): void {
  const { app, bindings } = options;

  app.post(
    PathsV1.openai.queries.execute,
    payloadValidator(ExecuteQueryRequestSchema),
    verifyNucAndLoadSubject(bindings),
    async (c) => {
      const account = c.get("account") as OrganizationAccountDocument;
      const payload = c.req.valid("json");

      return pipe(
        enforceQueryOwnership(account, payload.id),
        E.flatMap(() => QueriesService.executeQuery(c.env, payload)),
        E.map((data) => c.json({ data })),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

// End queries api

// Start data api

export function tailData(options: ControllerOptions): void {
  const { app, bindings } = options;

  app.post(
    PathsV1.openai.data.tail,
    payloadValidator(TailDataRequestSchema),
    verifyNucAndLoadSubject(bindings),
    async (c) => {
      const account = c.get("account") as OrganizationAccountDocument;
      const payload = c.req.valid("json");

      return pipe(
        enforceSchemaOwnership(account, payload.schema),
        E.flatMap(() => DataService.tailData(c.env, payload.schema)),
        E.map((data) => c.json({ data })),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

export function uploadData(options: ControllerOptions): void {
  const { app, bindings } = options;

  app.post(
    PathsV1.openai.data.upload,
    payloadValidator(UploadDataRequestSchema),
    verifyNucAndLoadSubject(bindings),
    async (c) => {
      const account = c.get("account") as OrganizationAccountDocument;
      const payload = c.req.valid("json");

      return pipe(
        enforceSchemaOwnership(account, payload.schema),
        E.flatMap(() =>
          DataService.createRecords(c.env, payload.schema, payload.data),
        ),
        E.map((data) =>
          c.json({
            data,
          }),
        ),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

export function readData(options: ControllerOptions): void {
  const { app, bindings } = options;

  app.post(
    PathsV1.openai.data.read,
    payloadValidator(ReadDataRequestSchema),
    verifyNucAndLoadSubject(bindings),
    async (c) => {
      const account = c.get("account") as OrganizationAccountDocument;
      const payload = c.req.valid("json");

      return pipe(
        enforceSchemaOwnership(account, payload.schema),
        E.flatMap(() => DataService.readRecords(c.env, payload)),
        E.map((data) => c.json({ data })),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

export function removeData(options: ControllerOptions): void {
  const { app, bindings } = options;

  app.post(
    PathsV1.openai.data.remove,
    payloadValidator(DeleteDataRequestSchema),
    verifyNucAndLoadSubject(bindings),
    async (c) => {
      const account = c.get("account") as OrganizationAccountDocument;
      const payload = c.req.valid("json");

      return pipe(
        enforceSchemaOwnership(account, payload.schema),
        E.flatMap(() => DataService.deleteRecords(c.env, payload)),
        E.map((data) => c.json({ data })),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

// End data api
