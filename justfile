# Default recipe to display help
default:
    @just --list

# ------------------
# --- Installation
# ------------------

# Setup the repository (install dependencies and setup lefthook)
init:
    pnpm install
    lefthook install

# Install dependencies
install:
    pnpm install

# ------------------
# --- Quality
# ------------------

# Build workspace dependencies (required for type checking and tests)
build-deps:
    pnpm --filter @nillion/nildb-types build
    pnpm --filter @nillion/nildb-shared build
    pnpm --filter @nillion/nildb-client build

# Check for formatting, lint, and type errors
check: build-deps
    pnpm exec tsc -b && pnpm exec biome ci && pnpm exec tsc -b --noEmit

# Format, fix, and type check all files
fix:
    pnpm exec biome check --fix --unsafe && pnpm exec tsc -b

# Format all files
fmt:
    pnpm exec biome format --write .

# ------------------
# --- Application
# ------------------

# Run the application using tsx
dev:
    pnpm --filter @nillion/nildb dev

# Build nildb
build: build-deps
    pnpm --filter @nillion/nildb build

# ------------------
# --- Testing
# ------------------

# Run all tests (unit & integration)
test: build-deps
    pnpm exec vitest run

# Run unit tests
test-unit: build-deps
    pnpm exec vitest run --project=unit

# Run integration tests
test-integration: build-deps
    pnpm exec vitest run --project=integration

# Run tests with coverage
test-coverage: build-deps
    pnpm exec vitest run --coverage

# ------------------
# --- Docker Services
# ------------------

# Start local dev infrastructure (mongo, postgres, anvil, nilauth, otel)
docker-up:
    cd local && docker compose up -d

# Stop local dev infrastructure
docker-down:
    cd local && docker compose down

# View docker logs
docker-logs:
    cd local && docker compose logs -f

# ------------------
# --- Build & Docker
# ------------------

# Create build info aretefact for Docker
create-buildinfo:
    #!/usr/bin/env bash
    VERSION=$(cat packages/api/package.json | jq -r .version)
    cat << EOF > buildinfo.json
    {
      "time": "$(date -u +'%Y-%m-%dT%H:%M:%SZ')",
      "commit": "$(git rev-parse HEAD)",
      "version": "${VERSION}"
    }
    EOF

# Build local Docker image
docker-build-local: create-buildinfo
    docker buildx build \
      --tag public.ecr.aws/k5d9x2g2/nildb-api:local \
      --file ./packages/api/Dockerfile \
      .

# ------------------
# --- Cleanup
# ------------------

# Clean build artifacts
clean:
    rm -f buildinfo.json
    rm -rf node_modules
    rm -rf coverage
