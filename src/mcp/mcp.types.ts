import { Data } from "effect";

export class McpHandleRequestError extends Data.TaggedError(
  "McpHandleRequestError",
)<{
  sid: string;
  cause: unknown;
}> {}

export class CreateTransportError extends Data.TaggedError(
  "CreateTransportError",
)<{
  sid: string;
  cause: unknown;
}> {}

export class ConnectMcpServerError extends Data.TaggedError(
  "ConnectMcpServerError",
)<{
  sid: string;
  cause: unknown;
}> {}

export class TransportNotFoundError extends Data.TaggedError(
  "TransportNotFoundError",
)<{ sid: string }> {}
