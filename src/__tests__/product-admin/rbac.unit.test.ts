import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Response } from "express";

vi.mock("../../config/prisma.js", () => {
  const prisma = {
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    college: {
      findUnique: vi.fn(),
    },
  };

  return { prisma };
});

const { prisma } = await import("../../config/prisma.js");
const {
  getAllAdmins,
  getAdminDetails,
  promoteAdmin,
  demoteAdmin,
  getRolePermissions,
  getMyPermissions,
} = await import("../../modules/product-admin/rbac.controller.js");

function createMockRes(): Response {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as any;
}

describe("Product Admin RBAC Controller - Unit Tests", () => {
  const now = new Date("2026-01-01T10:00:00.000Z");

  const superAdmin = {
    id: "super-1",
    email: "super.admin@example.com",
    name: "Super Admin",
    role: "product_admin",
    phone: null,
    collegeId: null,
    createdAt: now,
    updatedAt: now,
  };

  const collegeAdmin = {
    id: "admin-1",
    email: "college.admin@example.com",
    name: "College Admin",
    role: "college_admin",
    phone: null,
    collegeId: "college-1",
    createdAt: now,
    updatedAt: now,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(prisma.user.findMany).mockResolvedValue([superAdmin, collegeAdmin] as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(collegeAdmin as any);
    vi.mocked(prisma.user.update).mockResolvedValue(superAdmin as any);

    vi.mocked(prisma.college.findUnique).mockResolvedValue({
      id: "college-1",
      name: "CodeEthnics College",
      code: "CEC",
    } as any);
  });

  it("getAllAdmins returns admin list", async () => {
    const req = { user: { userId: "super-1", role: "product_admin" } } as any;
    const res = createMockRes();

    await getAllAdmins(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(prisma.user.findMany).toHaveBeenCalled();
  });

  it("getAdminDetails returns details and permissions", async () => {
    const req = { params: { adminId: "admin-1" } } as any;
    const res = createMockRes();

    await getAdminDetails(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("promoteAdmin promotes target admin", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(collegeAdmin as any);
    vi.mocked(prisma.user.update).mockResolvedValueOnce({ ...collegeAdmin, role: "product_admin", collegeId: null } as any);

    const req = {
      user: { userId: "super-1", role: "product_admin" },
      body: { adminId: "admin-1", newRole: "product_admin" },
    } as any;
    const res = createMockRes();

    await promoteAdmin(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("demoteAdmin demotes super admin to college admin", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(superAdmin as any);
    vi.mocked(prisma.user.update).mockResolvedValueOnce({ ...superAdmin, role: "college_admin", collegeId: "college-1" } as any);

    const req = {
      user: { userId: "super-1", role: "product_admin" },
      body: { adminId: "super-1", collegeId: "college-1" },
    } as any;
    const res = createMockRes();

    await demoteAdmin(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("getRolePermissions returns role permissions", async () => {
    const req = { params: { role: "product_admin" } } as any;
    const res = createMockRes();

    await getRolePermissions(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("getMyPermissions returns current user permissions", async () => {
    const req = { user: { userId: "admin-1", role: "college_admin" } } as any;
    const res = createMockRes();

    await getMyPermissions(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });
});

