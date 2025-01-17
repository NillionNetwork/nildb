import { Effect as E, pipe } from "effect";
import type { RequestHandler } from "express";
import type { EmptyObject, JsonArray, JsonValue } from "type-fest";
import { z } from "zod";
import { type ApiResponse, foldToApiResponse } from "#/common/handler";
import type { DocumentBase } from "#/common/mongo";
import { NilDid } from "#/common/nil-did";
import { Uuid, type UuidDto } from "#/common/types";
import { parseUserData } from "#/common/zod-utils";
import { MAX_RECORDS_LENGTH } from "#/data/controllers";
import type { UpdateResult, UploadResult } from "#/data/repository";
import { DataService } from "#/data/service";
import { PUBLIC_KEY_LENGTH } from "#/env";
import { QueriesService } from "#/queries/service";
import { SchemasService } from "#/schemas/service";
import type { AccountDocument } from "./repository";
import { AdminService } from "./services";

export const CreateAdminAccountRequest = z.object({
  did: NilDid,
  publicKey: z.string().length(PUBLIC_KEY_LENGTH),
  name: z.string(),
});
export type CreateAdminAccountRequest = z.infer<
  typeof CreateAdminAccountRequest
>;
export type CreateAdminAccountResponse = ApiResponse<UuidDto>;

const createAdminAccount: RequestHandler<
  EmptyObject,
  CreateAdminAccountResponse,
  CreateAdminAccountRequest
> = async (req, res) => {
  const { ctx, body } = req;

  await pipe(
    parseUserData<CreateAdminAccountRequest>(() =>
      CreateAdminAccountRequest.parse(body),
    ),
    E.flatMap((payload) => AdminService.createAdminAccount(ctx, payload)),
    E.map((id) => id.toString() as UuidDto),
    foldToApiResponse(req, res),
    E.runPromise,
  );
};

export type ListAccountsResponse = ApiResponse<AccountDocument[]>;

const listAccounts: RequestHandler<EmptyObject, ListAccountsResponse> = async (
  req,
  res,
) => {
  const { ctx } = req;

  await pipe(
    AdminService.listAllAccounts(ctx),
    foldToApiResponse(req, res),
    E.runPromise,
  );
};

export type RemoveAccountRequestParams = { accountDid: NilDid };
export type RemoveAccountResponse = ApiResponse<NilDid>;

const removeAccount: RequestHandler<
  RemoveAccountRequestParams,
  RemoveAccountResponse
> = async (req, res) => {
  const { ctx, body } = req;

  await pipe(
    parseUserData<NilDid>(() => NilDid.parse(body)),
    E.flatMap((id) => {
      return AdminService.removeAccount(ctx, id);
    }),
    foldToApiResponse(req, res),
    E.runPromise,
  );
};

export const DeleteDataRequest = z.object({
  schema: Uuid,
  filter: z
    .record(z.string(), z.unknown())
    .refine((obj) => Object.keys(obj).length > 0, {
      message: "Filter cannot be empty",
    }),
});
export type DeleteDataRequest = z.infer<typeof DeleteDataRequest>;
export type DeleteDataResponse = ApiResponse<number>;

const deleteData: RequestHandler<
  EmptyObject,
  DeleteDataResponse,
  DeleteDataRequest
> = async (req, res) => {
  const { ctx, body } = req;

  await pipe(
    parseUserData<DeleteDataRequest>(() => DeleteDataRequest.parse(body)),
    E.flatMap((payload) => DataService.deleteRecords(ctx, payload)),
    foldToApiResponse(req, res),
    E.runPromise,
  );
};

export const FlushDataRequest = z.object({
  schema: Uuid,
});
export type FlushDataRequest = z.infer<typeof FlushDataRequest>;
export type FlushDataResponse = ApiResponse<number>;

const flushData: RequestHandler<
  EmptyObject,
  FlushDataResponse,
  FlushDataRequest
