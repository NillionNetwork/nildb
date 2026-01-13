# Contributing

This guide explains how to set up your development environment and contribute code to nilDB.

## Prerequisites

- Node.js >= 24
- pnpm >= 10
- Docker

## Development Setup

1. Clone the repository:

   ```shell
   git clone git@github.com:NillionNetwork/nildb.git
   cd nildb
   ```

2. Install dependencies and configure the environment:
   ```shell
   just init
   cp .env.example .env
   ```

## Development Server

```shell
just dev  # runs nilDB with tsx
```

> [!NOTE]
> Database migrations run automatically when the node starts

## Code quality

The following commands are run from the root of the repository. Run these checks before submitting your PR:

```shell
just check  # format, lint, and type check
just test   # run the full test suite
```

> [!NOTE]
>
> - Tests use isolated collections (test_nildb and test_nildb_data)
> - The test database is dropped at the start of each test run

## Contributing workflow

1. Fork the repository
2. Open an issue to discuss proposed changes
3. Create a branch (`git switch -c <user>/amazing-feature`)
4. Implement your changes
5. Ensure all checks pass
6. Commit with conventional commits (feat:, fix:, etc.)
7. Push to your fork
8. Submit a pull request
