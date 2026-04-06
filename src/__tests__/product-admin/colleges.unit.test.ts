import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Response } from "express";

vi.mock("../../config/prisma.js", () => {
  const prisma = {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    college: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };

  return { prisma };
});

vi.mock("../../modules/auth/auth.service.js", () => ({
  hashPassword: vi.fn().mockResolvedValue("hashed-password"),
}));

vi.mock("../../config/auth.js", () => ({
  auth: {
    api: {},
    handler: vi.fn(),
  },
  prisma: {
    $disconnect: vi.fn(),
  },
}));

const { prisma } = await import("../../config/prisma.js");
const { hashPassword } = await import("../../modules/auth/auth.service.js");
const {
  createCollege,
  getColleges,
  getCollege,
  updateCollege,
  createCollegeAdmin,
  assignAdminToCollege,
  editAdmin,
  removeAdminFromCollege,
  deleteCollege,
} = await import("../../modules/product-admin/colleges.controller.js");

function createMockRes(): Response {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as any;
}

describe("Product Admin Colleges Controller - Unit Tests", () => {
  const now = new Date("2026-01-01T10:00:00.000Z");

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
    admin: null,
    _count: { departments: 0, users: 0 },
    departments: [],
  };

  const collegeAdminUser = {
    id: "admin-1",
    email: "college.admin@example.com",
    name: "College Admin",
    role: "college_admin",
    phone: null,
    collegeId: "college-1",
  };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(prisma.college.findUnique).mockResolvedValue(college as any);
    vi.mocked(prisma.college.findMany).mockResolvedValue([
      { ...college, admin: collegeAdminUser, _count: { departments: 0, users: 1 } },
    ] as any);
    vi.mocked(prisma.college.create).mockResolvedValue(college as any);
    vi.mocked(prisma.college.update).mockResolvedValue({ ...college, admin: collegeAdminUser } as any);
    vi.mocked(prisma.college.delete).mockResolvedValue(college as any);

    vi.mocked(prisma.user.findUnique).mockResolvedValue(collegeAdminUser as any);
    vi.mocked(prisma.user.create).mockResolvedValue(collegeAdminUser as any);
    vi.mocked(prisma.user.update).mockResolvedValue(collegeAdminUser as any);
  });

  it("createCollege creates new college", async () => {
    vi.mocked(prisma.college.findUnique)
      .mockResolvedValueOnce(null as any)
      .mockResolvedValueOnce(null as any);

    const req = {
      user: { userId: "user-1", role: "product_admin" },
      body: {
        name: "CodeEthnics Institute",
        code: "CEI-001",
        description: "Institution",
        website: "https://example.edu",
        location: "Chennai",
      },
    } as any;
    const res = createMockRes();

    await createCollege(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("getColleges returns list of colleges", async () => {
    const req = {
      user: { userId: "user-1", role: "super_admin", collegeId: null },
    } as any;
    const res = createMockRes();

    await getColleges(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("getCollege returns a single college", async () => {
    const req = {
      user: { userId: "user-1", role: "super_admin", collegeId: null },
      params: { collegeId: "college-1" },
    } as any;
    const res = createMockRes();

    await getCollege(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("updateCollege updates details", async () => {
    vi.mocked(prisma.college.findUnique)
      .mockResolvedValueOnce(college as any)
      .mockResolvedValueOnce(null as any);

    const req = {
      params: { collegeId: "college-1" },
      body: { name: "Updated College" },
    } as any;
    const res = createMockRes();

    await updateCollege(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("createCollegeAdmin creates and assigns admin", async () => {
    const req = {
      user: { userId: "user-1", role: "super_admin" },
      body: {
        email: "college.admin@example.com",
        name: "College Admin",
        password: "CollegeAdmin@123",
        phone: "+91-9000000100",
        collegeId: "college-1",
      },
    } as any;
    const res = createMockRes();

    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null as any);

    await createCollegeAdmin(req, res);

    expect(hashPassword).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("assignAdminToCollege assigns existing admin", async () => {
    const req = {
      body: { collegeId: "college-1", adminId: "admin-1" },
    } as any;
    const res = createMockRes();

    await assignAdminToCollege(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("editAdmin updates admin profile", async () => {
    const req = {
      params: { adminId: "admin-1" },
      body: { name: "Updated Admin" },
    } as any;
    const res = createMockRes();

    await editAdmin(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("removeAdminFromCollege removes linked admin", async () => {
    const req = {
      params: { collegeId: "college-1" },
    } as any;
    const res = createMockRes();

    await removeAdminFromCollege(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("deleteCollege removes empty college", async () => {
    const req = {
      user: { userId: "user-1", role: "super_admin" },
      params: { collegeId: "college-1" },
    } as any;
    const res = createMockRes();

    await deleteCollege(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });
});
