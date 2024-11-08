import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { jwt } from "hono/jwt";
import type { MongoClient } from "mongodb";
import type { Mongoose } from "mongoose";
import type { BaseLogger } from "pino";
import { handleAddQuery } from "#/handlers/handle-add-query";
import { handleAddSchema } from "#/handlers/handle-add-schema";
import { handleCreateOrg } from "#/handlers/handle-create-org";
import { handleCreateUser } from "#/handlers/handle-create-user";
import { handleDeleteOrg } from "#/handlers/handle-delete-org";
import { handleDeleteQuery } from "#/handlers/handle-delete-query";
import { handleDeleteSchema } from "#/handlers/handle-delete-schema";
import { handleDeleteUser } from "#/handlers/handle-delete-user";
import { handleGenerateApiKey } from "#/handlers/handle-generate-api-key";
import { handleHealthCheck } from "#/handlers/handle-health-check";
import { handleListOrgs } from "#/handlers/handle-list-orgs";
import { handleListSchemas } from "#/handlers/handle-list-schemas";
import { handleOpenApi } from "#/handlers/handle-openapi";
import { handleRunQuery } from "#/handlers/handle-run-query";
import { handleUploadData } from "#/handlers/handle-upload-data";
import { handleUserLogin } from "#/handlers/handle-user-login";
import { handleListQueries } from "./handlers/handle-list-queries";
import { logging } from "./logging";

export type Bindings = {
  name: string;
  webPort: number;
  dbUri: string;
  jwtSecret: string;
  logLevel: string;
};

export type Variables = {
  db: {
    mongo: MongoClient;
    mongoose: Mongoose;
  };
  log: BaseLogger;
};

export type AppEnv = {
  Bindings: Bindings;
  Variables: Variables;
};

export function buildApp(
  bindings: Bindings,
  variables: Variables,
): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.use("*", async (c, next) => {
    c.env = bindings;
    c.set("db", variables.db);
    c.set("log", variables.log);
    await next();
  });

  app.use(logging());

  app.use("/api/*", cors());

  handleHealthCheck(app, "/health");
  handleOpenApi(app, "/openapi");
  handleUserLogin(app, "/api/v1/auth/login");

  app.use("*", jwt({ secret: bindings.jwtSecret }));

  handleCreateUser(app, "/api/v1/users");
  handleDeleteUser(app, "/api/v1/users");
  handleRunQuery(app, "/api/v1/data/query");
  handleUploadData(app, "/api/v1/data/upload");
  handleAddQuery(app, "/api/v1/orgs/queries");
  handleAddSchema(app, "/api/v1/orgs/schemas");
  handleCreateOrg(app, "/api/v1/orgs");
  handleDeleteOrg(app, "/api/v1/orgs");
  handleDeleteQuery(app, "/api/v1/orgs/queries");
  handleDeleteSchema(app, "/api/v1/orgs/schemas");
  handleGenerateApiKey(app, "/api/v1/orgs/keys/generate");
  handleListSchemas(app, "/api/v1/orgs/schemas");
  handleListQueries(app, "/api/v1/orgs/queries");
  handleListOrgs(app, "/api/v1/orgs");

  app.onError((err, c) => {
    const { log } = c.var;
    if (err instanceof HTTPException) {
      log.error(err.message);
      return err.getResponse();
    }

    log.error(err);
    return c.text("Internal Server Error", 500);
  });

  return app;
}
