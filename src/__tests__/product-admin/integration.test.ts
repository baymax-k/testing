import { beforeEach, describe, expect, it, vi } from "vitest";
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import cookieParser from "cookie-parser";
import request from "supertest";

vi.mock("../../config/index.js", () => ({
  loginLimiter: (_req: Request, _res: Response, next: NextFunction) => next(),
  authLimiter: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock("../../middleware/auth.js", () => ({
  requireAuth: (req: any, _res: Response, next: NextFunction) => {
    const role = String(req.headers["x-test-role"] || "product_admin");
    const collegeId = String(req.headers["x-test-college-id"] || "college-1");

    req.user = {
      userId: "user-1",
      id: "user-1",
      email: "product.admin@example.com",
      name: "Product Admin",
      role,
      emailVerified: true,
      collegeId,
    };

    next();
  },
  requireCollegeAdminAuth: (_req: Request, _res: Response, next: NextFunction) => next(),
  requireRole:
    (...roles: string[]) =>
    (req: any, res: Response, next: NextFunction) => {
      if (roles.includes(req.user?.role)) {
        next();
        return;
      }
      res.status(403).json({ error: "Forbidden" });
    },
}));

vi.mock("../../modules/auth/auth.service.js", () => ({
  hashPassword: vi.fn().mockResolvedValue("hashed-password"),
  verifyPassword: vi.fn().mockResolvedValue(true),
  issueTokens: vi.fn().mockResolvedValue({ accessToken: "access-token", refreshToken: "refresh-token" }),
  verifyRefreshToken: vi.fn().mockReturnValue("user-1"),
  generateAccessToken: vi.fn().mockResolvedValue("new-access-token"),
  generateAndStoreOTP: vi.fn().mockResolvedValue("123456"),
  verifyOTP: vi.fn().mockResolvedValue(true),
  sendOTPEmail: vi.fn().mockResolvedValue(undefined),
  accessCookieOptions: {},
  refreshCookieOptions: {},
  clearCookieOptions: {},
  ACCESS_TOKEN_COOKIE: "access_token",
  REFRESH_TOKEN_COOKIE: "refresh_token",
}));

vi.mock("../../config/auth.js", () => ({
  auth: {
    api: {
      signInEmail: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
    },
    handler: vi.fn(),
  },
  prisma: {
    $disconnect: vi.fn(),
  },
}));

vi.mock("../../config/prisma.js", () => {
  const prisma = {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    college: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    productAdminSettings: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    productAdminPagePermission: {
      findMany: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    hackathon: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    hackathonTeam: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };

  return { prisma };
});

const { prisma } = await import("../../config/prisma.js");
const authService = await import("../../modules/auth/auth.service.js");
const productAdminRoutes = (await import("../../modules/routes/product-admin.js")).default;

function createTestApp(): Express {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use("/api/product-admin", productAdminRoutes);
  return app;
}

describe("Product Admin API - Integration Tests", () => {
  const now = new Date("2026-01-01T10:00:00.000Z");

  const productAdminUser = {
    id: "user-1",
    email: "product.admin@example.com",
    username: "product_admin",
    name: "Product Admin",
    role: "product_admin",
    emailVerified: true,
    passwordHash: "hashed-password",
    phone: null,
    collegeId: "college-1",
    createdAt: now,
    updatedAt: now,
  };

  const superAdminUser = {
    id: "super-1",
    email: "super.admin@example.com",
    username: "product_admin",
    name: "Super Admin",
    role: "product_admin",
    emailVerified: true,
    passwordHash: "hashed-password",
    phone: null,
    collegeId: null,
    createdAt: now,
    updatedAt: now,
  };

  const collegeAdminUser = {
    id: "admin-1",
    email: "college.admin@example.com",
    username: "college_admin",
    name: "College Admin",
    role: "college_admin",
    emailVerified: true,
    passwordHash: "hashed-password",
    phone: null,
    collegeId: "college-1",
    createdAt: now,
    updatedAt: now,
  };

  const college = {
    id: "college-1",
    name: "CodeEthnics College",
    code: "CEC",
    description: "Test college",
    website: "https://college.example.com",
    location: "Chennai",
    adminId: "admin-1",
    createdById: "user-1",
    createdAt: now,
    updatedAt: now,
  };

  const settings = {
    id: "settings-1",
    userId: "user-1",
    emailNotifications: true,
    notifyOnCollegeCreation: true,
    notifyOnAdminAssignment: true,
    notifyOnUserRegistration: false,
    theme: "light",
    language: "en",
    itemsPerPage: 20,
    twoFactorEnabled: false,
    sessionTimeout: 3600,
    updatedAt: now,
  };

  const hackathon = {
    id: "hack-1",
    title: "Spring Hackathon",
    description: "Description",
    shortDescription: "Short",
    collegeId: "college-1",
    status: "draft",
    startDate: new Date("2026-05-10T09:00:00.000Z"),
    endDate: new Date("2026-05-12T18:00:00.000Z"),
    registrationDeadline: new Date("2026-05-05T23:59:59.000Z"),
    maxTeams: 100,
    maxTeamSize: 5,
    minTeamSize: 1,
    theme: "AI",
    problemStatementUrl: "https://example.com/problem.pdf",
    isPublic: true,
    allowRemoteParticipation: true,
    prizesInfo: "Prizes",
    rulesUrl: "https://example.com/rules",
    createdByUserId: "super-1",
    createdAt: now,
    updatedAt: now,
    college,
    createdBy: superAdminUser,
    teams: [],
    participants: [],
    _count: {
      teams: 0,
      participants: 0,
    },
  };

  const hackathonTeam = {
    id: "team-1",
    hackathonId: "hack-1",
    name: "Team One",
    description: null,
    leaderUserId: "user-1",
    projectTitle: null,
    projectDescription: null,
    repositoryUrl: null,
    demoUrl: null,
    score: null,
    ranking: null,
    createdAt: now,
    updatedAt: now,
    leader: productAdminUser,
    members: [],
    _count: { members: 0 },
  };

  let testApp: Express;

  beforeEach(() => {
    vi.clearAllMocks();
    testApp = createTestApp();

    const userFindUnique = prisma.user.findUnique as any;
    const userFindFirst = prisma.user.findFirst as any;
    const userFindMany = prisma.user.findMany as any;
    const userCount = prisma.user.count as any;
    const userCreate = prisma.user.create as any;
    const userUpdate = prisma.user.update as any;
    const userDelete = prisma.user.delete as any;
    const collegeFindUnique = prisma.college.findUnique as any;
    const collegeFindMany = prisma.college.findMany as any;
    const collegeCreate = prisma.college.create as any;
    const collegeUpdate = prisma.college.update as any;
    const collegeDelete = prisma.college.delete as any;

    userFindUnique.mockImplementation(async (args: any) => {
      if (args?.where?.id === "super-1") return superAdminUser as any;
      if (args?.where?.id === "admin-1") return collegeAdminUser as any;
      if (args?.where?.id === "user-1") return productAdminUser as any;
      if (args?.where?.email === "missing@example.com") return null as any;
      if (args?.where?.email) return productAdminUser as any;
      if (args?.where?.username) return null as any;
      return productAdminUser as any;
    });

    userFindFirst.mockResolvedValue(productAdminUser as any);
    userFindMany.mockResolvedValue([superAdminUser, collegeAdminUser] as any);
    userCount.mockResolvedValue(2 as any);

    userCreate.mockImplementation(async (args: any) => ({
      id: args?.data?.role === "college_admin" ? "new-college-admin" : "new-product-admin",
      username: args?.data?.username || "new_user",
      email: args?.data?.email || "new@example.com",
      name: args?.data?.name || "New User",
      role: args?.data?.role || "product_admin",
      emailVerified: args?.data?.emailVerified ?? true,
      phone: args?.data?.phone ?? null,
      collegeId: args?.data?.collegeId ?? null,
      passwordHash: args?.data?.passwordHash || "hashed-password",
      createdAt: now,
      updatedAt: now,
    }) as any);

    userUpdate.mockImplementation(async (args: any) => ({
      ...productAdminUser,
      ...args?.data,
      id: args?.where?.id || productAdminUser.id,
      updatedAt: now,
    }));

    userDelete.mockResolvedValue(superAdminUser as any);

    collegeFindUnique.mockImplementation(async (args: any) => {
      if (args?.where?.id === "missing-college") return null as any;
      if (args?.where?.code || args?.where?.name) return null as any;
      return {
        ...college,
        admin: collegeAdminUser,
        departments: [],
        _count: { departments: 0, users: 0 },
      } as any;
    });

    collegeFindMany.mockResolvedValue([
      {
        ...college,
        admin: collegeAdminUser,
        _count: { departments: 0, users: 1 },
      },
    ] as any);

    collegeCreate.mockResolvedValue({
      ...college,
      id: "new-college",
      admin: null,
    } as any);

    collegeUpdate.mockImplementation(async (args: any) => ({
      ...college,
      ...args?.data,
      admin: collegeAdminUser,
      _count: { departments: 0, users: 0 },
    }));

    collegeDelete.mockResolvedValue(college as any);

    vi.mocked(prisma.productAdminSettings.findUnique).mockResolvedValue(settings as any);
    vi.mocked(prisma.productAdminSettings.create).mockResolvedValue(settings as any);
    vi.mocked(prisma.productAdminSettings.update).mockResolvedValue(settings as any);
    vi.mocked(prisma.productAdminPagePermission.findMany).mockResolvedValue([
      { page: "dashboard", canView: true },
      { page: "colleges", canView: true },
    ] as any);
    vi.mocked(prisma.productAdminPagePermission.createMany).mockResolvedValue({ count: 10 } as any);
    vi.mocked(prisma.productAdminPagePermission.deleteMany).mockResolvedValue({ count: 10 } as any);

    vi.mocked(prisma.hackathon.findUnique).mockResolvedValue({
      ...hackathon,
      teams: [{ ...hackathonTeam, _count: { members: 0 } }],
      participants: [],
      _count: { teams: 1, participants: 0 },
    } as any);

    vi.mocked(prisma.hackathon.findMany).mockResolvedValue([
      { ...hackathon, _count: { teams: 1, participants: 0 } },
    ] as any);
    vi.mocked(prisma.hackathon.count).mockResolvedValue(1 as any);
    vi.mocked(prisma.hackathon.create).mockResolvedValue(hackathon as any);
    vi.mocked(prisma.hackathon.update).mockResolvedValue(hackathon as any);
    vi.mocked(prisma.hackathon.delete).mockResolvedValue(hackathon as any);

    vi.mocked(prisma.hackathonTeam.findUnique).mockResolvedValue(hackathonTeam as any);
    vi.mocked(prisma.hackathonTeam.update).mockResolvedValue({
      ...hackathonTeam,
      score: 90,
      ranking: 1,
      members: [],
    } as any);

    vi.mocked(authService.verifyPassword).mockResolvedValue(true);
    vi.mocked(authService.verifyOTP).mockResolvedValue(true as any);
  });

  describe("Auth Endpoints", () => {
    it("POST /auth/sign-up", async () => {
      vi.mocked(prisma.user.findUnique)
        .mockResolvedValueOnce(null as any)
        .mockResolvedValueOnce(null as any);

      const response = await request(testApp).post("/api/product-admin/auth/sign-up").send({
        email: "new.product.admin@example.com",
        username: "new_product_admin",
        password: "StrongPass@123",
        name: "New Product Admin",
        companyName: "CodeEthnics",
      });

      expect(response.status).toBe(201);
      expect(response.body.user).toBeDefined();
    });

    it("POST /auth/sign-in", async () => {
      const response = await request(testApp).post("/api/product-admin/auth/sign-in").send({
        identifier: "product.admin@example.com",
        password: "StrongPass@123",
      });

      expect(response.status).toBe(200);
      expect(response.body.accessToken).toBeDefined();
    });

    it("POST /auth/sign-out", async () => {
      const response = await request(testApp).post("/api/product-admin/auth/sign-out");
      expect(response.status).toBe(200);
    });

    it("POST /auth/refresh", async () => {
      const response = await request(testApp)
        .post("/api/product-admin/auth/refresh")
        .set("Cookie", "refresh_token=test-refresh-token");

      expect(response.status).toBe(200);
      expect(response.body.accessToken).toBeDefined();
    });

    it("POST /auth/verify-email", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        ...productAdminUser,
        emailVerified: false,
      } as any);

      const response = await request(testApp).post("/api/product-admin/auth/verify-email").send({
        email: "product.admin@example.com",
        otp: "123456",
      });

      expect(response.status).toBe(200);
    });

    it("POST /auth/forgot-password", async () => {
      const response = await request(testApp).post("/api/product-admin/auth/forgot-password").send({
        email: "product.admin@example.com",
      });

      expect(response.status).toBe(200);
    });

    it("POST /auth/reset-password", async () => {
      const response = await request(testApp).post("/api/product-admin/auth/reset-password").send({
        email: "product.admin@example.com",
        otp: "123456",
        newPassword: "NewStrongPass@123",
      });

      expect(response.status).toBe(200);
    });

    it("GET /auth/me", async () => {
      const response = await request(testApp).get("/api/product-admin/auth/me");
      expect(response.status).toBe(200);
      expect(response.body.user).toBeDefined();
    });

    it("PATCH /auth/profile", async () => {
      const response = await request(testApp).patch("/api/product-admin/auth/profile").send({
        name: "Updated Product Admin",
        phone: "+91-9000000000",
      });

      expect(response.status).toBe(200);
    });

    it("GET /auth/settings", async () => {
      const response = await request(testApp).get("/api/product-admin/auth/settings");
      expect(response.status).toBe(200);
      expect(response.body.settings).toBeDefined();
    });

    it("PATCH /auth/settings", async () => {
      const response = await request(testApp).patch("/api/product-admin/auth/settings").send({
        emailNotifications: true,
        itemsPerPage: 20,
      });

      expect(response.status).toBe(200);
    });
  });

  describe("Colleges Endpoints", () => {
    it("POST /colleges", async () => {
      const response = await request(testApp).post("/api/product-admin/colleges").send({
        name: "CodeEthnics Institute",
        code: "CEI-001",
        description: "Institution description",
        website: "https://example.edu",
        location: "Chennai",
      });

      expect(response.status).toBe(201);
    });

    it("GET /colleges", async () => {
      const response = await request(testApp).get("/api/product-admin/colleges");
      expect(response.status).toBe(200);
    });

    it("GET /colleges/admins", async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValueOnce([collegeAdminUser] as any);

      const response = await request(testApp).get("/api/product-admin/colleges/admins");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(1);
      expect(response.body.admins).toHaveLength(1);
    });

    it("GET /colleges/:collegeId", async () => {
      const response = await request(testApp).get("/api/product-admin/colleges/college-1");
      expect(response.status).toBe(200);
    });

    it("PATCH /colleges/:collegeId", async () => {
      const response = await request(testApp).patch("/api/product-admin/colleges/college-1").send({
        name: "Updated College",
      });

      expect(response.status).toBe(200);
    });

    it("DELETE /colleges/:collegeId", async () => {
      const response = await request(testApp).delete("/api/product-admin/colleges/college-1");
      expect(response.status).toBe(200);
    });

    it("POST /colleges/admins/create", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null as any);

      const response = await request(testApp).post("/api/product-admin/colleges/admins/create").send({
        email: "new.college.admin@example.com",
        name: "New College Admin",
        password: "CollegeAdmin@123",
        phone: "+91-9000000100",
        collegeId: "college-1",
      });

      expect(response.status).toBe(201);
    });

    it("POST /colleges/assign-admin", async () => {
      const response = await request(testApp).post("/api/product-admin/colleges/assign-admin").send({
        collegeId: "college-1",
        adminId: "admin-1",
      });

      expect(response.status).toBe(200);
    });

    it("PATCH /colleges/admin/:adminId", async () => {
      const response = await request(testApp).patch("/api/product-admin/colleges/admin/admin-1").send({
        name: "Updated Admin",
      });

      expect(response.status).toBe(200);
    });

    it("DELETE /colleges/:collegeId/admin", async () => {
      const response = await request(testApp).delete("/api/product-admin/colleges/college-1/admin");
      expect(response.status).toBe(200);
    });
  });

  describe("RBAC Endpoints", () => {
    it("GET /rbac/admins", async () => {
      const response = await request(testApp).get("/api/product-admin/rbac/admins").set("x-test-role", "product_admin");
      expect(response.status).toBe(200);
    });

    it("GET /rbac/admins/:adminId", async () => {
      const response = await request(testApp).get("/api/product-admin/rbac/admins/admin-1");
      expect(response.status).toBe(200);
    });

    it("GET /rbac/product-admins", async () => {
      vi.mocked(prisma.productAdminPagePermission.findMany).mockResolvedValueOnce([
        { adminUserId: "super-1", page: "dashboard" },
        { adminUserId: "super-1", page: "rbac" },
      ] as any);

      const response = await request(testApp)
        .get("/api/product-admin/rbac/product-admins")
        .set("x-test-role", "product_admin");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.count).toBeGreaterThan(0);
      expect(response.body.admins[0].permissions).toHaveLength(10);
    });

    it("POST /rbac/product-admins", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null as any);

      const response = await request(testApp)
        .post("/api/product-admin/rbac/product-admins")
        .set("x-test-role", "product_admin")
        .send({
          email: "ops.admin@example.com",
          name: "Ops Product Admin",
          password: "StrongPass@123",
          permissions: ["dashboard", "users_management", "settings"],
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.permissions).toHaveLength(10);
    });

    it("PATCH /rbac/product-admins/:adminId", async () => {
      vi.mocked(prisma.productAdminPagePermission.findMany).mockResolvedValueOnce([
        { page: "dashboard", canView: true },
        { page: "rbac", canView: true },
      ] as any);

      const response = await request(testApp)
        .patch("/api/product-admin/rbac/product-admins/super-1")
        .set("x-test-role", "product_admin")
        .send({
          name: "Updated Product Admin",
          permissions: ["dashboard", "rbac"],
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.permissions).toHaveLength(10);
    });

    it("DELETE /rbac/product-admins/:adminId", async () => {
      const response = await request(testApp)
        .delete("/api/product-admin/rbac/product-admins/super-1")
        .set("x-test-role", "product_admin");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it("POST /rbac/promote", async () => {
      const response = await request(testApp)
        .post("/api/product-admin/rbac/promote")
        .set("x-test-role", "product_admin")
        .send({ adminId: "admin-1", newRole: "product_admin" });

      expect(response.status).toBe(200);
    });

    it("POST /rbac/demote", async () => {
      const response = await request(testApp)
        .post("/api/product-admin/rbac/demote")
        .set("x-test-role", "product_admin")
        .send({ adminId: "super-1", collegeId: "college-1" });

      expect(response.status).toBe(200);
    });

    it("GET /rbac/roles/:role/permissions", async () => {
      const response = await request(testApp).get("/api/product-admin/rbac/roles/product_admin/permissions");
      expect(response.status).toBe(200);
    });

    it("GET /rbac/my-permissions", async () => {
      const response = await request(testApp).get("/api/product-admin/rbac/my-permissions");
      expect(response.status).toBe(200);
    });
  });

  describe("Hackathons Endpoints", () => {
    it("POST /hackathons", async () => {
      const response = await request(testApp)
        .post("/api/product-admin/hackathons")
        .set("x-test-role", "product_admin")
        .send({
          title: "Spring Hackathon",
          description: "Description",
          shortDescription: "Short",
          collegeId: "college-1",
          startDate: "2026-05-10T09:00:00.000Z",
          endDate: "2026-05-12T18:00:00.000Z",
          registrationDeadline: "2026-05-05T23:59:59.000Z",
          maxTeams: 100,
          maxTeamSize: 5,
          minTeamSize: 1,
          theme: "AI",
          problemStatementUrl: "https://example.com/problem.pdf",
          isPublic: true,
          allowRemoteParticipation: true,
          prizesInfo: "Prizes",
          rulesUrl: "https://example.com/rules",
        });

      expect(response.status).toBe(201);
    });

    it("GET /hackathons", async () => {
      const response = await request(testApp).get("/api/product-admin/hackathons").set("x-test-role", "product_admin");
      expect(response.status).toBe(200);
    });

    it("GET /hackathons allows product_admin role", async () => {
      const response = await request(testApp)
        .get("/api/product-admin/hackathons")
        .set("x-test-role", "product_admin");

      expect(response.status).toBe(200);
    });

    it("GET /hackathons/:hackathonId", async () => {
      const response = await request(testApp)
        .get("/api/product-admin/hackathons/hack-1")
        .set("x-test-role", "product_admin");

      expect(response.status).toBe(200);
    });

    it("GET /hackathons/:hackathonId/stats", async () => {
      const response = await request(testApp)
        .get("/api/product-admin/hackathons/hack-1/stats")
        .set("x-test-role", "product_admin");

      expect(response.status).toBe(200);
    });

    it("PATCH /hackathons/:hackathonId", async () => {
      const response = await request(testApp)
        .patch("/api/product-admin/hackathons/hack-1")
        .set("x-test-role", "product_admin")
        .send({ title: "Updated Hackathon" });

      expect(response.status).toBe(200);
    });

    it("PATCH /hackathons/:hackathonId/status", async () => {
      const response = await request(testApp)
        .patch("/api/product-admin/hackathons/hack-1/status")
        .set("x-test-role", "product_admin")
        .send({ status: "registration_open" });

      expect(response.status).toBe(200);
    });

    it("DELETE /hackathons/:hackathonId", async () => {
      const response = await request(testApp)
        .delete("/api/product-admin/hackathons/hack-1")
        .set("x-test-role", "product_admin");

      expect(response.status).toBe(200);
    });

    it("PATCH /hackathons/:hackathonId/teams/:teamId", async () => {
      const response = await request(testApp)
        .patch("/api/product-admin/hackathons/hack-1/teams/team-1")
        .set("x-test-role", "product_admin")
        .send({ score: 90, ranking: 1 });

      expect(response.status).toBe(200);
    });
  });

  describe("Users Endpoints", () => {
    it("GET /users/stats returns hierarchical college stats", async () => {
      const collegeFindMany = prisma.college.findMany as any;

      collegeFindMany.mockResolvedValueOnce([
        {
          id: "college-1",
          name: "MIT",
          code: "MIT-001",
          _count: { users: 4500 },
          departments: [
            {
              id: "dept-eng",
              name: "Engineering",
              code: "ENG",
              _count: { users: 2000 },
              batches: [],
            },
            {
              id: "dept-sci",
              name: "Science",
              code: "SCI",
              _count: { users: 1500 },
              batches: [
                {
                  id: "batch-a",
                  name: "Batch A",
                  code: "SCI-1-A",
                  year: 1,
                  _count: { students: 200 },
                },
                {
                  id: "batch-b",
                  name: "Batch B",
                  code: "SCI-1-B",
                  year: 1,
                  _count: { students: 200 },
                },
              ],
            },
          ],
        },
        {
          id: "college-2",
          name: "Stanford",
          code: "STF-001",
          _count: { users: 3200 },
          departments: [],
        },
      ] as any);

      const response = await request(testApp).get("/api/product-admin/users/stats").set("x-test-role", "product_admin");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.summary.totalColleges).toBe(2);
      expect(response.body.summary.totalDepartments).toBe(2);
      expect(response.body.summary.totalYears).toBe(1);
      expect(response.body.summary.totalBatches).toBe(2);
      expect(response.body.summary.totalUsers).toBe(7700);
      expect(response.body.hierarchy[0].name).toBe("MIT");
      expect(response.body.hierarchy[0].departments[1].years[0].label).toBe("1st Year");
    });

    it("GET /users/stats supports search filtering", async () => {
      const collegeFindMany = prisma.college.findMany as any;

      collegeFindMany.mockResolvedValueOnce([
        {
          id: "college-1",
          name: "MIT",
          code: "MIT-001",
          _count: { users: 4500 },
          departments: [
            {
              id: "dept-sci",
              name: "Science",
              code: "SCI",
              _count: { users: 1500 },
              batches: [
                {
                  id: "batch-a",
                  name: "Batch A",
                  code: "SCI-1-A",
                  year: 1,
                  _count: { students: 200 },
                },
                {
                  id: "batch-b",
                  name: "Batch B",
                  code: "SCI-1-B",
                  year: 1,
                  _count: { students: 200 },
                },
              ],
            },
          ],
        },
      ] as any);

      const response = await request(testApp)
        .get("/api/product-admin/users/stats")
        .query({ search: "Batch B" })
        .set("x-test-role", "product_admin");

      expect(response.status).toBe(200);
      expect(response.body.hierarchy).toHaveLength(1);
      expect(response.body.hierarchy[0].departments).toHaveLength(1);
      expect(response.body.hierarchy[0].departments[0].years).toHaveLength(1);
      expect(response.body.hierarchy[0].departments[0].years[0].batches).toHaveLength(1);
      expect(response.body.hierarchy[0].departments[0].years[0].batches[0].name).toBe("Batch B");
    });
  });
});

