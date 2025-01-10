import { Effect as E, pipe } from "effect";
import type { RequestHandler } from "express";
import type { EmptyObject, JsonArray } from "type-fest";
import { z } from "zod";
import { type ApiResponse, foldToApiResponse } from "#/common/handler";
import type { DocumentBase } from "#/common/mongo";
import { Uuid, type UuidDto } from "#/common/types";
import { parseUserData } from "#/common/zod-utils";
import { DataService } from "#/data/service";
import { isRoleAllowed } from "#/middleware/auth";
import type { CreatedResult, UpdateResult } from "./repository";

export const MAX_RECORDS_LENGTH = 10_000;

export const CreateDataRequest = z.object({
  schema: Uuid,
  data: z
    .array(z.record(z.string(), z.unknown()))
    .refine(
      (elements) =>
        elements.length > 0 && elements.length <= MAX_RECORDS_LENGTH,
      { message: `Length must be non zero and lte ${MAX_RECORDS_LENGTH}` },
    ),
});
export type CreateDataRequest = z.infer<typeof CreateDataRequest>;
export type PartialDataDocumentDto = CreateDataRequest["data"] & {
  _id: UuidDto;
};
export type CreateDataResponse = ApiResponse<CreatedResult>;

const createData: RequestHandler<
  EmptyObject,
  CreateDataResponse,
  CreateDataRequest
> = async (req, res) => {
  const { ctx, body, account } = req;

  if (!isRoleAllowed(req, ["organization"])) {
    res.sendStatus(401);
    return;
  }

  await pipe(
    parseUserData<CreateDataRequest>(() => CreateDataRequest.parse(body)),
    E.flatMap((payload) => {
      return DataService.createRecords(
        ctx,
        account._id,
        payload.schema,
        payload.data,
      );
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

  if (!isRoleAllowed(req, ["organization"])) {
    res.sendStatus(401);
    return;
  }

  await pipe(
    parseUserData<UpdateDataRequest>(() => UpdateDataRequest.parse(body)),
    E.flatMap((body) => {
      return DataService.updateRecords(ctx, body);
    }),
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
  if (!isRoleAllowed(req, ["organization"])) {
    res.sendStatus(401);
    return;
  }

  await pipe(
    parseUserData<ReadDataRequest>(() => ReadDataRequest.parse(body)),
    E.flatMap((payload) => DataService.readRecords(ctx, payload)),
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

  if (!isRoleAllowed(req, ["organization"])) {
    res.sendStatus(401);
    return;
  }

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

  if (!isRoleAllowed(req, ["organization"])) {
    res.sendStatus(401);
    return;
  }

  await pipe(
    parseUserData<FlushDataRequest>(() => TailDataRequest.parse(body)),
    E.flatMap((payload) => DataService.flushCollection(ctx, payload.schema)),
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

  if (!isRoleAllowed(req, ["organization"])) {
    res.sendStatus(401);
    return;
  }

  await pipe(
    parseUserData<TailDataRequest>(() => TailDataRequest.parse(body)),
    E.flatMap((payload) => DataService.tailData(ctx, payload.schema)),
    foldToApiResponse(req, res),
    E.runPromise,
  );
};

export const DataController = {
  createData,
  deleteData,
  flushData,
  readData,
  tailData,
  updateData,
};
