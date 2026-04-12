# CodeEthnics Backend

**Production-ready backend for CodeEthnics** - A comprehensive LeetCode-style educational platform designed specifically for colleges and institutions. The platform combines coding practice, MCQ tests, lectures, performance tracking, and institutional analytics with role-based access control.

## 🏗️ Architecture Overview

CodeEthnics is a scalable institutional coding platform with three main portals:
- **Student Portal**: Practice problems, contests, submissions, rankings
- **Admin Portal**: Problem management, contest creation, analytics  
- **College-Admin Portal**: Institution-wide management, department analytics

### Tech Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Runtime** | Node.js 20 LTS | Server runtime |
| **Framework** | Express.js + TypeScript | API backend |
| **Database** | PostgreSQL (AWS RDS) | Primary data store |
| **ORM** | Prisma | Database access layer |
| **Caching** | Redis (Upstash) | Session cache, rate limiting |
| **Authentication** | Better Auth + JWT | Secure auth system |
| **Code Execution** | Judge0 | Sandboxed code execution |
| **Arduino Compiler** | Arduino CLI v1.4.1 | Real hardware compilation |
| **File Storage** | ImageKit/Cloudinary | CDN-based media storage |
| **Documentation** | Swagger (OpenAPI 3.0) | API documentation |
| **Security** | Helmet.js + RBAC | Protection & access control |
| **Testing** | Supertest + Vitest | Test framework |

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** 20 LTS
- **pnpm** (package manager)
- **Docker** (for services)
- **PostgreSQL** 16+ (via Docker)
- **Redis** 7+ (via Docker)

### 1. Clone & Install
```bash
git clone <repository-url>
cd CodeEthnics-Backend
pnpm install
```

### 2. Environment Setup
Create `.env` file:
```env
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/codeethnics?schema=public"

# Authentication
BETTER_AUTH_SECRET="your-super-secret-key-256-bits-minimum"
BETTER_AUTH_URL="http://localhost:5000"
JWT_SECRET="your-jwt-secret-key"

# Server
PORT=5000
NODE_ENV=development

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
REDIS_URL=redis://localhost:6379

# Email (optional - for auth emails)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# Google OAuth (optional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-secret

# Judge0 (optional - for advanced features)
JUDGE0_HOST=http://localhost:2358
JUDGE0_AUTH=your-judge0-auth-token
```

### 3. Start Infrastructure
```bash
# Start PostgreSQL, Redis, and Judge0
pnpm run stack:up

# Check services are running
pnpm run stack:logs
```

### 4. Database Setup
```bash
# Generate Prisma client
pnpm exec prisma generate --schema src/modules/prisma/schema.prisma

# Run database migrations
pnpm exec prisma migrate deploy --schema src/modules/prisma/schema.prisma

# Seed sample data (creates test users & Arduino problems)
pnpm run seed
```

### 5. Start Development Servers
```bash
# Terminal 1: Main backend API (port 5000)
pnpm run dev

# Terminal 2: Arduino compiler service (port 8080)
pnpm run arduino:compiler

# Terminal 3: Background worker for async jobs
pnpm run worker:dev
```

### 6. Verify Installation
Visit these URLs to confirm everything works:
- **API Health**: http://localhost:5000/health
- **API Docs**: http://localhost:5000/api-docs
- **Test Login**: http://localhost:5000/test/login.html
- **Arduino Test**: http://localhost:5000/test/arduino.html
- **Arduino Compiler Health**: http://localhost:8080/health

**Test Credentials** (created by seed script):
```
Student: student@test.com / password123
Admin: admin@test.com / password123
```

---

## 📁 Project Structure

