FROM node:24-alpine

RUN corepack enable pnpm
WORKDIR /app
COPY . .
RUN LEFTHOOK=0 pnpm install --frozen-lockfile --prod

USER node
EXPOSE 8080
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
ENTRYPOINT [ "pnpm", "exec", "tsx", "src/main.ts" ]
