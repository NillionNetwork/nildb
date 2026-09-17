# 1. Install all dependencies
FROM node:26-alpine@sha256:2c45bdcbf63561a54da9549612084b43ca309854a4110c87857d609ddeb61c9e AS builder
RUN corepack enable pnpm
WORKDIR /build
COPY . .
RUN pnpm install --frozen-lockfile
# Build dependencies
RUN pnpm --filter @nillion/nildb-types build
RUN pnpm --filter @nillion/nildb-shared build
RUN pnpm --filter @nillion/nildb-client build
RUN pnpm --filter @nillion/nilpay-client build
# Build the api
RUN pnpm --filter @nillion/nildb build
RUN pnpm deploy --prod --filter @nillion/nildb /app
COPY buildinfo.json /app/buildinfo.json

# 2. Final image
FROM node:26-alpine@sha256:2c45bdcbf63561a54da9549612084b43ca309854a4110c87857d609ddeb61c9e
# No corepack here: the runtime only runs `node dist/main.mjs`, and enabling it
# leaves a package manager that will fetch and execute code on first use.
WORKDIR /app
COPY --from=builder /app .

USER 1000
EXPOSE 8080
ENV NODE_ENV=production
CMD [ "node", "--enable-source-maps", "dist/main.mjs" ]