```
CodeEthnics-Backend/
├── src/
│   ├── modules/                # Feature modules
│   │   ├── auth/              # Authentication & authorization
│   │   ├── arduino/           # Arduino programming platform
│   │   ├── problems/          # Problem management
│   │   ├── submissions/       # Code submissions & judging
│   │   ├── contests/          # Contest system
│   │   ├── prisma/           # Database schema & migrations
│   │   └── routes/           # API route definitions
│   ├── middleware/           # Express middleware
│   ├── config/              # Configuration files
│   ├── services/            # Business logic services
│   ├── utils/              # Utility functions
│   ├── workers/            # Background job workers
│   └── server.ts           # Main application entry
├── arduino-compiler/        # Arduino compilation microservice
├── public/                 # Static files & test pages
├── scripts/               # Database seeding & utilities
├── test/                 # Test files
├── docker-compose.yml    # Development infrastructure
├── prisma.config.ts     # Prisma configuration
└── README.md           # This file
```

---

## 🔌 API Endpoints

### Authentication Endpoints
```http
POST /api/v1/auth/sign-up          # Create new account
POST /api/v1/auth/sign-in          # Email/password login
POST /api/v1/auth/sign-in/google   # Google OAuth login
GET  /api/v1/auth/status          # Check auth status
POST /api/v1/auth/sign-out        # Logout
POST /api/v1/auth/refresh         # Refresh JWT token
```

### Problem Management
```http
GET  /api/v1/problems             # List all problems
GET  /api/v1/problems/:id         # Get specific problem
POST /api/v1/problems             # Create problem (admin)
PUT  /api/v1/problems/:id         # Update problem (admin)
DELETE /api/v1/problems/:id       # Delete problem (admin)
```

### Arduino Platform
```http
GET  /api/v1/arduino/problems         # List Arduino problems
GET  /api/v1/arduino/problems/:id     # Get Arduino problem details
POST /api/v1/arduino/compile          # Compile Arduino code
GET  /api/v1/arduino/jobs/:id         # Check compilation status
POST /api/v1/arduino/validate         # Run test cases
GET  /api/v1/arduino/submissions      # User's submission history
GET  /api/v1/arduino/boards           # Available Arduino boards
GET  /api/v1/arduino/health           # Service health check
```

### Submissions & Judging
```http
POST /api/v1/submissions             # Submit solution
GET  /api/v1/submissions/:id         # Get submission details
GET  /api/v1/submissions/user/:id    # User's submissions
POST /api/v1/judge/execute           # Execute code (Judge0)
```

### Contest System
```http
GET  /api/v1/contests               # List contests
GET  /api/v1/contests/:id           # Contest details
POST /api/v1/contests               # Create contest (admin)
POST /api/v1/contests/:id/join      # Join contest
GET  /api/v1/contests/:id/leaderboard # Contest rankings
```

### Administrative
```http
GET  /api/v1/admin/users            # Manage users (admin)
GET  /api/v1/admin/analytics        # Platform analytics
POST /api/v1/admin/bulk-import      # Bulk problem import
GET  /api/v1/health                # Service health check
```

---

## ⚡ Arduino Platform

CodeEthnics includes a **complete Arduino programming environment** with real hardware compilation and simulation.

### Architecture
```
Student Frontend → Main Backend API → Arduino Compiler → Arduino CLI → .hex Files
                      ↓
                  PostgreSQL DB
                      ↓
                 Background Worker → Test Validation → Results
```

### Features
- ✅ **Real Arduino CLI** compilation (not mock/simulation)
- ✅ **Multiple Board Support**: Arduino Uno, Mega, ESP32
- ✅ **Hardware Simulation**: Pin states, timing, serial output
- ✅ **Test Case Validation**: Automated hardware testing
- ✅ **Library Support**: Arduino Library Manager integration
- ✅ **Intel HEX Generation**: Real firmware files
- ✅ **Wokwi Integration**: Frontend hardware visualization

### Arduino Workflow

1. **Student writes Arduino code** in web editor
2. **Submit to compilation API** (`POST /api/v1/arduino/compile`)
3. **Arduino CLI compiles** `.ino` → `.hex` file (375ms avg)
4. **Return compilation result** to frontend
5. **Student validates** against test cases (`POST /api/v1/arduino/validate`)
6. **Hardware simulation runs** test cases against compiled firmware
7. **Results stored** in database with pass/fail status

