# Arduino Compiler Service

A standalone microservice for compiling Arduino sketches (.ino files) and generating hex files for hardware simulation and deployment.

## Overview

This service provides a REST API for compiling Arduino code using the `arduino-cli` tool. It's designed to work with the CodeEthnics platform's Arduino-based coding problems and integrates with Wokwi for hardware simulation.

## Features

- ✅ Compile Arduino sketches (.ino files)
- ✅ Support for multiple board types (Arduino Uno, Arduino Mega)
- ✅ Returns compiled hex files for hardware simulation
- ✅ Fast compilation with pre-warmed cache
- ✅ Docker-based isolation and security
- ✅ Health check endpoint
- ✅ File size limits and validation
- ✅ Automatic cleanup of temporary files

## Prerequisites

### Local Development
- Node.js 20+
- `arduino-cli` installed and configured
- npm or pnpm

### Docker Deployment (Recommended)
- Docker
- Docker Compose (optional)

## Installation

### Arduino CLI Setup (Local Development)

1. **Install arduino-cli**:
   ```bash
   # Linux/macOS
   curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | sh
   sudo mv bin/arduino-cli /usr/local/bin/
   
   # Or using package manager
   # macOS: brew install arduino-cli
   # Linux: Check your distribution's package manager
   ```

2. **Initialize arduino-cli and install cores**:
   ```bash
   arduino-cli core update-index
   arduino-cli core install arduino:avr
   ```

3. **Verify installation**:
   ```bash
   arduino-cli version
   arduino-cli board listall
   ```

### Node.js Dependencies

```bash
cd arduino-compiler
pnpm install
```

## Running the Service

### Development Mode (Local)

```bash
# From arduino-compiler directory
pnpm run dev
```

The service will start on port **8080** (or the port specified in `PORT` environment variable).

### Production Mode (Local)

```bash
# Build TypeScript
pnpm run build

# Start the service
pnpm start
```

### Docker (Recommended for Production)

**Build the Docker image:**
```bash
docker build -t arduino-compiler:latest .
```

**Run the container:**
```bash
docker run -d \
  --name arduino-compiler \
  -p 8080:8080 \
  --restart unless-stopped \
  arduino-compiler:latest
```

**Check container logs:**
```bash
docker logs -f arduino-compiler
```

**Stop the container:**
```bash
docker stop arduino-compiler
docker rm arduino-compiler
```

### Docker Compose (with main backend)

Add to your `docker-compose.yml`:
```yaml
arduino-compiler:
  build:
    context: ./arduino-compiler
    dockerfile: Dockerfile
  ports:
    - "8080:8080"
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
    interval: 30s
    timeout: 10s
    retries: 3
  restart: unless-stopped
```

Then run:
```bash
docker compose up -d arduino-compiler
```

## API Endpoints

### Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-04-03T03:42:47.346Z",
  "version": "1.0.0"
}
```

### Compile Arduino Sketch
```http
POST /compile
Content-Type: multipart/form-data
```

**Parameters:**
- `sketch` (file, required): The .ino sketch file to compile
- `fqbn` (string, optional): Fully Qualified Board Name (default: `arduino:avr:uno`)

**Supported FQBNs:**
- `arduino:avr:uno` - Arduino Uno (default)
- `arduino:avr:mega` - Arduino Mega 2560

**Example using curl:**
```bash
# Compile for Arduino Uno
curl -X POST http://localhost:8080/compile \
  -F "sketch=@blink.ino" \
  -F "fqbn=arduino:avr:uno"

