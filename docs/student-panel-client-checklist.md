# Student Panel Client Handoff Checklist

This file is for client demo/update calls. It covers implemented features, endpoint checklist, and copy-paste commands to verify API behavior.

## 1. Completed Feature Checklist (Student Panel)

- [x] Authentication (sign-up, sign-in, OTP verify, refresh, sign-out, password flows)
- [x] Student dashboard with real-time aggregated stats
- [x] Student profile endpoint
- [x] DSA problem listing and detail endpoints
- [x] DSA run/test/submit workflow with submission history
- [x] Practice mode (MCQ topics, sessions, random set, submit, history, stats)
- [x] Practice activity tracking (post + fetch)
- [x] POTD (today, solve, streak, history)
- [x] Contest flow (list, join, fetch contest, DSA/MCQ submit, leaderboard)
- [x] Arduino workflow (health, boards, problems, compile queue, job status, submissions, validation)
- [x] Swagger docs available for API presentation

## 2. Quick Setup for Endpoint Checks

```bash
export BASE_URL="http://localhost:5000"
export COOKIE_JAR="/tmp/codeethics.cookies"
rm -f "$COOKIE_JAR"
```

Start backend locally:

```bash
pnpm run dev
```

## 3. Authentication Commands (Run First)

### 3.1 Sign In (required before protected endpoints)

```bash
curl -i -s -c "$COOKIE_JAR" \
  -X POST "$BASE_URL/api/v1/auth/sign-in" \
  -H "Content-Type: application/json" \
  -d '{"identifier":"<student_email_or_username>","password":"<password>"}'
```

**Expected:** `200` with `{"message":"Signed in","user":{...}}` and auth cookies set.

### 3.2 Auth Status

```bash
curl -s -b "$COOKIE_JAR" "$BASE_URL/api/v1/auth/status"
```

**Expected:** `{"success":true,"authenticated":true,"user":{...}}`

### 3.3 Common Health + Current User

```bash
curl -s "$BASE_URL/api/v1/"
curl -s -b "$COOKIE_JAR" "$BASE_URL/api/v1/me"
```

**Expected:** API health JSON, then logged-in user + redirect path.

---

## 4. Endpoint Checklist by Module

> All commands below assume valid auth cookies from section 3.

## 4.0 Auth

- [x] `POST /api/v1/auth/sign-up`
  ```bash
  curl -s -X POST "$BASE_URL/api/v1/auth/sign-up" \
    -H "Content-Type: application/json" \
    -d '{"email":"<email>","username":"<username>","name":"<name>","password":"<password>"}'
  ```
  **Expected:** `201` with account-created message.

- [x] `POST /api/v1/auth/sign-in`
  ```bash
  curl -i -s -c "$COOKIE_JAR" -X POST "$BASE_URL/api/v1/auth/sign-in" \
    -H "Content-Type: application/json" \
    -d '{"identifier":"<email_or_username>","password":"<password>"}'
  ```
  **Expected:** `200`, user payload, cookies set.

- [x] `POST /api/v1/auth/sign-in/google`
  ```bash
  curl -s -X POST "$BASE_URL/api/v1/auth/sign-in/google" \
    -H "Content-Type: application/json" \
    -d '{"idToken":"<google_id_token>"}'
  ```
  **Expected:** `200` with user payload (or `401/403` for token/email validation errors).

- [x] `GET /api/v1/auth/google-client-id`
  ```bash
  curl -s "$BASE_URL/api/v1/auth/google-client-id"
  ```
  **Expected keys:** `clientId`.

- [x] `POST /api/v1/auth/send-otp`
  ```bash
  curl -s -X POST "$BASE_URL/api/v1/auth/send-otp" \
    -H "Content-Type: application/json" \
    -d '{"email":"<email>"}'
  ```
  **Expected:** OTP dispatch message (safe message if account not found).

- [x] `POST /api/v1/auth/verify-email`
  ```bash
  curl -s -c "$COOKIE_JAR" -X POST "$BASE_URL/api/v1/auth/verify-email" \
    -H "Content-Type: application/json" \
    -d '{"email":"<email>","otp":"<otp_code>"}'
  ```
  **Expected:** email verified message + user; auth cookies set.