### Test Case Types
```typescript
// Pin State Testing
{
  type: "pin_state",
  pin: 13,
  expectedState: "HIGH",
  atMs: 1000,
  toleranceMs: 100
}

// Serial Output Testing
{
  type: "serial_output", 
  expectedOutput: "Hello World",
  withinMs: 5000
}

// Timing Validation
{
  type: "toggle_count",
  pin: 13,
  minToggles: 10,
  withinMs: 10000
}
```

### Frontend Integration (Wokwi)

For student portal, integrate Wokwi simulator:

```html
<!-- Minimal Wokwi Integration -->
<iframe 
  id="wokwi-simulator"
  src="https://wokwi.com/projects/new/arduino-uno"
  width="100%" 
  height="600px">
</iframe>

<script>
// Load compiled hex into Wokwi
async function loadCompiledCode(hexContent) {
  const iframe = document.getElementById('wokwi-simulator');
  iframe.contentWindow.postMessage({
    type: 'load-hex',
    hex: hexContent
  }, 'https://wokwi.com');
}
</script>
```

**Required Frontend Components:**
- Monaco Editor with Arduino syntax highlighting
- Wokwi embedded simulator iframe  
- Compilation status polling
- Test case result display
- Serial monitor output
- Board selection dropdown

---

## 🗃️ Database Schema

### Core Models
- **User**: Authentication, roles, profile information
- **Question**: Problem definitions (MCQ, DSA, Arduino)  
- **Submission**: Student code submissions and results
- **Contest**: Contest definitions and participation
- **ArduinoProblem**: Arduino-specific problem metadata
- **ArduinoTestCase**: Hardware test case definitions

### Role-Based Access Control
```typescript
enum Role {
  student        // Basic access to problems and contests
  faculty        // Department problem management
  hod           // Department administration  
  principal     // College-wide administration
  admin         // Platform administration
  super_admin   // Full system access
}
```

### Arduino Database Schema
```sql
-- Arduino Problems
CREATE TABLE ArduinoProblem (
  id VARCHAR PRIMARY KEY,
  questionId VARCHAR REFERENCES Question(id),
  board VARCHAR,           -- "Arduino Uno", "ESP32"
  fqbn VARCHAR,           -- "arduino:avr:uno"  
  libraries JSON,         -- ["WiFi", "Servo"]
  starterCode TEXT,       -- Template code
  simulationConfig JSON,  -- Pin mappings, duration
  timeLimitMs INTEGER,    -- Compilation timeout
  memoryLimitKb INTEGER   -- Memory constraints
);

-- Test Cases for Hardware Validation  
CREATE TABLE ArduinoTestCase (
  id VARCHAR PRIMARY KEY,
  problemId VARCHAR REFERENCES ArduinoProblem(id),
  label VARCHAR,          -- "LED should turn ON"
  type VARCHAR,           -- "pin_state", "serial_output"
  pin INTEGER,            -- Hardware pin number
  expectedState VARCHAR,  -- "HIGH", "LOW"  
  expectedOutput TEXT,    -- Serial output to match
  atMs INTEGER,          -- Test timing
  toleranceMs INTEGER,   -- Timing tolerance
  order INTEGER,         -- Execution order
  isHidden BOOLEAN       -- Public/private test
);
```

---

## 🔧 Development

### Available Scripts
```bash
# Development
pnpm run dev              # Start API server with hot reload
pnpm run build           # Build for production
pnpm run start           # Start production server

# Arduino Platform  
pnpm run arduino:compiler  # Start Arduino compiler service
pnpm run worker:dev        # Start background worker
pnpm run arduino:build     # Build Arduino service

# Database
pnpm run seed             # Populate with test data
pnpm exec prisma studio   # Database GUI

# Docker Stack
pnpm run stack:up         # Start all services
pnpm run stack:down       # Stop all services  
pnpm run stack:logs       # View service logs

# Testing
pnpm run test             # Run all tests
pnpm run test:auth        # Test authentication
pnpm run test:arduino     # Test Arduino platform
pnpm run smoke:arduino    # Arduino smoke tests
```

