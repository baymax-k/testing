# Arduino API Endpoints - Implementation Tracker

## Current Status

### ✅ Already Implemented
- GET `/api/v1/arduino/problems` - List Arduino problems
- GET `/api/v1/arduino/problems/:problemId` - Get specific problem
- POST `/api/v1/arduino/compile` - Submit code for compilation (queues job)
- GET `/api/v1/arduino/jobs/:submissionId` - Get job status
- GET `/api/v1/arduino/submissions` - Get user submissions  
- DELETE `/api/v1/arduino/jobs/:submissionId` - Cancel job
- GET `/api/v1/arduino/admin/queue/stats` - Queue statistics (admin)

### ❌ Missing Endpoints (To Be Added)

#### Compilation & Boards
- GET `/api/v1/arduino/boards` - List supported Arduino boards
- POST `/api/v1/arduino/compile/direct` - Direct compile (bypass queue, for quick tests)

#### Libraries
- GET `/api/v1/arduino/libraries` - List available Arduino libraries
- GET `/api/v1/arduino/libraries/search` - Search libraries

#### Projects (User Code Persistence)
- GET `/api/v1/arduino/projects` - List user's saved projects
- POST `/api/v1/arduino/projects` - Create new project
- GET `/api/v1/arduino/projects/:projectId` - Get project details
- PUT `/api/v1/arduino/projects/:projectId` - Update project
- DELETE `/api/v1/arduino/projects/:projectId` - Delete project

#### Test Case Validation
- POST `/api/v1/arduino/validate` - Validate code against test cases (marks problem as solved)

#### Health & Auth
- GET `/api/v1/arduino/health` - Arduino service health check
- GET `/api/v1/arduino/auth/check` - Verify if user is authenticated

## Implementation Priority

### Phase 1 (Critical)
1. GET `/api/v1/arduino/boards` - Needed for UI board selector
2. POST `/api/v1/arduino/validate` - Essential for marking problems as solved
3. GET `/api/v1/arduino/auth/check` - Verify authentication

### Phase 2 (Important)
4. GET `/api/v1/arduino/projects` - User project management
5. POST `/api/v1/arduino/projects` - Save user code
6. PUT `/api/v1/arduino/projects/:projectId` - Update projects

### Phase 3 (Nice to Have)
7. GET `/api/v1/arduino/libraries` - Library browser
8. GET `/api/v1/arduino/libraries/search` - Library search
9. POST `/api/v1/arduino/compile/direct` - Quick compile

## Notes

- All endpoints require authentication (except public problem browsing)
- Test case validation updates PostgreSQL submission records
- Projects are stored in PostgreSQL (not SQLite)
- Auth verification uses existing Better Auth session
