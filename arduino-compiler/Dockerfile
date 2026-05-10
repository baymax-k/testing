# ─── Arduino Compiler Service ─────────────────────────────────────────────────
# Uses node:20-bullseye (Debian) as base — Node.js pre-installed, stable.

FROM node:20-bullseye

# Install system dependencies + Arduino CLI
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Arduino CLI
RUN curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | BINDIR=/usr/local/bin sh

# Pin pnpm to v10
RUN npm install -g pnpm@10.30.1

# Create non-root user
RUN useradd -m -s /bin/bash -u 1001 arduino

WORKDIR /app

COPY package.json ./
RUN pnpm install --no-frozen-lockfile

COPY tsconfig.json ./
COPY src/ ./src/
RUN pnpm run build

# Install Arduino board cores
RUN arduino-cli core update-index && \
    arduino-cli core install arduino:avr

# Warm up compiler cache
RUN mkdir -p /tmp/warmup/warmup && \
    echo 'void setup() { Serial.begin(9600); } void loop() { delay(1000); }' \
      > /tmp/warmup/warmup/warmup.ino && \
    arduino-cli compile --fqbn arduino:avr:uno /tmp/warmup/warmup --output-dir /tmp/warmup/uno && \
    arduino-cli compile --fqbn arduino:avr:mega /tmp/warmup/warmup --output-dir /tmp/warmup/mega && \
    rm -rf /tmp/warmup

RUN mkdir -p /app/uploads && \
    chown -R arduino:arduino /app

USER arduino

ENV PORT=8080
ENV NODE_ENV=production
ENV ARDUINO_CLI_PATH=/usr/local/bin/arduino-cli

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

CMD ["node", "dist/server.js"]
