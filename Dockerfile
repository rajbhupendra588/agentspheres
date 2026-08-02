# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY tsconfig.base.json ./
COPY packages ./packages
COPY services ./services
COPY agents ./agents
COPY apps ./apps
COPY db ./db
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY db ./db
RUN pnpm -r run build

FROM base AS runtime
ENV NODE_ENV=production
ENV AS_MIGRATIONS_DIR=/app/db/migrations
COPY --from=build /app /app
RUN chown -R node:node /app
USER node

ARG SERVICE_PATH=services/gateway
ENV SERVICE_PATH=${SERVICE_PATH}
WORKDIR /app/${SERVICE_PATH}

# Prefer dist/index.js; console uses dist-server/server.js
CMD ["sh", "-c", "if [ -f dist/index.js ]; then node dist/index.js; elif [ -f dist-server/server.js ]; then node dist-server/server.js; else node dist/server.js; fi"]
