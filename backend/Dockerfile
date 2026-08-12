FROM node:24-bookworm-slim AS base

WORKDIR /app

RUN apt-get update \
    && apt-get install --yes --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*


FROM base AS dependencies

COPY package.json package-lock.json ./

RUN npm ci


FROM dependencies AS build

# Prisma reads DATABASE_URL while loading prisma.config.ts. Client generation does
# not connect to this address, so a non-secret placeholder is sufficient here.
ENV DATABASE_URL=postgresql://docker_build:docker_build@localhost:5432/docker_build

COPY prisma.config.ts tsconfig.json ./
COPY prisma ./prisma
COPY src ./src

RUN npm run prisma:generate
RUN npm run build


FROM base AS production-dependencies

COPY package.json package-lock.json ./

RUN npm ci --omit=dev && npm cache clean --force


FROM base AS runtime

ENV NODE_ENV=production

COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

EXPOSE 5000

USER node

CMD ["node", "dist/server.js"]
