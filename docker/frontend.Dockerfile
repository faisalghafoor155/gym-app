# syntax=docker/dockerfile:1
# Build context: this docker folder.  App source arrives as the `src` context
# (../frontend) so no Docker files have to live inside the app folders.

# ---- build the static bundle ----
FROM node:22-alpine AS build
WORKDIR /app

COPY --from=src package.json package-lock.json ./
RUN npm ci

# Copied explicitly rather than `COPY --from=src . .` so the host's
# node_modules never enters the image and no .dockerignore has to be
# added to the app folder.
COPY --from=src index.html vite.config.ts ./
COPY --from=src tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY --from=src public ./public
COPY --from=src src ./src

RUN npm run build

# ---- serve via nginx ----
FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
