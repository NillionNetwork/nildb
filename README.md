# Nil Db

## Prerequisites

- nodejs => 23.0
- pnpm
- docker

## Set up development environment 

1. `git clone git@github.com:NillionNetwork/nil-db.git`
2. `cd nil-db`
3. `pnpm install`
4. `pnpm install-hooks # optional but helps avoid trivial github action failures`
5. `cp .env.example .env`

## Running tests

- `pnpm test`

### Notes

- Tests use the `test` database
- The `test` database is dropped at the start of a test run (so that it can be inspected at the end of a test suite).

## Run the api

- `docker run -d -p 27017:27017 mongo:8`
- `pnpm start`

## Example usage

This section provides a high level flow to help orientate yourself as a Nillion Admin. You will need to refer to the openapi specification for request payloads and a list of all available methods.


### Gaining access as the root user/admin 

1. The system does not create a root user automatically, so you will need to do this manually. If you want to do local development outside of tests, the easiest approach is to run the test suite and then copy the root record from `test.users` to `datablocks.users`.
2. Get an auth JWT: `POST http://localhost:8080/api/v1/auth/login`.
3. Attach the JWT to future _root/admin user_ requests as: `Authorization: Bearer {JWT}`.

### Setting an organization 

1. Create the org: `POST http://localhost:8080/api/v1/orgs`
2. Add a data schema to the org: `POST http://localhost:8080/api/v1/data/orgs/schemas`
3. Add a query (aka mongo aggregation pipeline) to the org: `POST http://localhost:8080/api/v1/data/orgs/queries`
4. Generate a backend api key for the org: `POST http://localhost:8080/api/v1/orgs/keys/generate`

The org is now setup. Provide them with the API key to attach to all requests as `Authorization: Bearer {JWT}`.

### How the org uploads data and runs queries

1. Upload data: `POST http://localhost:8080/api/v1/data/upload`
2. Run a query: `POST http://localhost:8080/api/v1/data/query`