### Adding New Features

1. **Create module** in `src/modules/`
2. **Define routes** in `routes/` 
3. **Add controllers** with business logic
4. **Update Prisma schema** if needed
5. **Add validation** middleware
6. **Write tests** for new endpoints
7. **Update Swagger docs**

### Code Style
- ✅ **TypeScript strict mode** enabled
- ✅ **Clean Architecture** principles  
- ✅ **SOLID principles** followed
- ✅ **No business logic** in controllers
- ✅ **Proper error handling** middleware
- ✅ **Consistent naming** conventions

---

## 🚀 Production Deployment  

### Environment Variables (Production)
```env
# Database (AWS RDS recommended)
DATABASE_URL="postgresql://user:pass@prod-db.amazonaws.com:5432/codeethnics"

# Authentication (256-bit secrets)
BETTER_AUTH_SECRET="production-secret-256-bits-minimum"
JWT_SECRET="production-jwt-secret-key"

# Server
PORT=5000  
NODE_ENV=production
BETTER_AUTH_URL="https://api.codeethnics.com"

# Redis (Upstash recommended)
REDIS_URL="rediss://user:pass@prod-redis.upstash.io:6379"

# Email (Production SMTP)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=noreply@codeethnics.com
EMAIL_PASS=production-app-password

# File Storage
IMAGEKIT_PUBLIC_KEY=your-imagekit-key
IMAGEKIT_PRIVATE_KEY=your-imagekit-secret
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/codeethnics
```

### Build & Deploy
```bash
# Build application
pnpm run build

# Database migrations (production)
pnpm exec prisma migrate deploy --schema src/modules/prisma/schema.prisma

# Start production server
NODE_ENV=production pnpm start
```

### Docker Deployment
```dockerfile
FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

EXPOSE 5000
CMD ["pnpm", "start"]
```

---

## 🧪 Testing

### Test Coverage
- ✅ **Authentication flows** (sign-up, login, logout)
- ✅ **Arduino compilation** (real CLI integration)  
- ✅ **Problem submissions** (Judge0 integration)
- ✅ **Role-based access** (RBAC permissions)
- ✅ **API endpoints** (all major routes)

### Running Tests
```bash
# Run all tests
pnpm run test

# Specific test suites  
pnpm run test:auth         # Authentication tests
pnpm run test:arduino      # Arduino platform tests
pnpm run test:problems     # Problem management tests
pnpm run test:judge0       # Judge0 integration tests

# Coverage report
pnpm run test:coverage

# Interactive testing
pnpm run test:ui
```

---

## 🔒 Security Features

### Authentication & Authorization
- ✅ **JWT + Better Auth** hybrid system
- ✅ **Role-Based Access Control** (6 permission levels)
- ✅ **Session management** with refresh tokens
- ✅ **Google OAuth** integration
- ✅ **Email verification** with OTP codes
- ✅ **Password hashing** with bcrypt

### Security Middleware
- ✅ **Helmet.js** - Security headers
- ✅ **CORS** - Cross-origin protection  
- ✅ **Rate limiting** - API abuse prevention
- ✅ **Request validation** - Input sanitization
- ✅ **SQL injection** protection via Prisma
- ✅ **XSS protection** - Output encoding

### Production Security
- ✅ **Environment secrets** management
- ✅ **Database connection** pooling & SSL
- ✅ **API authentication** for all endpoints
- ✅ **File upload** validation & scanning
- ✅ **Audit logging** for sensitive actions

---

## 📊 Features

### ✅ Implemented Features

#### Core Platform
- [x] **User Management**: Registration, login, profile management
- [x] **Role-Based Access**: Student, faculty, admin hierarchies  
- [x] **Problem Library**: MCQ and coding problems with categories
- [x] **Submission System**: Code execution via Judge0 integration
- [x] **Contest Platform**: Timed contests with leaderboards
- [x] **Grading System**: Automatic code evaluation and scoring