- [x] `POST /api/v1/auth/forgot-password`
  ```bash
  curl -s -X POST "$BASE_URL/api/v1/auth/forgot-password" \
    -H "Content-Type: application/json" \
    -d '{"email":"<email>"}'
  ```
  **Expected:** reset-code dispatch message.

- [x] `POST /api/v1/auth/reset-password`
  ```bash
  curl -s -X POST "$BASE_URL/api/v1/auth/reset-password" \
    -H "Content-Type: application/json" \
    -d '{"email":"<email>","otp":"<otp_code>","newPassword":"<new_password>"}'
  ```
  **Expected:** password-reset success message.

- [x] `POST /api/v1/auth/change-password` (auth required)
  ```bash
  curl -s -b "$COOKIE_JAR" -X POST "$BASE_URL/api/v1/auth/change-password" \
    -H "Content-Type: application/json" \
    -d '{"currentPassword":"<old_password>","newPassword":"<new_password>"}'
  ```
  **Expected:** password-changed success message.

- [x] `POST /api/v1/auth/refresh`
  ```bash
  curl -i -s -b "$COOKIE_JAR" -c "$COOKIE_JAR" -X POST "$BASE_URL/api/v1/auth/refresh"
  ```
  **Expected:** token-refreshed message + refreshed cookies.

- [x] `POST /api/v1/auth/sign-out`
  ```bash
  curl -s -b "$COOKIE_JAR" -X POST "$BASE_URL/api/v1/auth/sign-out"
  ```
  **Expected:** signed-out message and cleared cookies.

- [x] `GET /api/v1/auth/status`
  ```bash
  curl -s -b "$COOKIE_JAR" "$BASE_URL/api/v1/auth/status"
  ```
  **Expected:** `authenticated: true|false`.

## 4.1 Student Core

- [x] `GET /api/v1/student/dashboard`
  ```bash
  curl -s -b "$COOKIE_JAR" "$BASE_URL/api/v1/student/dashboard"
  ```
  **Expected keys:** `success`, `data.panel`, `data.message`, dashboard stats blocks.

- [x] `GET /api/v1/student/profile`
  ```bash
  curl -s -b "$COOKIE_JAR" "$BASE_URL/api/v1/student/profile"
  ```
  **Expected keys:** profile object with user details and student-related data.

## 4.2 Practice (MCQ + DSA)

- [x] `GET /api/v1/student/practice`
  ```bash
  curl -s -b "$COOKIE_JAR" "$BASE_URL/api/v1/student/practice?page=1&limit=10"
  ```
  **Expected keys:** `problems[]`, `pagination`.

- [x] `GET /api/v1/student/practice/mcq/topics`
  ```bash
  curl -s -b "$COOKIE_JAR" "$BASE_URL/api/v1/student/practice/mcq/topics"
  ```
  **Expected keys:** `topics[]`.

- [x] `GET /api/v1/student/practice/mcq/stats`
  ```bash
  curl -s -b "$COOKIE_JAR" "$BASE_URL/api/v1/student/practice/mcq/stats"
  ```
  **Expected keys:** `stats.totalSessions`, `stats.overallAccuracy`, `stats.topicBreakdown`.

- [x] `POST /api/v1/student/practice/mcq/session`
  ```bash
  curl -s -b "$COOKIE_JAR" \
    -X POST "$BASE_URL/api/v1/student/practice/mcq/session" \
    -H "Content-Type: application/json" \
    -d '{"topics":["arrays","strings"],"difficulty":"easy"}'
  ```
  **Expected keys:** `session.id`, `questions[]`.

- [x] `POST /api/v1/student/practice/random`
  ```bash
  curl -s -b "$COOKIE_JAR" \
    -X POST "$BASE_URL/api/v1/student/practice/random" \
    -H "Content-Type: application/json" \
    -d '{"count":5,"difficulty":"easy"}'
  ```
  **Expected keys:** `seed`, `poolSize`, `questions[]`.

- [x] `GET /api/v1/student/practice/mcq/session/:sessionId`
  ```bash
  curl -s -b "$COOKIE_JAR" "$BASE_URL/api/v1/student/practice/mcq/session/<SESSION_ID>"
  ```
  **Expected keys:** `session`, `questions[]`, `answeredQuestions`.

