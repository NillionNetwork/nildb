import type { ControllerOptions } from "#/common/types";
import * as OpenAiController from "./openai.controllers";

export function buildOpenAiRouter(options: ControllerOptions): void {
  OpenAiController.getOpenApiJson(options);
  OpenAiController.getProfile(options);

  OpenAiController.listSchemas(options);
  OpenAiController.createSchema(options);
  OpenAiController.removeSchema(options);
  OpenAiController.metadataSchema(options);

  OpenAiController.listQueries(options);
  OpenAiController.createQuery(options);
  OpenAiController.removeQuery(options);
  OpenAiController.executeQuery(options);

  OpenAiController.tailData(options);
  OpenAiController.uploadData(options);
  OpenAiController.readData(options);
  OpenAiController.removeData(options);
}
