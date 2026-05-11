# Stage 1: Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY arduino-compiler/package.json ./arduino-compiler/
COPY arduino-compiler/pnpm-lock.yaml ./arduino-compiler/ || true

# Install pnpm
RUN npm install -g pnpm@10.30.1

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY src ./src
COPY prisma ./prisma
COPY tsconfig.json ./
COPY .github/copilot-instructions.md ./.github/ || true

# Generate Prisma client
RUN pnpm exec prisma generate --schema src/modules/prisma/schema.prisma

# Build TypeScript
RUN pnpm run build

# Stage 2: Runtime stage
FROM node:20-alpine

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init curl

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install pnpm
RUN npm install -g pnpm@10.30.1

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/modules/prisma ./src/modules/prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy public assets
COPY public ./public || true

# Copy scripts for data seeding
COPY src/scripts ./src/scripts || true
COPY src/config ./src/config || true

# Change ownership to nodejs user
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:${PORT:-5000}/api/v1/ || exit 1

# Expose port
EXPOSE ${PORT:-5000}

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "dist/src/server.js"]