- [x] `POST /api/v1/student/practice/mcq/session/submit`
  ```bash
  curl -s -b "$COOKIE_JAR" \
    -X POST "$BASE_URL/api/v1/student/practice/mcq/session/submit" \
    -H "Content-Type: application/json" \
    -d '{"sessionId":"<SESSION_ID>","answers":[{"questionId":"<Q1>","selectedOption":0}]}'
  ```
  **Expected keys:** `session`, `review[]`.

- [x] `GET /api/v1/student/practice/mcq/history`
  ```bash
  curl -s -b "$COOKIE_JAR" "$BASE_URL/api/v1/student/practice/mcq/history?page=1&limit=10"
  ```
  **Expected keys:** `history[]`, `pagination`.

- [x] `GET /api/v1/student/practice/mcq/history/:sessionId`
  ```bash
  curl -s -b "$COOKIE_JAR" "$BASE_URL/api/v1/student/practice/mcq/history/<SESSION_ID>"
  ```
  **Expected keys:** `session`, `review[]`.

- [x] `POST /api/v1/student/practice/mcq`
  ```bash
  curl -s -b "$COOKIE_JAR" \
    -X POST "$BASE_URL/api/v1/student/practice/mcq" \
    -H "Content-Type: application/json" \
    -d '{"questionId":"<MCQ_QUESTION_ID>","selectedOption":1}'
  ```
  **Expected keys:** `isCorrect`, `correctAnswer`, `points`, `explanation`.

- [x] `POST /api/v1/student/practice/activity`
  ```bash
  curl -s -b "$COOKIE_JAR" \
    -X POST "$BASE_URL/api/v1/student/practice/activity" \
    -H "Content-Type: application/json" \
    -d '{"type":"visit"}'
  ```
  **Expected keys:** `activity`.

- [x] `GET /api/v1/student/practice/activity`
  ```bash
  curl -s -b "$COOKIE_JAR" "$BASE_URL/api/v1/student/practice/activity?days=7"
  ```
  **Expected keys:** `activity` (single row or range array).

- [x] `GET /api/v1/student/practice/:id`
  ```bash
  curl -s -b "$COOKIE_JAR" "$BASE_URL/api/v1/student/practice/<QUESTION_ID>"
  ```
  **Expected keys:** `problem`.

## 4.3 POTD

- [x] `GET /api/v1/student/potd`
  ```bash
  curl -s -b "$COOKIE_JAR" "$BASE_URL/api/v1/student/potd"
  ```
  **Expected:** today challenge payload (or `404` if no configured daily challenge).

- [x] `POST /api/v1/student/potd/solve`
  ```bash
  curl -s -b "$COOKIE_JAR" \
    -X POST "$BASE_URL/api/v1/student/potd/solve" \
    -H "Content-Type: application/json" \
    -d '{"dailyChallengeId":"<DAILY_CHALLENGE_ID>","selectedOption":1}'
  ```
  **Expected:** solve result payload (correctness/points/streak update info).

- [x] `GET /api/v1/student/potd/streak`
  ```bash
  curl -s -b "$COOKIE_JAR" "$BASE_URL/api/v1/student/potd/streak"
  ```
  **Expected keys:** `streak`.

- [x] `GET /api/v1/student/potd/history`
  ```bash
  curl -s -b "$COOKIE_JAR" "$BASE_URL/api/v1/student/potd/history?page=1&limit=10"
  ```
  **Expected:** paginated POTD history payload.

## 4.4 Contest

- [x] `GET /api/v1/student/contest`
  ```bash
  curl -s -b "$COOKIE_JAR" "$BASE_URL/api/v1/student/contest?page=1&limit=10&status=all"
  ```
  **Expected keys:** `contests[]`, `pagination`.

- [x] `POST /api/v1/student/contest/join`
  ```bash
  curl -s -b "$COOKIE_JAR" \
    -X POST "$BASE_URL/api/v1/student/contest/join" \
    -H "Content-Type: application/json" \
    -d '{"contestId":"<CONTEST_ID>"}'
  ```
  **Expected:** `message`, `participation`.