> = async (req, res) => {
  const { ctx, body } = req;

  await pipe(
    parseUserData<FlushDataRequest>(() => TailDataRequest.parse(body)),
    E.flatMap((payload) => DataService.flushCollection(ctx, payload.schema)),
    foldToApiResponse(req, res),
    E.runPromise,
  );
};

export const ReadDataRequest = z.object({
  schema: Uuid,
  filter: z.record(z.string(), z.unknown()),
});
export type ReadDataRequest = z.infer<typeof ReadDataRequest>;
export type ReadDataResponse = ApiResponse<DocumentBase[]>;

const readData: RequestHandler<
  EmptyObject,
  ReadDataResponse,
  ReadDataRequest
> = async (req, res) => {
  const { ctx, body } = req;

  await pipe(
    parseUserData<ReadDataRequest>(() => ReadDataRequest.parse(body)),
    E.flatMap((payload) => DataService.readRecords(ctx, payload)),
    foldToApiResponse(req, res),
    E.runPromise,
  );
};

export const TailDataRequest = z.object({
  schema: Uuid,
});
export type TailDataRequest = z.infer<typeof TailDataRequest>;
export type TailDataResponse = ApiResponse<JsonArray>;

const tailData: RequestHandler<
  EmptyObject,
  TailDataResponse,
  TailDataRequest
> = async (req, res) => {
  const { ctx, body } = req;

  await pipe(
    parseUserData<TailDataRequest>(() => TailDataRequest.parse(body)),
    E.flatMap((payload) => DataService.tailData(ctx, payload.schema)),
    foldToApiResponse(req, res),
    E.runPromise,
  );
};

export const UploadDataRequest = z.object({
  schema: Uuid,
  data: z
    .array(z.record(z.string(), z.unknown()))
    .refine(
      (elements) =>
        elements.length > 0 && elements.length <= MAX_RECORDS_LENGTH,
      { message: `Length must be non zero and lte ${MAX_RECORDS_LENGTH}` },
    ),
});
export type UploadDataRequest = z.infer<typeof UploadDataRequest>;
export type PartialDataDocumentDto = UploadDataRequest["data"] & {
  _id: UuidDto;
};
export type UploadDataResponse = ApiResponse<UploadResult>;

const uploadData: RequestHandler<
  EmptyObject,
  UploadDataResponse,
  UploadDataRequest
> = async (req, res) => {
  const { ctx, body } = req;

  await pipe(
    parseUserData<UploadDataRequest>(() => UploadDataRequest.parse(body)),
    E.flatMap((payload) => {
      return DataService.createRecords(ctx, payload.schema, payload.data);
    }),
    foldToApiResponse(req, res),
    E.runPromise,
  );
};

export const UpdateDataRequest = z.object({
  schema: Uuid,
  filter: z.record(z.string(), z.unknown()),
  update: z.record(z.string(), z.unknown()),
});
export type UpdateDataRequest = z.infer<typeof UpdateDataRequest>;
export type UpdateDataResponse = ApiResponse<UpdateResult>;

const updateData: RequestHandler<
  EmptyObject,
  UpdateDataResponse,
  UpdateDataRequest
> = async (req, res) => {
  const { ctx, body } = req;

  await pipe(
    parseUserData<UpdateDataRequest>(() => UpdateDataRequest.parse(body)),
    E.flatMap((body) => {
      return DataService.updateRecords(ctx, body);
    }),
    foldToApiResponse(req, res),
    E.runPromise,
  );
};

const VariablePrimitive = z.enum(["string", "number", "boolean", "date"]);
export const QueryVariableValidator = z.union([
  z.object({
    type: VariablePrimitive,
    description: z.string(),
  }),
  z.object({
    type: z.enum(["array"]),
    description: z.string(),
    items: z.object({
      type: VariablePrimitive,
    }),
  }),
]);
export const AddQueryRequest = z.object({
  _id: Uuid,
  owner: NilDid,
  name: z.string(),
  schema: Uuid,
  variables: z.record(z.string(), QueryVariableValidator),
  pipeline: z.array(z.record(z.string(), z.unknown())),
});
export type AddQueryRequest = z.infer<typeof AddQueryRequest>;
export type AddQueryResponse = ApiResponse<UuidDto>;

