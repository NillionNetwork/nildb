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
    pnpm exec biome format --fix

# Fix code issues (format + lint + type check)
fix:
    pnpm exec biome check --fix --unsafe
    tsc

# Run linter and type checker (CI mode)
check:
    pnpm exec biome ci
    tsc

# Start the application
start:
    pnpm exec tsx src/main.ts

# Run all tests
test:
    just test-unit
    just test-integration

# Run unit tests
test-unit:
    #!/usr/bin/env bash
    pnpm exec vitest --run tests/01-unit

# Run integration tests
test-integration:
    #!/usr/bin/env bash
    pnpm exec vitest --run tests/02-integration

# Run tests with coverage
test-coverage:
    #!/usr/bin/env bash
    pnpm exec vitest --coverage

# Run database migrations
migrate:
    pnpm exec tsx bin/migrate.ts

# Build info for Docker
create-buildinfo:
    #!/usr/bin/env bash
    VERSION=$(cat package.json | jq -r .version)
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
