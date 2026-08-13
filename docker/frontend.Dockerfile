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
COPY --from=src tsconfig.app.json tsconfig.node.json ./
COPY --from=src public ./public
COPY --from=src src ./src

# Not `npm run build`: that runs `tsc -b` over the root tsconfig, whose
# references include the tests project — and neither tests/ nor its config
# belong in a production image.  The two projects the bundle needs are named
# directly instead, so adding a fourth project can't break this build.
RUN npx tsc -b tsconfig.app.json tsconfig.node.json && npx vite build

# ---- serve via nginx ----
FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
