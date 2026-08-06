# syntax=docker/dockerfile:1
# Build context: this docker folder.  App source arrives as the `src` context
# (../backend) so no Docker files have to live inside the app folders.

# ---- build: install all deps, generate the Prisma client, compile TS ----
FROM node:22-alpine AS build
WORKDIR /app

COPY --from=src package.json package-lock.json ./
RUN npm ci

# prisma.config.ts + schema are needed before `prisma generate`
COPY --from=src prisma.config.ts tsconfig.json ./
COPY --from=src prisma ./prisma
RUN npx prisma generate

COPY --from=src src ./src
RUN npm run build

# ---- runtime ----
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# node_modules carries the generated Prisma client and the prisma CLI,
# which the entrypoint uses for `migrate deploy`.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=src package.json package-lock.json ./
COPY --from=src prisma.config.ts ./
COPY --from=src prisma ./prisma

COPY --chmod=755 docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

# node:alpine ships a `node` user (uid 1000)
USER node

EXPOSE 5000
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