const addQuery: RequestHandler<
  EmptyObject,
  AddQueryResponse,
  AddQueryRequest
> = async (req, res) => {
  const { ctx, body } = req;

  await pipe(
    parseUserData<AddQueryRequest>(() => AddQueryRequest.parse(body)),
    E.flatMap((payload) => QueriesService.addQuery(ctx, payload)),
    foldToApiResponse(req, res),
    E.runPromise,
  );
};

export const DeleteQueryRequest = z.object({
  id: Uuid,
});
export type DeleteQueryRequest = z.infer<typeof DeleteQueryRequest>;
export type DeleteQueryResponse = ApiResponse<boolean>;

const deleteQuery: RequestHandler<
  EmptyObject,
  DeleteQueryResponse,
  DeleteQueryRequest
> = async (req, res) => {
  const { ctx, body } = req;

  await pipe(
    parseUserData<DeleteQueryRequest>(() => DeleteQueryRequest.parse(body)),
    E.flatMap((payload) => {
      return QueriesService.removeQuery(ctx, payload.id);
    }),
    foldToApiResponse(req, res),
    E.runPromise,
  );
};

export const ExecuteQueryRequest = z.object({
  id: Uuid,
  variables: z.record(z.string(), z.unknown()),
});
export type ExecuteQueryRequest = z.infer<typeof ExecuteQueryRequest>;
export type ExecuteQueryResponse = ApiResponse<JsonValue>;

const executeQuery: RequestHandler<
  EmptyObject,
  ExecuteQueryResponse,
  ExecuteQueryRequest
> = async (req, res) => {
  const { ctx, body } = req;

  await pipe(
    parseUserData<ExecuteQueryRequest>(() => ExecuteQueryRequest.parse(body)),
    E.flatMap((payload) => {
      return QueriesService.executeQuery(ctx, payload);
    }),
    foldToApiResponse(req, res),
    E.runPromise,
  );
};

export const AddSchemaRequest = z.object({
  _id: Uuid,
  owner: NilDid,
  name: z.string().min(1),
  keys: z.array(z.string()),
  schema: z.record(z.string(), z.unknown()),
});
export type AddSchemaRequest = z.infer<typeof AddSchemaRequest>;
export type AddSchemaResponse = ApiResponse<UuidDto>;

const addSchema: RequestHandler<
  EmptyObject,
  AddSchemaResponse,
  AddSchemaRequest
> = async (req, res) => {
  const { ctx, body } = req;

  await pipe(
    parseUserData<AddSchemaRequest>(() => AddSchemaRequest.parse(body)),
    E.flatMap((payload) => SchemasService.addSchema(ctx, payload)),
    foldToApiResponse(req, res),
    E.runPromise,
  );
};

export const DeleteSchemaRequest = z.object({
  id: Uuid,
});
export type DeleteSchemaRequest = z.infer<typeof DeleteSchemaRequest>;
export type DeleteSchemaResponse = ApiResponse<UuidDto>;

const deleteSchema: RequestHandler<
  EmptyObject,
  DeleteSchemaResponse,
  DeleteSchemaRequest
> = async (req, res) => {
  const { ctx, body } = req;

  await pipe(
    parseUserData<DeleteSchemaRequest>(() => DeleteSchemaRequest.parse(body)),
    E.flatMap((payload) => SchemasService.deleteSchema(ctx, payload.id)),
    foldToApiResponse(req, res),
    E.runPromise,
  );
};

export const AdminController = {
  createAdminAccount,
  listAccounts,
  removeAccount,
  deleteData,
  flushData,
  readData,
  tailData,
  uploadData,
  updateData,

  addQuery,
  deleteQuery,
  executeQuery,

  addSchema,
  deleteSchema,
};
