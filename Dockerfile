# Build the static bundle, then serve it with nginx.
FROM node:24-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM nginx:alpine
# OCI metadata — `source` lets GHCR auto-link the package to the repo (and show its README).
LABEL org.opencontainers.image.title="OpenConsole" \
      org.opencontainers.image.description="A browser-only console for LocalStack, MinIO, and AWS" \
      org.opencontainers.image.url="https://jongsic.github.io/openconsole/" \
      org.opencontainers.image.source="https://github.com/Jongsic/openconsole" \
      org.opencontainers.image.licenses="Unlicense"
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
