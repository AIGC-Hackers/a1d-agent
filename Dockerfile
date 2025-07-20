# Multi-stage build for Node.js application with pnpm
FROM node:latest AS base

# Install curl for health checks and enable pnpm
RUN apt-get update && apt-get install -y curl && \
    corepack enable && \
    corepack prepare pnpm@latest --activate && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

FROM base AS deps
# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install all dependencies (including dev) to avoid preinstall script errors
RUN pnpm fetch --frozen-lockfile && \
    pnpm install --frozen-lockfile

FROM base AS build
# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install all dependencies (including dev) for building
RUN pnpm fetch --frozen-lockfile && \
    pnpm install --frozen-lockfile

# Copy source code and build
COPY . .
RUN chmod +x scripts/build.sh && ./scripts/build.sh

# Production stage - use distroless or slim image
FROM node:latest AS production

# Install only runtime dependencies
RUN apt-get update && apt-get install -y curl tini && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Create non-root user
RUN groupadd -g 1001 nodejs && \
    useradd -m -u 1001 -g nodejs nodejs

# Copy dependencies from deps stage and built application from build stage
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nodejs:nodejs /app/.mastra/output ./output
COPY --from=build --chown=nodejs:nodejs /app/.mastra/playground ./playground
COPY --from=build --chown=nodejs:nodejs /app/.env.production ./.env.production
COPY --chown=nodejs:nodejs package.json pnpm-lock.yaml ./

ENV PATH="/app/node_modules/.bin:$PATH"

# Switch to non-root user
USER nodejs

# Expose application port
EXPOSE 4111

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:4111/health || exit 1

# Use tini for proper signal handling
ENTRYPOINT ["/usr/bin/tini", "--"]

# Start application
CMD ["dotenvx", "run", "--env-file=.env.production", "--", "node", "--import=./output/instrumentation.mjs", "./output/index.mjs"]