# Production image for apps/api (NestJS on Fastify)
# Build from the monorepo root: docker build -f infra/docker/api.Dockerfile -t parallel-api .

FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS deps
WORKDIR /repo
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages ./packages
RUN pnpm install --frozen-lockfile --filter api...

FROM base AS build
WORKDIR /repo
COPY --from=deps /repo /repo
COPY apps/api apps/api
RUN pnpm --filter api prisma generate
RUN pnpm --filter api build

FROM base AS runner
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=build /repo/apps/api/dist apps/api/dist
COPY --from=build /repo/apps/api/node_modules apps/api/node_modules
COPY --from=build /repo/apps/api/prisma apps/api/prisma
COPY --from=build /repo/node_modules node_modules
EXPOSE 3001
CMD ["node", "apps/api/dist/main.js"]