- [x] `GET /api/v1/student/contest/:id`
  ```bash
  curl -s -b "$COOKIE_JAR" "$BASE_URL/api/v1/student/contest/<CONTEST_ID>"
  ```
  **Expected:** contest detail + `timeLeft` (requires joined + active contest).

- [x] `GET /api/v1/student/contest/:id/mcq`
  ```bash
  curl -s -b "$COOKIE_JAR" "$BASE_URL/api/v1/student/contest/<CONTEST_ID>/mcq"
  ```
  **Expected keys:** `contest`, `questions[]`, `participation`, `timeLeftMs`.

- [x] `POST /api/v1/student/contest/submit-dsa`
  ```bash
  curl -s -b "$COOKIE_JAR" \
    -X POST "$BASE_URL/api/v1/student/contest/submit-dsa" \
    -H "Content-Type: application/json" \
    -d '{"contestId":"<CONTEST_ID>","problemId":"<PROBLEM_ID>","code":"print(1)","language":"python"}'
  ```
  **Expected:** `message`, `submission` with status and points.

- [x] `POST /api/v1/student/contest/submit-mcq`
  ```bash
  curl -s -b "$COOKIE_JAR" \
    -X POST "$BASE_URL/api/v1/student/contest/submit-mcq" \
    -H "Content-Type: application/json" \
    -d '{"contestId":"<CONTEST_ID>","answers":{"<QUESTION_ID>":1}}'
  ```
  **Expected:** `message`, `result` (attempted/correct/score).

- [x] `GET /api/v1/student/contest/:id/leaderboard`
  ```bash
  curl -s -b "$COOKIE_JAR" "$BASE_URL/api/v1/student/contest/<CONTEST_ID>/leaderboard"
  ```
  **Expected keys:** `leaderboard[]` with rank, user, score.

## 4.5 Problems + Submissions (DSA)

- [x] `GET /api/v1/problems`
  ```bash
  curl -s -b "$COOKIE_JAR" "$BASE_URL/api/v1/problems?page=1&limit=20"
  ```
  **Expected keys:** `problems[]`, `pagination`.

- [x] `GET /api/v1/problems/:slug`
  ```bash
  curl -s -b "$COOKIE_JAR" "$BASE_URL/api/v1/problems/<PROBLEM_SLUG>"
  ```
  **Expected keys:** `problem`.

- [x] `POST /api/v1/submissions/run`
  ```bash
  curl -s -b "$COOKIE_JAR" \
    -X POST "$BASE_URL/api/v1/submissions/run" \
    -H "Content-Type: application/json" \
    -d '{"language":"python","sourceCode":"print(\"hello\")","stdin":""}'
  ```
  **Expected:** run result payload from Judge0.

- [x] `POST /api/v1/submissions/test`
  ```bash
  curl -s -b "$COOKIE_JAR" \
    -X POST "$BASE_URL/api/v1/submissions/test" \
    -H "Content-Type: application/json" \
    -d '{"problemId":"<PROBLEM_ID>","language":"python","sourceCode":"print(1)"}'
  ```
  **Expected:** sample-test execution result payload.

- [x] `POST /api/v1/submissions`
  ```bash
  curl -s -b "$COOKIE_JAR" \
    -X POST "$BASE_URL/api/v1/submissions" \
    -H "Content-Type: application/json" \
    -d '{"problemId":"<PROBLEM_ID>","language":"python","sourceCode":"print(1)"}'
  ```
  **Expected:** submission result with status + test case stats.

- [x] `GET /api/v1/submissions`
  ```bash
  curl -s -b "$COOKIE_JAR" "$BASE_URL/api/v1/submissions?page=1&limit=10"
  ```
  **Expected keys:** `submissions[]`, `pagination`.

- [x] `GET /api/v1/submissions/:id`
  ```bash
  curl -s -b "$COOKIE_JAR" "$BASE_URL/api/v1/submissions/<SUBMISSION_ID>"
  ```
  **Expected keys:** `submission`.

## 4.6 Arduino

- [x] `GET /api/v1/arduino/health` (public)
  ```bash
  curl -s "$BASE_URL/api/v1/arduino/health"
  ```
  **Expected keys:** `success`, `status`, `service`, `timestamp`.

