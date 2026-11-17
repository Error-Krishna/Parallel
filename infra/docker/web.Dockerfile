# Production image for apps/web (Next.js)
# Build from the monorepo root: docker build -f infra/docker/web.Dockerfile -t parallel-web .

FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS deps
WORKDIR /repo
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages ./packages
RUN pnpm install --frozen-lockfile --filter web...

FROM base AS build
WORKDIR /repo
COPY --from=deps /repo /repo
COPY apps/web apps/web
RUN pnpm --filter @parallel/shared-types build \
  && pnpm --filter @parallel/api-client build \
  && pnpm --filter @parallel/ui build
RUN pnpm --filter web build

FROM base AS runner
WORKDIR /repo/apps/web
ENV NODE_ENV=production
COPY --from=build /repo/package.json /repo/pnpm-workspace.yaml /repo/
COPY --from=build /repo/node_modules /repo/node_modules
COPY --from=build /repo/packages /repo/packages
COPY --from=build /repo/apps/web/public ./public
COPY --from=build /repo/apps/web/.next ./.next
COPY --from=build /repo/apps/web/node_modules ./node_modules
COPY --from=build /repo/apps/web/package.json ./package.json
EXPOSE 3000
CMD ["pnpm", "start"]
