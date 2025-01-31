# Admin guide

This section provides task-oriented instructions for node administrators.

## Contents

- [Configuration](#configuration)
- [Start the node](#start-the-node)
- [About your node](#about-your-node)
- [Logging](#logging)
- [Stop the node](#stop-the-node)
- [Upgrades](#upgrades)
- [Database migrations](#database-migrations)
- [The admin api](#the-admin-api)

## Configuration

The following environment variables are require:

| Variable                 | Description                 | Example                       |
|--------------------------|-----------------------------|-------------------------------|
| APP_DB_NAME_DATA         | Database name for node data | datablocks_data               |
| APP_DB_NAME_PRIMARY      | Primary database name       | datablocks                    |
| APP_DB_URI               | MongoDB connection string   | mongodb://node-xxxx-db:27017  |
| APP_ENV                  | Runtime environment         | testnet                       |
| APP_LOG_LEVEL            | Logging verbosity           | debug                         |
| APP_METRICS_PORT         | Prometheus metrics port     | 9091                          |
| APP_NODE_SECRET_KEY      | Node's private key          | [hex encoded private key]     |
| APP_NODE_PUBLIC_ENDPOINT | Public URL of node          | https://nildb-xxxx.domain.com |
| APP_PORT                 | API service port            | 8080                          |

## Start the node

A nilDB node consists of a MongoDB instance and a RESTful API service. Below is a basic Docker Compose configuration:

```yaml
# docker-compose.yaml
services:
  node-xxxx-api:
    image: <repo>/nildb-api:0.5.0 # or commit sha
    ports:
      - "8080:8080"
    depends_on:
      - node-ucct-db
    environment:
      - APP_DB_NAME_DATA=datablocks_data
      - APP_DB_NAME_PRIMARY=datablocks
      - APP_DB_URI=mongodb://node-xxxx-db:27017
      - APP_ENV=testnet
      - APP_LOG_LEVEL=debug
      - APP_METRICS_PORT=9091
      - APP_NODE_SECRET_KEY=6cab2d10ac21886404eca7cbd40f1777071a243177eae464042885b391412b4e
      - APP_NODE_PUBLIC_ENDPOINT=https://nildb-xxxx.domain.com
      - APP_PORT=8080

  node-xxxx-db:
    image: mongo:latest
    ports:
      - "37011:27017"
```

The node can then be started in the background with:

```shell
docker compose -f ./docker-compose.yaml up -d
```

## About your node

The following endpoints provide operational information:

- `GET /health` - Service health check
- `GET /about` - Node configuration
- `GET :9091/metrics` - Prometheus metrics (internal access only)

> ![INFO]
> `/metrics` shouldn't be exposed publicly. 

## Logging

Access logs with:

```shell
docker compose -f ./docker-compose.yaml logs -f
```

## Stop the node

Stop node with:

```shell
docker compose -f ./docker-compose.yaml stop
```

## Upgrades

1. Modify your image tag (e.g. `<repo>/nildb-api:0.5.0` -> `<repo>/nildb-api:0.6.0`)
2. Run `docker compose -f ./docker-compose.yaml up -d`

## Database migrations

- The node runs migrations automatically on startup and records migrations in the table: `APP_DB_NAME_DATA/migrations_changelog`.
- Ensure the user defined in `APP_DB_URI` has access to run migrations.
- Inspect migration status, or run them manually, using `tsx bin/migrate.ts --help`

## The admin api

Create admin credentials:

 ```shell
 tsx bin/credentials.ts 
 ```

Create a node root JWT:

 ```shell
 tsx bin/credentials.ts --secret-key ${APP_NODE_SECRET_KEY} --node-public-key ${APP_NODE_PUBLIC_KEY}
 ```

Use the root jwt to create the admin account:

 ```shell
 curl ${NODE_URL}/api/v1/admin/accounts \
   --header "Authorization: Bearer ${ROOT_JWT}" \
   --header "Content-type: application/json" \
   -d '{ "did": "${ADMIN_DID}", "publicKey": "${ADMIN_PK}" }'
 ```

Create a JWT for the admin account:

```shell
tsx bin/credentials.ts --secret-key ${ADMIN_SECRET_KEY} --node-public-key ${APP_NODE_PUBLIC_KEY}
```

All user-facing endpoints have an admin equivalent prefixed by `/api/v1/admin/*`. Inspect admin routes in the [src/admin/admin.router.ts](../src/admin/admin.router.ts). For user-facing operations, there is an openapi ui hosted at `${APP_NODE_PUBLIC_ENDPOINT}/api/v1/openapi/docs`.