- [x] `GET /api/v1/arduino/boards`
  ```bash
  curl -s -b "$COOKIE_JAR" "$BASE_URL/api/v1/arduino/boards"
  ```
  **Expected keys:** `success`, `data.boards[]`.

- [x] `GET /api/v1/arduino/problems`
  ```bash
  curl -s -b "$COOKIE_JAR" "$BASE_URL/api/v1/arduino/problems?limit=20&offset=0"
  ```
  **Expected keys:** `success`, `data.problems[]`, `data.pagination`.

- [x] `GET /api/v1/arduino/problems/:problemId`
  ```bash
  curl -s -b "$COOKIE_JAR" "$BASE_URL/api/v1/arduino/problems/<ARDUINO_PROBLEM_ID>"
  ```
  **Expected keys:** `success`, `data` (problem + testCases).

- [x] `POST /api/v1/arduino/compile`
  ```bash
  curl -s -b "$COOKIE_JAR" \
    -X POST "$BASE_URL/api/v1/arduino/compile" \
    -H "Content-Type: application/json" \
    -d '{"problemId":"<ARDUINO_PROBLEM_ID>","code":"void setup(){} void loop(){}","boardType":"uno"}'
  ```
  **Expected:** `202` with `success`, `data.submissionId`, `data.status`.

- [x] `GET /api/v1/arduino/jobs/:submissionId`
  ```bash
  curl -s -b "$COOKIE_JAR" "$BASE_URL/api/v1/arduino/jobs/<ARDUINO_SUBMISSION_ID>"
  ```
  **Expected keys:** `success`, `data.status`, result/error fields.

- [x] `GET /api/v1/arduino/submissions`
  ```bash
  curl -s -b "$COOKIE_JAR" "$BASE_URL/api/v1/arduino/submissions?limit=20&offset=0"
  ```
  **Expected keys:** `success`, `data.submissions[]`, `data.pagination`.

- [x] `DELETE /api/v1/arduino/jobs/:submissionId`
  ```bash
  curl -s -b "$COOKIE_JAR" -X DELETE "$BASE_URL/api/v1/arduino/jobs/<ARDUINO_SUBMISSION_ID>"
  ```
  **Expected:** `400` with message that direct compilation cannot be canceled.

- [x] `POST /api/v1/arduino/validate`
  ```bash
  curl -s -b "$COOKIE_JAR" \
    -X POST "$BASE_URL/api/v1/arduino/validate" \
    -H "Content-Type: application/json" \
    -d '{"submissionId":"<ARDUINO_SUBMISSION_ID>"}'
  ```
  **Expected:** validation result payload with pass/fail details.

- [x] `GET /api/v1/arduino/hardware/upload-guide`
  ```bash
  curl -s -b "$COOKIE_JAR" "$BASE_URL/api/v1/arduino/hardware/upload-guide"
  ```
  **Expected keys:** `success`, `data.overview`, `data.steps[]`, `data.troubleshooting[]`.

- [x] `GET /api/v1/arduino/admin/queue/stats` (admin only)
  ```bash
  curl -s -b "$COOKIE_JAR" "$BASE_URL/api/v1/arduino/admin/queue/stats"
  ```
  **Expected:** admin stats payload or `403` for non-admin users.

## 4.7 Execution Dependency Health

- [x] `GET /api/v1/judge0/health` (public)
  ```bash
  curl -s "$BASE_URL/api/v1/judge0/health"
  ```
  **Expected:** `{"status":"ok","judge0":...}` or `503` if Judge0 unavailable.

---

## 5. Swagger (for Live Client Demo)

```bash
open "$BASE_URL/api-docs" 2>/dev/null || xdg-open "$BASE_URL/api-docs" 2>/dev/null || true
```

Swagger URL: `http://localhost:5000/api-docs`

---

## 6. Notes for Client Call

- All student-panel business endpoints are authentication-protected.
- Arduino health is intentionally public for monitoring.
- Arduino compile is asynchronous (`202`) and tracked by `submissionId`.
- Contest and POTD endpoints enforce data/state rules (joined contest, active contest, valid challenge window).
