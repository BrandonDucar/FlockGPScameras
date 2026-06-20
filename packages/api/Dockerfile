# ─── Build Stage ──────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
RUN npm install -g pnpm
ENV PNPM_MINIMUM_RELEASE_AGE=0

WORKDIR /app

# Copy lockfile and configs
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json .npmrc ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json ./packages/db/
COPY packages/api/package.json ./packages/api/

# Install dependencies
RUN pnpm install --frozen-lockfile --config.minimum-release-age=0

# Copy source code
COPY packages/shared ./packages/shared
COPY packages/db ./packages/db
COPY packages/api ./packages/api

# Build shared and Prisma client
RUN pnpm --filter @flockgps/shared build
RUN pnpm --filter @flockgps/db prisma generate
RUN pnpm --filter @flockgps/api build

# ─── Runner Stage ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
RUN npm install -g pnpm

WORKDIR /app

COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=builder /app/packages/shared/package.json /app/packages/shared/dist ./packages/shared/dist/
COPY --from=builder /app/packages/db/package.json /app/packages/db/prisma ./packages/db/prisma/
COPY --from=builder /app/packages/api/package.json /app/packages/api/dist ./packages/api/dist/

# Production install
RUN pnpm install --prod --frozen-lockfile

EXPOSE 3001
ENV NODE_ENV=production

CMD ["pnpm", "--filter", "@flockgps/api", "start"]
