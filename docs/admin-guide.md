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
- [Authentication](#authentication)
- [Storage Retention](#storage-retention)

## Configuration

The following environment variables are require:

| Variable                 | Description                                               | Example                              |
|--------------------------|-----------------------------------------------------------|--------------------------------------|
| APP_DB_NAME_BASE         | Database name prefix                                      | nildb_data                           |
| APP_DB_URI               | MongoDB connection string                                 | mongodb://node-xxxx-db:27017         |
| APP_ENABLED_FEATURES     | Enable features                                           | openapi-spec,metrics,migrations,otel |
| APP_LOG_LEVEL            | Logging verbosity                                         | debug                                |
| APP_METRICS_PORT         | Prometheus metrics port                                   | 9091                                 |
| APP_NILAUTH_BASE_URL     | The nilauth service url for subscriptions and revocations | http://127.0.0.1:30921               |
| APP_NILAUTH_PUBLIC_KEY   | The nilauth service's secp256k1 public key                | [hex encoded secp256k1 public key]   |
| APP_NODE_PUBLIC_ENDPOINT | Public URL of node                                        | https://nildb-xxxx.domain.com        |
| APP_NODE_SECRET_KEY      | Node's private key                                        | [hex encoded secp256k1 private key]  |
| APP_PORT                 | API service port                                          | 8080                                 |

### Rate Limiting

The following variables control the IP-based rate limiting feature.

| Variable                        | Description                                     | Default |
|---------------------------------|-------------------------------------------------|---------|
| APP_RATE_LIMIT_ENABLED          | Enables the rate-limiting feature.              | `true`  |
| APP_RATE_LIMIT_WINDOW_SECONDS   | The duration of the time window in seconds.     | `60`    |
| APP_RATE_LIMIT_MAX_REQUESTS     | Max requests per IP within the time window.     | `60`    |


### OpenTelemetry

When the `otel` feature is enabled in `APP_ENABLED_FEATURES`, the following variables configure OpenTelemetry instrumentation:

| Variable                        | Description                             | Default          | Required |
|---------------------------------|-----------------------------------------|------------------|----------|
| OTEL_ENDPOINT                   | OTLP endpoint URL                       | http://localhost | No       |
| OTEL_SERVICE_NAME               | Service name for telemetry              | nildb            | No       |
| OTEL_TEAM_NAME                  | Team responsible for the service        | nildb            | No       |
| OTEL_DEPLOYMENT_ENV             | Deployment environment                  | local            | No       |
| OTEL_METRICS_EXPORT_INTERVAL_MS | Metrics export interval in milliseconds | 60000            | No       |
| OTEL_RESOURCE_ATTRIBUTES        | Additional resource attributes          | (not set)        | No       |
| OTEL_SDK_DISABLED               | Disable OpenTelemetry SDK               | (not set)        | No       |

**Setting Custom Resource Attributes:**

You can set or override any OpenTelemetry resource attributes using `OTEL_RESOURCE_ATTRIBUTES`:

```bash
# Set single attribute
OTEL_RESOURCE_ATTRIBUTES=service.instance.id=nildb-r5nw

# Set multiple attributes (comma-separated)
OTEL_RESOURCE_ATTRIBUTES=service.instance.id=nildb-r5nw,custom.key=value
```

Values set via `OTEL_RESOURCE_ATTRIBUTES` take precedence over programmatically set values. This is useful for setting deployment-specific identifiers like `service.instance.id` without modifying code.

**Feature Flag Behavior:**

- **`metrics` only**: Metrics are served on `:9091/metrics` endpoint using OpenTelemetry PrometheusExporter. No traces or logs sent to OTLP.
- **`otel` only**: Metrics, traces, and logs are pushed to OTLP endpoint. No `/metrics` endpoint is exposed.

> ![NOTE]
> The `metrics` and `otel` feature flags are **mutually exclusive**. Enabling both will cause the server to exit with an error. Choose one observability mode.

**Disabling OpenTelemetry SDK:**

To disable OpenTelemetry SDK and prevent telemetry emission while keeping the `otel` feature flag enabled, set the following environment variable:
```bash
OTEL_SDK_DISABLED=true
```

This is useful for local development where you want to use Pino stdout logging instead of sending telemetry to an OTLP endpoint.

## Start the node

### Local Development

For local development and testing, use the pre-configured stack in the `local/` directory:

```shell
# Start the complete local development stack
docker compose -f local/docker-compose.yaml up -d
```

This stack includes:
- **nilDB**: The main API service (port 40080, metrics port 40091)
- **MongoDB**: Database backend (port 40017)
- **nilauth**: Authentication service for NUC tokens (port 40921)
- **nilchain**: Local blockchain for testing payments (JSON-RPC port 40648)
- **PostgreSQL**: Database for nilauth (port 40432)
- **token-price-api**: Mock token pricing service (port 40923)
- **otel-collector**: OpenTelemetry collector with debug exporter (OTLP port 40318)

The nilDB API will be available at `http://localhost:40080`.

The local stack is configured with `APP_ENABLED_FEATURES=openapi,otel,migrations`, which means:
- Metrics, traces, and logs are sent to the OTel Collector (visible in `docker compose logs otel-collector`)
- No `/metrics` endpoint is exposed (OTLP push only)

To switch to metrics-only mode (serve metrics on `:40091/metrics`), change `otel` to `metrics` in the docker-compose.yaml file.

### Production Deployment

A nilDB node consists of a MongoDB instance and a RESTful API service. Below is a basic Docker Compose configuration:

```yaml
# docker-compose.yaml
services:
  node-xxxx-api:
    image: public.ecr.aws/k5d9x2g2/nildb-api:latest # commit sha or semver
    ports:
      - "8080:8080"
    depends_on:
      - node-ucct-db
    environment:
      - APP_DB_NAME_BASE=nildb
      - APP_DB_URI=mongodb://node-xxxx-db:27017
      - APP_ENABLED_FEATURES=openapi-spec,metrics,migrations
      - APP_LOG_LEVEL=debug
      - APP_METRICS_PORT=9091
      - APP_NILAUTH_BASE_URL=http://127.0.0.1:30921
      - APP_NILAUTH_PUBLIC_KEY=037a87f9b010687e23eccb2fc70a474cbb612418cb513a62289eaed6cf1f11ac6b
      - APP_NODE_PUBLIC_ENDPOINT=https://nildb-xxxx.domain.com
      - APP_NODE_SECRET_KEY=6cab2d10ac21886404eca7cbd40f1777071a243177eae464042885b391412b4e
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
- `GET :9091/metrics` - Prometheus metrics (internal access only, available when `metrics` feature flag is enabled without `otel`)

> ![NOTE]
> The `/metrics` endpoint behavior depends on feature flags:
> - **`metrics` only**: Serves metrics at `:9091/metrics` using OpenTelemetry PrometheusExporter
> - **`otel` enabled**: No `/metrics` endpoint; all telemetry pushed to OTLP collector
>
> The `/metrics` endpoint should never be exposed publicly - use firewall rules or network policies to restrict access to internal monitoring systems only.

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

1. Modify your image tag (e.g. `public.ecr.aws/k5d9x2g2/nildb-api:0.5.0` -> `public.ecr.aws/k5d9x2g2/nildb-api:0.6.0`)
2. Run `docker compose -f ./docker-compose.yaml up -d`

## Database migrations

- The node runs migrations automatically on startup and records migrations in the table: `APP_DB_NAME_DATA/migrations_changelog`.
- Ensure the user defined in `APP_DB_URI` has access to run migrations.
- Inspect migration status, or run them manually, using `tsx bin/migrate.ts --help`

## Authentication

nilDB uses NUC (Nillion UCANs) tokens for authentication instead of traditional JWTs. The following flow is done transparently by the `@nillion/nuc` library:

1. **Payment**: Users must first pay for a subscription on nilchain
2. **Verification**: Submit the transaction hash to the nilauth service
3. **Token Request**: After verification, request a root access token from nilauth
4. **API Access**: Use the NUC token in the Authorization header: `Bearer <nuc-token>`

For local development, the `local/docker-compose.yaml` stack includes a pre-configured nilauth service with test credentials.

For user-facing operations, there is an OpenAPI documentation interface hosted at `${APP_NODE_PUBLIC_ENDPOINT}/api/v1/openapi/docs/`.

## Storage Retention

Configure MongoDB with the following backup/snapshot policy. This policy applies to both MongoDB Atlas and self-hosted MongoDB. Details specific to each are mentioned further below.

* Full hourly snapshots with 1-day retention
* Full daily snapshots with 7-day retention; configured snapshot time: 04:00 UTC

### MongoDB Atlas

Disable [Continuous Cloud Backups][continuous-backups]. Point-in-time recovery is not required, and additional costs are incurred by having it enabled.

### Self-Hosted

Users self-hosting MongoDB may implement the retention policy with periodic jobs that use [`mongodump`][mongodump].

[continuous-backups]: https://www.mongodb.com/docs/atlas/recover-pit-continuous-cloud-backup/
[mongodump]: https://www.mongodb.com/docs/database-tools/mongodump/
