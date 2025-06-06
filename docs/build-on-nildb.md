# Building on nilDB

This section outlines specific builder-related tasks and is deliberately utilitarian.

## Documentation

An OpenAPI documentation site is available at [localhost:8080/api/v1/openapi/docs/]({APP_NODE_PUBLIC_ENDPOINT}/openapi.json) when the node is running.

> [!NOTE]
> Admin routes are not included in the OpenAPI documentation. For admin endpoints, refer to [/src/admin/routes.ts](../src/admin/admin.router.ts).

## Development Options

### Run a single nilDB node

For simple development tasks, you can run a single node. However, note that secret sharing features require multiple nodes. To run a single node:

- Follow the source build instructions in [CONTRIBUTING.md](../CONTRIBUTING.md), or
- Modify [docker-compose.local.yaml](../docker-compose.local.yaml) to run a single node

### Run a local development cluster

1. Build the image:
   ```shell
   docker buildx build -f Dockerfile -t local/nildb-api:latest . 
   ```

2. Start the cluster:
   ```shell
   docker compose -p nildb-local -f docker-compose.local.yaml up -d
   ```

   > [!CAUTION]
   > The three nodes in docker-compose.local.yaml are prepopulated with root and node secret keys. These keys are for development purposes only and must not be used in production.

3. Verify the nodes are running:
   ```shell
   curl -s localhost:9181/about | jq
   curl -s localhost:9182/about | jq
   curl -s localhost:9183/about | jq
   ```

4. Monitor cluster logs:
   ```shell
   docker compose -p nildb-local logs -f
   ```

5. Cleanup:
   ```shell
   docker compose -p nildb-local down -v --remove-orphans
   ```

   > [!WARNING]
   > This command removes all containers, volumes, and networks associated with the cluster.
