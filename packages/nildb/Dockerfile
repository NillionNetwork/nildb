# 1. Install all dependencies
FROM node:24-alpine AS builder
RUN corepack enable pnpm
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile

# 2. Create production deployment for the nildb package
FROM builder AS deploy
WORKDIR /app
RUN pnpm deploy --prod --filter @nillion/nildb /prod/app

# 3. Final, clean image with only production files
FROM node:24-alpine
RUN corepack enable pnpm
WORKDIR /app
COPY --from=deploy /prod/app .

USER node
EXPOSE 8080
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
ENTRYPOINT [ "pnpm", "exec", "tsx", "src/main.ts" ]