#### Arduino Platform
- [x] **Real Compilation**: Arduino CLI v1.4.1 integration
- [x] **Multiple Boards**: Arduino Uno, Mega support
- [x] **Hardware Testing**: Pin state and timing validation
- [x] **Test Cases**: Automated hardware test execution
- [x] **Hex File Generation**: Real firmware compilation
- [x] **Background Processing**: Async compilation jobs
- [x] **Frontend Integration**: Wokwi simulator support

#### API & Infrastructure  
- [x] **RESTful API**: Complete endpoint coverage
- [x] **Swagger Documentation**: Auto-generated API docs
- [x] **Database Migrations**: Prisma schema management
- [x] **Background Workers**: BullMQ job processing
- [x] **Health Monitoring**: Service status endpoints
- [x] **Docker Support**: Development environment

### 🚧 Planned Features

#### Enhanced Platform
- [ ] **MCQ Test Engine**: Randomized question delivery
- [ ] **Analytics Dashboard**: Performance metrics for students/faculty
- [ ] **Batch Management**: Department and college-level organization
- [ ] **Ranking System**: Institution-wide leaderboards
- [ ] **Skill Assessment**: Gap analysis and recommendations  
- [ ] **Placement Readiness**: PGP scoring system

#### Arduino Enhancements  
- [ ] **ESP32/ESP8266 Support**: Extended board compatibility
- [ ] **Library Manager**: Arduino library integration
- [ ] **Advanced Simulation**: Sensor and actuator testing
- [ ] **Circuit Validation**: Hardware connection verification
- [ ] **Real-time Collaboration**: Pair programming support

#### Administrative Features
- [ ] **Bulk Import**: Problem set management
- [ ] **Report Generation**: Performance and usage analytics
- [ ] **Institution Analytics**: College-wide insights
- [ ] **Custom Branding**: White-label deployment options

---

## 🆘 Troubleshooting

### Common Issues

**Database Connection Errors**
```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Restart database services
pnpm run stack:down && pnpm run stack:up

# Check connection manually
psql postgresql://postgres:password@localhost:5432/codeethnics
```

**Arduino Compiler Issues**
```bash
# Verify Arduino CLI installation
./bin/arduino-cli version

# Check Arduino compiler service
curl http://localhost:8080/health

# Reinstall Arduino core
./bin/arduino-cli core install arduino:avr
```

**Redis Connection Problems**
```bash
# Check Redis is running
redis-cli ping

# Fix BullMQ configuration
# Ensure maxRetriesPerRequest: null in Redis config
```

**Port Already in Use**
```bash
# Find what's using the port
sudo lsof -i :5000

# Kill the process
sudo kill -9 <PID>
```

### Service Status Check
```bash
# Check all services
curl http://localhost:5000/health          # Main API
curl http://localhost:8080/health          # Arduino compiler
curl http://localhost:2358/about           # Judge0
redis-cli ping                             # Redis
```

---

## 🤝 Contributing

1. **Fork** the repository
2. **Create feature branch**: `git checkout -b feature/amazing-feature`
3. **Follow code style**: TypeScript, ESLint, Prettier
4. **Add tests** for new functionality  
5. **Update documentation** if needed
6. **Submit pull request** with clear description

### Development Guidelines
- ✅ Use **TypeScript strict mode**
- ✅ Follow **Clean Architecture** principles
- ✅ Write **comprehensive tests**
- ✅ Update **API documentation**
- ✅ Handle **errors gracefully**
- ✅ Validate **all inputs**

---

## 📄 License

This project is proprietary software developed for CodeEthnics educational platform.

---

## 📞 Support

For technical support and questions:
- **Documentation**: Check this README and API docs
- **Issues**: Create GitHub issue with detailed reproduction steps  
- **Email**: technical-support@codeethnics.com

**System Requirements**: Node.js 20+, PostgreSQL 16+, Redis 7+, Docker 24+
