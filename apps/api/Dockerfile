# syntax=docker/dockerfile:1.4

FROM node:20-bookworm-slim AS base
WORKDIR /app

FROM base AS deps
COPY package.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/api/tsconfig.json apps/api/
COPY apps/api/tsconfig.build.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm install

FROM deps AS build
COPY . .
RUN npm run build --workspace=apps/api
RUN npm prune --omit=dev

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/src ./apps/api/src
COPY --from=build /app/tsconfig.base.json ./tsconfig.base.json

RUN mkdir -p apps/api/data

EXPOSE 3000
CMD ["node", "apps/api/dist/index.js"]
