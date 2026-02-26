# Building on nilDB

This section outlines specific builder-related tasks and is deliberately utilitarian.

## Documentation

An OpenAPI documentation site is available at `{APP_NODE_PUBLIC_ENDPOINT}/openapi.json` when the node is running and the `openapi` feature is enabled.

## Running nilDB Locally

### Quick Start

Start the complete local development network:

```shell
docker compose -f local/docker-compose.yaml up -d
```

This starts a single nilDB node along with all required supporting services:

- **nilDB API**: http://localhost:40080
- **MongoDB**: localhost:40017
- **nilauth**: http://localhost:40921 (authentication service)
- **nilchain**: http://localhost:40648 (local blockchain)
- **PostgreSQL**: localhost:40432 (nilauth database)
- **Token Price API**: http://localhost:40923 (mock pricing)

> [!CAUTION]
> The keys and credentials in `local/docker-compose.yaml` are for development purposes only and must not be used in production.

### Verify the Stack

```shell
# Check nilDB health
curl http://localhost:40080/health

# View node information
curl http://localhost:40080/about | jq
```

### Monitor Logs

```shell
docker compose -f local/docker-compose.yaml logs -f
```

### Stop the Stack

```shell
docker compose -f local/docker-compose.yaml down -v
```

> [!WARNING]
> The `-v` flag removes all volumes, including any data stored in MongoDB.

### Building from Source

Alternatively, you can build and run nilDB from source by following the instructions in [CONTRIBUTING.md](../CONTRIBUTING.md).
