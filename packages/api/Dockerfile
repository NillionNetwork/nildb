# 1. Install all dependencies
FROM node:24-alpine@sha256:50c8e8ca1d27439048670df5883f32d57cf81cff6233222c893fd0d9884cbd81 AS builder
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
FROM node:24-alpine@sha256:50c8e8ca1d27439048670df5883f32d57cf81cff6233222c893fd0d9884cbd81
# No corepack here: the runtime only runs `node dist/main.mjs`, and enabling it
# leaves a package manager that will fetch and execute code on first use.
WORKDIR /app
COPY --from=builder /app .

USER node
EXPOSE 8080
ENV NODE_ENV=production
CMD [ "node", "--enable-source-maps", "dist/main.mjs" ]
