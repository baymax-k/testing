/**
 * @openapi
 * /api/v1/auth/sign-up:
 *   post:
 *     tags: [Authentication]
 *     summary: POST /api/v1/auth/sign-up
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/v1/auth/sign-in:
 *   post:
 *     tags: [Authentication]
 *     summary: POST /api/v1/auth/sign-in
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/v1/auth/sign-in/google:
 *   post:
 *     tags: [Authentication]
 *     summary: POST /api/v1/auth/sign-in/google
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/v1/auth/google-client-id:
 *   get:
 *     tags: [Authentication]
 *     summary: GET /api/v1/auth/google-client-id
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/v1/auth/sign-out:
 *   post:
 *     tags: [Authentication]
 *     summary: POST /api/v1/auth/sign-out
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/v1/auth/refresh:
 *   post:
 *     tags: [Authentication]
 *     summary: POST /api/v1/auth/refresh
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/v1/auth/verify-email:
 *   post:
 *     tags: [Authentication]
 *     summary: POST /api/v1/auth/verify-email
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/v1/auth/send-otp:
 *   post:
 *     tags: [Authentication]
 *     summary: POST /api/v1/auth/send-otp
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/v1/auth/forgot-password:
 *   post:
 *     tags: [Authentication]
 *     summary: POST /api/v1/auth/forgot-password
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/v1/auth/reset-password:
 *   post:
 *     tags: [Authentication]
 *     summary: POST /api/v1/auth/reset-password
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/v1/auth/change-password:
 *   post:
 *     tags: [Authentication]
 *     summary: POST /api/v1/auth/change-password
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/v1:
 *   get:
 *     tags: [Other APIs]
 *     summary: GET /api/v1
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/v1/me:
 *   get:
 *     tags: [Other APIs]
 *     summary: GET /api/v1/me
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/v1/admin/dashboard:
 *   get:
 *     tags: [Admin]
 *     summary: GET /api/v1/admin/dashboard
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/v1/student/practice:
 *   get:
 *     tags: [Student]
 *     summary: GET /api/v1/student/practice
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/v1/student/practice/mcq/topics:
 *   get:
 *     tags: [Student]
 *     summary: GET /api/v1/student/practice/mcq/topics
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/v1/student/practice/mcq/stats:
 *   get:
 *     tags: [Student]
 *     summary: GET /api/v1/student/practice/mcq/stats
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/v1/student/practice/mcq/session:
 *   post:
 *     tags: [Student]
 *     summary: POST /api/v1/student/practice/mcq/session
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/v1/student/practice/random:
 *   post:
 *     tags: [Student]
 *     summary: POST /api/v1/student/practice/random
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/v1/student/practice/mcq/session/{sessionId}:
 *   get:
 *     tags: [Student]
 *     summary: GET /api/v1/student/practice/mcq/session/{sessionId}
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/v1/student/practice/mcq/session/submit:
 *   post:
 *     tags: [Student]
 *     summary: POST /api/v1/student/practice/mcq/session/submit
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/v1/student/practice/mcq/history:
 *   get:
 *     tags: [Student]
 *     summary: GET /api/v1/student/practice/mcq/history
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/v1/student/practice/mcq/history/{sessionId}:
 *   get:
 *     tags: [Student]
 *     summary: GET /api/v1/student/practice/mcq/history/{sessionId}
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/v1/student/practice/mcq:
 *   post:
 *     tags: [Student]
 *     summary: POST /api/v1/student/practice/mcq
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/v1/student/practice/activity:
 *   post:
 *     tags: [Student]
 *     summary: POST /api/v1/student/practice/activity
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       "200":
 *         description: Successful operation
 *   get:
 *     tags: [Student]
 *     summary: GET /api/v1/student/practice/activity
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/v1/student/practice/{id}:
 *   get:
 *     tags: [Student]
 *     summary: GET /api/v1/student/practice/{id}
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/v1/student/contest:
 *   get:
 *     tags: [Student]
 *     summary: GET /api/v1/student/contest
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/v1/student/contest/{id}:
 *   get:
 *     tags: [Student]
 *     summary: GET /api/v1/student/contest/{id}
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/v1/student/contest/{id}/mcq:
 *   get:
 *     tags: [Student]
 *     summary: GET /api/v1/student/contest/{id}/mcq
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/v1/student/contest/join:
 *   post:
 *     tags: [Student]
 *     summary: POST /api/v1/student/contest/join
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/v1/student/contest/submit-dsa:
 *   post:
 *     tags: [Student]
 *     summary: POST /api/v1/student/contest/submit-dsa
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/v1/student/contest/submit-mcq:
 *   post:
 *     tags: [Student]
 *     summary: POST /api/v1/student/contest/submit-mcq
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/v1/student/contest/{id}/leaderboard:
 *   get:
 *     tags: [Student]
 *     summary: GET /api/v1/student/contest/{id}/leaderboard
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/v1/problems:
 *   get:
 *     tags: [Problems]
 *     summary: GET /api/v1/problems
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/v1/problems/{slug}:
 *   get:
 *     tags: [Problems]
 *     summary: GET /api/v1/problems/{slug}
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/v1/submissions/run:
 *   post:
 *     tags: [Submissions]
 *     summary: POST /api/v1/submissions/run
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/v1/submissions/test:
 *   post:
 *     tags: [Submissions]
 *     summary: POST /api/v1/submissions/test
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/v1/submissions:
 *   post:
 *     tags: [Submissions]
 *     summary: POST /api/v1/submissions
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       "200":
 *         description: Successful operation
 *   get:
 *     tags: [Submissions]
 *     summary: GET /api/v1/submissions
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/v1/submissions/{id}:
 *   get:
 *     tags: [Submissions]
 *     summary: GET /api/v1/submissions/{id}
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/v1/judge0/health:
 *   get:
 *     tags: [Judge0]
 *     summary: GET /api/v1/judge0/health
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/v1/student/potd:
 *   get:
 *     tags: [Student]
 *     summary: GET /api/v1/student/potd
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/v1/student/potd/solve:
 *   post:
 *     tags: [Student]
 *     summary: POST /api/v1/student/potd/solve
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/v1/student/potd/streak:
 *   get:
 *     tags: [Student]
 *     summary: GET /api/v1/student/potd/streak
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/v1/student/potd/history:
 *   get:
 *     tags: [Student]
 *     summary: GET /api/v1/student/potd/history
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/public/tests:
 *   get:
 *     tags: [Public APIs - Tests]
 *     summary: GET /api/public/tests
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/public/tests/stats:
 *   get:
 *     tags: [Public APIs - Tests]
 *     summary: GET /api/public/tests/stats
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/public/tests/filters/difficulties:
 *   get:
 *     tags: [Public APIs - Tests]
 *     summary: GET /api/public/tests/filters/difficulties
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/public/tests/filters/tags:
 *   get:
 *     tags: [Public APIs - Tests]
 *     summary: GET /api/public/tests/filters/tags
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/public/tests/{testId}:
 *   get:
 *     tags: [Public APIs - Tests]
 *     summary: GET /api/public/tests/{testId}
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: testId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/product-admin/avatar:
 *   post:
 *     tags: [Product Admin]
 *     summary: POST /api/product-admin/avatar
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/product-admin/avatar/presign:
 *   post:
 *     tags: [Product Admin]
 *     summary: POST /api/product-admin/avatar/presign
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               mimeType:
 *                 type: string
 *                 example: image/png
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/product-admin/avatar/confirm:
 *   post:
 *     tags: [Product Admin]
 *     summary: POST /api/product-admin/avatar/confirm
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               key:
 *                 type: string
 *                 example: avatars/product-admin/USER_ID/123.png
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/product-admin/auth/sign-up:
 *   post:
 *     tags: [Product Admin]
 *     summary: POST /api/product-admin/auth/sign-up
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/product-admin/auth/sign-in:
 *   post:
 *     tags: [Product Admin]
 *     summary: POST /api/product-admin/auth/sign-in
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/product-admin/auth/sign-out:
 *   post:
 *     tags: [Product Admin]
 *     summary: POST /api/product-admin/auth/sign-out
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/product-admin/auth/refresh:
 *   post:
 *     tags: [Product Admin]
 *     summary: POST /api/product-admin/auth/refresh
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/product-admin/auth/verify-email:
 *   post:
 *     tags: [Product Admin]
 *     summary: POST /api/product-admin/auth/verify-email
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/product-admin/auth/forgot-password:
 *   post:
 *     tags: [Product Admin]
 *     summary: POST /api/product-admin/auth/forgot-password
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/product-admin/auth/verify-forgot-password-otp:
 *   post:
 *     tags: [Product Admin]
 *     summary: POST /api/product-admin/auth/verify-forgot-password-otp
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/product-admin/auth/reset-password:
 *   post:
 *     tags: [Product Admin]
 *     summary: POST /api/product-admin/auth/reset-password
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/product-admin/auth/me:
 *   get:
 *     tags: [Product Admin]
 *     summary: GET /api/product-admin/auth/me
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/product-admin/auth/profile:
 *   patch:
 *     tags: [Product Admin]
 *     summary: PATCH /api/product-admin/auth/profile
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/product-admin/auth/settings:
 *   get:
 *     tags: [Product Admin]
 *     summary: GET /api/product-admin/auth/settings
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Successful operation
 *   patch:
 *     tags: [Product Admin]
 *     summary: PATCH /api/product-admin/auth/settings
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/product-admin/colleges:
 *   post:
 *     tags: [Product Admin]
 *     summary: POST /api/product-admin/colleges
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       "200":
 *         description: Successful operation
 *   get:
 *     tags: [Product Admin]
 *     summary: GET /api/product-admin/colleges
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/product-admin/colleges/admins:
 *   get:
 *     tags: [Product Admin]
 *     summary: GET /api/product-admin/colleges/admins
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/product-admin/colleges/{collegeId}:
 *   get:
 *     tags: [Product Admin]
 *     summary: GET /api/product-admin/colleges/{collegeId}
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: collegeId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       "200":
 *         description: Successful operation
 *   patch:
 *     tags: [Product Admin]
 *     summary: PATCH /api/product-admin/colleges/{collegeId}
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: collegeId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       "200":
 *         description: Successful operation
 *   delete:
 *     tags: [Product Admin]
 *     summary: DELETE /api/product-admin/colleges/{collegeId}
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: collegeId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/product-admin/colleges/admins/create:
 *   post:
 *     tags: [Product Admin]
 *     summary: POST /api/product-admin/colleges/admins/create
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/product-admin/colleges/assign-admin:
 *   post:
 *     tags: [Product Admin]
 *     summary: POST /api/product-admin/colleges/assign-admin
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/product-admin/colleges/admin/{adminId}:
 *   patch:
 *     tags: [Product Admin]
 *     summary: PATCH /api/product-admin/colleges/admin/{adminId}
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: adminId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/product-admin/colleges/{collegeId}/admin:
 *   delete:
 *     tags: [Product Admin]
 *     summary: DELETE /api/product-admin/colleges/{collegeId}/admin
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: collegeId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/product-admin/rbac/admins:
 *   get:
 *     tags: [Product Admin]
 *     summary: GET /api/product-admin/rbac/admins
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/product-admin/rbac/product-admins:
 *   get:
 *     tags: [Product Admin]
 *     summary: GET /api/product-admin/rbac/product-admins
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Successful operation
 *   post:
 *     tags: [Product Admin]
 *     summary: POST /api/product-admin/rbac/product-admins
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/product-admin/rbac/product-admins/{adminId}:
 *   patch:
 *     tags: [Product Admin]
 *     summary: PATCH /api/product-admin/rbac/product-admins/{adminId}
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: adminId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       "200":
 *         description: Successful operation
 *   delete:
 *     tags: [Product Admin]
 *     summary: DELETE /api/product-admin/rbac/product-admins/{adminId}
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: adminId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/product-admin/rbac/admins/{adminId}:
 *   get:
 *     tags: [Product Admin]
 *     summary: GET /api/product-admin/rbac/admins/{adminId}
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: adminId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/product-admin/rbac/promote:
 *   post:
 *     tags: [Product Admin]
 *     summary: POST /api/product-admin/rbac/promote
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/product-admin/rbac/demote:
 *   post:
 *     tags: [Product Admin]
 *     summary: POST /api/product-admin/rbac/demote
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/product-admin/rbac/roles/{role}/permissions:
 *   get:
 *     tags: [Product Admin]
 *     summary: GET /api/product-admin/rbac/roles/{role}/permissions
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: role
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/product-admin/rbac/my-permissions:
 *   get:
 *     tags: [Product Admin]
 *     summary: GET /api/product-admin/rbac/my-permissions
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/product-admin/hackathons:
 *   post:
 *     tags: [Product Admin]
 *     summary: POST /api/product-admin/hackathons
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       "200":
 *         description: Successful operation
 *   get:
 *     tags: [Product Admin]
 *     summary: GET /api/product-admin/hackathons
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/product-admin/hackathons/{hackathonId}:
 *   get:
 *     tags: [Product Admin]
 *     summary: GET /api/product-admin/hackathons/{hackathonId}
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: hackathonId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       "200":
 *         description: Successful operation
 *   patch:
 *     tags: [Product Admin]
 *     summary: PATCH /api/product-admin/hackathons/{hackathonId}
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: hackathonId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       "200":
 *         description: Successful operation
 *   delete:
 *     tags: [Product Admin]
 *     summary: DELETE /api/product-admin/hackathons/{hackathonId}
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: hackathonId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/product-admin/hackathons/{hackathonId}/stats:
 *   get:
 *     tags: [Product Admin]
 *     summary: GET /api/product-admin/hackathons/{hackathonId}/stats
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: hackathonId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/product-admin/hackathons/{hackathonId}/status:
 *   patch:
 *     tags: [Product Admin]
 *     summary: PATCH /api/product-admin/hackathons/{hackathonId}/status
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: hackathonId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/product-admin/hackathons/{hackathonId}/teams/{teamId}:
 *   patch:
 *     tags: [Product Admin]
 *     summary: PATCH /api/product-admin/hackathons/{hackathonId}/teams/{teamId}
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: hackathonId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/product-admin/dashboard:
 *   get:
 *     tags: [Product Admin]
 *     summary: GET /api/product-admin/dashboard
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Successful operation
 * /api/product-admin/users/stats:
 *   get:
 *     tags: [Product Admin]
 *     summary: GET /api/product-admin/users/stats
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Successful operation
 */
