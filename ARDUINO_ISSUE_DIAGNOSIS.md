# Arduino Compilation Issue Diagnosis & Resolution

## Issue Reported
Queued Arduino compile jobs show:
- No output
- "Rate limit exceeded"
- "Compilation timed out"

## Root Cause Identified

**The Arduino database tables (`arduino_submission`, `arduino_problem`, `arduino_test_case`) did not exist in AWS RDS.**

### Why This Happened

1. The Prisma migration `20260426175645_add_arduino_submission` was committed to the repo.
2. The migration was never applied to the AWS RDS database.
3. Prisma's migration tracker only checks previously *recorded* migrations, not actual DB schema.
4. When users submitted Arduino code:
   - Controller called `arduinoJobService.submitCompileJob()`
   - Tried to create `arduinoSubmission` record with Prisma
   - **Prisma threw error**: "Table `arduino_submission` does not exist"
   - Error was caught silently, no submission record created
   - Job was never enqueued
   - User saw no output / timeout

## Diagnostic Steps Performed

1. ✅ Submission ID `cmoll6uy40001gumb041zq2mr` did **not exist** in any table
2. ✅ Searched all submission-related tables: only `submission` (DSA) table found
3. ✅ Verified Arduino enum value **exists** (partial migration)
4. ✅ Confirmed Arduino **tables are missing** from AWS RDS
5. ✅ Checked `_prisma_migrations` table: Arduino migration **not recorded**

## Resolution Applied

### Step 1: Create Arduino Tables
Executed SQL to create:
- `arduino_problem` - stores Arduino problem definitions
- `arduino_test_case` - stores test cases for Arduino problems
- `arduino_submission` - stores user compilation attempts

Command:
```bash
python src/scripts/create_arduino_tables.py
```

Result: ✅ All three tables created successfully

### Step 2: Register Migration
Recorded the migration in Prisma's `_prisma_migrations` table to prevent re-applying it.

Command:
```bash
python src/scripts/register_arduino_migration.py
```

Result: ✅ Migration registered (now 3 Arduino migrations found)

## Verification

Before:
```
arduino_submission: ❌ NOT found
arduino_problem: ❌ NOT found
arduino_test_case: ❌ NOT found
```

After:
```
arduino_submission: ✅ exists
arduino_problem: ✅ exists
arduino_test_case: ✅ exists
```

## Next Steps to Test

1. **Start Arduino worker**: `pnpm run worker:dev`
2. **Start backend**: `pnpm run dev`
3. **Submit Arduino compile** via API:
   ```bash
   POST /api/v1/arduino/compile
   {
     "problemId": "<arduino_problem_id>",
     "code": "void setup() { pinMode(13, OUTPUT); }\nvoid loop() { digitalWrite(13, HIGH); delay(1000); digitalWrite(13, LOW); delay(1000); }",
     "boardType": "uno"
   }
   ```
4. **Check submission status**:
   ```bash
   GET /api/v1/arduino/jobs/<submissionId>
   ```
5. Should now see:
   - ✅ Submission created in DB
   - ✅ Job enqueued to Redis
   - ✅ Worker processes compilation
   - ✅ Status updates (processing → accepted/compilation_error)

## Files Modified / Created

Scripts created for diagnosis:
- `src/scripts/search_submission_tables.py` - search for submission IDs
- `src/scripts/create_arduino_tables.py` - creates Arduino schema
- `src/scripts/register_arduino_migration.py` - records migration
- `src/scripts/check_arduino_status.py` - verifies Arduino schema

## Prevention

To prevent this in the future:

1. **Enable Prisma migration validation in CI/CD**: Verify migrations are recorded before deploying
2. **Run `prisma migrate deploy` on every deployment**: Ensure all pending migrations are applied
3. **Monitor Prisma sync**: Alert if `_prisma_migrations` table differs from migration folder
