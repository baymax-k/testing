# Arduino Compiler Service Dockerfile
FROM ubuntu:22.04

RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | sh && \
    mv bin/arduino-cli /usr/local/bin/

RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs

# Pin pnpm to v10 — pnpm 11 requires Node 22+ which this image doesn't have
RUN corepack enable && corepack prepare pnpm@10.30.1 --activate

RUN useradd -m -s /bin/bash arduino
WORKDIR /app

COPY package.json ./
RUN pnpm install --no-frozen-lockfile

COPY tsconfig.json ./
COPY src/ ./src/
RUN pnpm run build

USER arduino

RUN arduino-cli core update-index && \
    arduino-cli core install arduino:avr

RUN mkdir -p /tmp/warmup/warmup && \
    echo 'void setup() { Serial.begin(9600); } void loop() { delay(1000); }' > /tmp/warmup/warmup/warmup.ino && \
    arduino-cli compile --fqbn arduino:avr:uno /tmp/warmup/warmup --output-dir /tmp/warmup/uno && \
    arduino-cli compile --fqbn arduino:avr:mega /tmp/warmup/warmup --output-dir /tmp/warmup/mega && \
    rm -rf /tmp/warmup

USER root

RUN mkdir -p /app/uploads && \
    chown -R arduino:arduino /app

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

USER arduino

CMD ["node", "dist/server.js"]