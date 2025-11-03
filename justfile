# Default recipe to display help
default:
    @just --list

# Install dependencies
install:
    pnpm install

# Install git hooks
install-hooks:
    lefthook install

# Format code
fmt:
    pnpm fmt

# Fix code issues (format + lint + type check)
fix:
    pnpm fix

# Run linter and type checker (CI mode)
check:
    pnpm check

# Start the application
start:
    pnpm start

# Run all tests
test:
    pnpm test

# Run unit tests
test-unit:
    pnpm test:unit

# Run integration tests
test-integration:
    pnpm test:integration

# Run tests with coverage
test-coverage:
    pnpm --filter @nillion/nildb exec vitest --coverage

# Run database migrations
migrate:
    pnpm migrate

# Build info for Docker
create-buildinfo:
    #!/usr/bin/env bash
    VERSION=$(cat packages/nildb/package.json | jq -r .version)
    cat << EOF > buildinfo.json
    {
      "time": "$(date -u +'%Y-%m-%dT%H:%M:%SZ')",
      "commit": "$(git rev-parse HEAD)",
      "version": "${VERSION}"
    }
    EOF

# Docker: Build image for specific architecture
docker-build-local:
    docker buildx build \
      --tag public.ecr.aws/k5d9x2g2/nildb-api:local \
      --file ./Dockerfile \
      .

# Clean build artifacts
clean:
    rm -f buildinfo.json
    rm -rf node_modules
    rm -rf coverage
