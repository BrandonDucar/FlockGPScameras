# ─── Build Stage ──────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
RUN npm install -g pnpm
ENV PNPM_MINIMUM_RELEASE_AGE=0

WORKDIR /app

# Copy lockfile and configs
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json .npmrc ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/

# Install dependencies
RUN pnpm install --frozen-lockfile --config.minimum-release-age=0

# Copy source code
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

# Build Svelte Web App
ARG VITE_MAPBOX_TOKEN=""
ENV VITE_MAPBOX_TOKEN=$VITE_MAPBOX_TOKEN
ENV VITE_API_URL="http://localhost:3001/api"
RUN pnpm --filter @flockgps/shared build
RUN pnpm --filter web build

# ─── Runner Stage ─────────────────────────────────────────────────────────────
FROM nginx:alpine

COPY --from=builder /app/apps/web/build /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