# Compile for Arduino Mega
curl -X POST http://localhost:8080/compile \
  -F "sketch=@blink.ino" \
  -F "fqbn=arduino:avr:mega"
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "hexFile": ":100000000C9434000C943E000C943E000C943E0082...",
  "compileTimeMs": 1247,
  "fqbn": "arduino:avr:uno",
  "sketchName": "sketch_a3f9c..."
}
```

**Error Response (400 Bad Request):**
```json
{
  "success": false,
  "error": "Compilation failed",
  "details": {
    "stdout": "...",
    "stderr": "error: 'digitalWrit' was not declared in this scope..."
  },
  "compileTimeMs": 523
}
```

## Integration with Main Backend

The Arduino compiler service is called by the main backend's Arduino worker queue. The workflow is:

1. **Student submits Arduino code** → Main backend API (`POST /api/v1/arduino/compile`)
2. **Job queued in Redis** → BullMQ worker picks up the job
3. **Worker calls compiler service** → Sends .ino file to this microservice
4. **Compilation result** → Hex file returned and stored in database
5. **Student can simulate** → Hex file used with Wokwi for hardware simulation

### Environment Variables (Main Backend)

Set in your main backend `.env`:
```env
ARDUINO_COMPILER_URL=http://localhost:8080
```

For Docker deployment:
```env
ARDUINO_COMPILER_URL=http://arduino-compiler:8080
```

## File Limits & Security

- **Max file size**: 1 MB
- **Allowed file types**: `.ino` files or `text/plain`
- **Compilation timeout**: 30 seconds
- **Automatic cleanup**: Uploaded files and temporary directories are cleaned up after compilation

## Performance Optimization

The Docker image includes several optimizations:

1. **Pre-installed Arduino cores**: AVR core is installed during image build
2. **Pre-warmed compilation cache**: Dummy sketches compiled to warm up the toolchain
3. **Build artifacts cached**: Reduces first-compilation latency

Typical compilation times:
- **First compilation**: ~1-2 seconds
- **Subsequent compilations**: ~500-800ms

## Troubleshooting

### Common Issues

**1. "arduino-cli: command not found"**
```bash
# Install arduino-cli (see Installation section)
curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | sh
sudo mv bin/arduino-cli /usr/local/bin/
```

**2. "No core installed for board"**
```bash
arduino-cli core update-index
arduino-cli core install arduino:avr
```

**3. "Compilation timeout"**
- Check if arduino-cli is working: `arduino-cli version`
- Increase timeout in `src/server.ts` if needed

**4. Port 8080 already in use**
```bash
# Change port using environment variable
PORT=8081 npm run dev
```

### Debug Mode

Enable detailed logging:
```bash
# Set environment variable
DEBUG=true npm run dev
```

## Testing

### Manual Testing

**Create a test sketch (blink.ino):**
```cpp
void setup() {
  pinMode(13, OUTPUT);
}

void loop() {
  digitalWrite(13, HIGH);
  delay(1000);
  digitalWrite(13, LOW);
  delay(1000);
}
```

**Test compilation:**
```bash
curl -X POST http://localhost:8080/compile \
  -F "sketch=@blink.ino" \
  -F "fqbn=arduino:avr:uno"
```

### Automated Testing

From the main backend repository:
```bash
# Run Arduino integration tests
pnpm test:arduino

# Run smoke tests
pnpm smoke:arduino
```

## Architecture

```
arduino-compiler/
├── src/
│   └── server.ts         # Express server, compilation logic
├── Dockerfile            # Production Docker image
├── package.json
├── tsconfig.json
└── README.md            # This file
```

**Technology Stack:**
- **Runtime**: Node.js 20 LTS
- **Framework**: Express.js
- **Language**: TypeScript
- **File Handling**: Multer
- **Compiler**: arduino-cli (official Arduino CLI tool)

## Production Deployment

### Docker Best Practices

1. **Resource Limits**: Set memory and CPU limits in docker-compose.yml
   ```yaml
   deploy:
     resources:
       limits:
         cpus: '0.5'
         memory: 512M
   ```

2. **Health Checks**: Already configured in Dockerfile
3. **Logging**: Logs to stdout (collected by Docker)
4. **Security**: Runs as non-root user (`arduino`)

### Scaling

For high-load environments, run multiple instances behind a load balancer:

```yaml
arduino-compiler:
  # ... existing config ...
  deploy:
    replicas: 3
```

Or use Kubernetes Horizontal Pod Autoscaler based on CPU/memory usage.

## Monitoring

### Health Check

```bash
curl http://localhost:8080/health
```

### Metrics to Monitor

- **Compilation success rate**: Track successful vs failed compilations
- **Response time**: Monitor `compileTimeMs` in responses
- **Queue depth**: Monitor Redis queue size (in main backend)
- **Error rates**: Track 400/500 responses

## Future Enhancements

- [ ] Support for more board types (ESP32, ESP8266)
- [ ] Library management (auto-install required libraries)
- [ ] Compilation caching (skip recompile for identical code)
- [ ] WebSocket support for real-time compilation status
- [ ] Parallel compilation for multiple boards
- [ ] Custom compiler flags
- [ ] Support for .cpp and .h files

## Related Documentation

- [Main Backend README](../README.md)
- [Arduino Worker](../src/workers/arduino-worker.ts)
- [Arduino API Routes](../src/modules/arduino/)
- [Wokwi Simulator](https://wokwi.com)

## License

Part of the CodeEthnics platform.
