# Arduino Compiler Service Dockerfile
# Optimized for fast compilation with pre-warmed cache
FROM ubuntu:22.04

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install arduino-cli
RUN curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | sh && \
    mv bin/arduino-cli /usr/local/bin/

# Install Node.js 20
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs

# Enable pnpm via corepack
RUN corepack enable

# Create app directory and user early
RUN useradd -m -s /bin/bash arduino
WORKDIR /app

# Copy package files and install dependencies
COPY package.json ./
RUN pnpm install --no-frozen-lockfile

# Copy TypeScript config and source code
COPY tsconfig.json ./
COPY src/ ./src/

# Build TypeScript
RUN pnpm run build

# Switch to arduino user for Arduino CLI setup
USER arduino

# Initialize Arduino CLI and install cores as arduino user
RUN arduino-cli core update-index && \
    arduino-cli core install arduino:avr

# Pre-warm compilation cache with dummy sketches
RUN mkdir -p /tmp/warmup/warmup && \
    echo 'void setup() { Serial.begin(9600); } void loop() { delay(1000); }' > /tmp/warmup/warmup/warmup.ino && \
    arduino-cli compile --fqbn arduino:avr:uno /tmp/warmup/warmup --output-dir /tmp/warmup/uno && \
    arduino-cli compile --fqbn arduino:avr:mega /tmp/warmup/warmup --output-dir /tmp/warmup/mega && \
    rm -rf /tmp/warmup

# Switch back to root to finish setup
USER root

# Create uploads directory and set permissions
RUN mkdir -p /app/uploads && \
    chown -R arduino:arduino /app

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Switch to arduino user for runtime
USER arduino

# Start server
CMD ["pnpm", "start"]