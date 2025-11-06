# 1. Install all dependencies
FROM node:24-alpine AS builder
RUN corepack enable pnpm
WORKDIR /build
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @nillion/nildb build
RUN pnpm deploy --prod --filter @nillion/nildb /app
COPY buildinfo.json /app/buildinfo.json

# 2. Final image
FROM node:24-alpine
RUN corepack enable pnpm
WORKDIR /app
COPY --from=builder /app .

USER node
EXPOSE 8080
ENV NODE_ENV=production
CMD [ "node", "--enable-source-maps", "dist/main.mjs" ]
