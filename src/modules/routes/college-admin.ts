import { Router, type Request, type Response, type Router as RouterType } from "express";
import multer from "multer";
import { z } from "zod";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { requireCollegeAdminAuth, requireRole } from "../../middleware/auth.js";
import type { AuthRequest } from "../../middleware/auth.js";
import { auth, prisma } from "../../config/auth.js";
import { prisma as appPrisma } from "../../config/prisma.js";
import {
  generateAndStoreOTP,
  sendOTPEmail,
  hashPassword,
  validateOTP,
  verifyOTP,
  issueTokens,
  verifyRefreshToken,
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  accessCookieOptions,
  refreshCookieOptions,
  clearCookieOptions,
} from "../auth/auth.service.js";
import { UserService } from "../services/userService.js";
import { DepartmentService } from "../services/departmentService.js";
import { BatchService } from "../services/batchService.js";
import { TestService } from "../services/testService.js";
import { reportService } from "../services/reportService.js";
import { dashboardService } from "../services/dashboardService.js";
import { parseAvatarUpload } from "../../middleware/avatarUpload.js";
import { uploadAvatarToS3 } from "../../utils/avatarUpload.js";
import { TestStatus } from "../../generated/prisma/client.js";
import type { Role } from "../../generated/prisma/client.js";

const router: RouterType = Router();
const requireAuth = requireCollegeAdminAuth;
const isProd = process.env.NODE_ENV === "production";

let betterAuthAccountColumnsReady = false;
let betterAuthAccountColumnsEnsurePromise: Promise<void> | null = null;

const collegeAdminRefreshCookiePath = "/api/college-admin/auth/refresh-token";

const collegeAdminRefreshCookieOptions = {
  ...refreshCookieOptions,
  path: collegeAdminRefreshCookiePath,
};

function setCollegeAdminJwtCookies(res: Response, accessToken: string, refreshToken: string): void {
  res.cookie(ACCESS_TOKEN_COOKIE, accessToken, accessCookieOptions);
  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, collegeAdminRefreshCookieOptions);
}

function clearCollegeAdminJwtCookies(res: Response): void {
  res.clearCookie(ACCESS_TOKEN_COOKIE, clearCookieOptions);
  res.clearCookie(REFRESH_TOKEN_COOKIE, { ...clearCookieOptions, path: collegeAdminRefreshCookiePath });
}

function getBetterAuthErrorMessage(value: unknown): string | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const maybeError = (value as { error?: { message?: string } }).error;
  if (maybeError && typeof maybeError.message === "string") {
    return maybeError.message;
  }

  if ("message" in value && typeof (value as { message?: unknown }).message === "string") {
    return (value as { message: string }).message;
  }

  return undefined;
}

function isBetterAuthAccountColumnDriftError(message: string | undefined): boolean {
  if (!message) {
    return false;
  }

  return (
    message.includes("prisma.account.create()") &&
    message.includes("account.accessTokenExpiresAt") &&
    message.includes("does not exist")
  );
}

async function ensureBetterAuthAccountExpiryColumns(): Promise<void> {
  if (betterAuthAccountColumnsReady) {
    return;
  }

  if (!betterAuthAccountColumnsEnsurePromise) {
    betterAuthAccountColumnsEnsurePromise = (async () => {
      await prisma.$executeRawUnsafe(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = current_schema()
              AND table_name = 'account'
          ) THEN
            ALTER TABLE "account"
              ADD COLUMN IF NOT EXISTS "accessTokenExpiresAt" TIMESTAMP(3),
              ADD COLUMN IF NOT EXISTS "refreshTokenExpiresAt" TIMESTAMP(3);
          END IF;
        END $$;
      `);

      betterAuthAccountColumnsReady = true;
    })().finally(() => {
      betterAuthAccountColumnsEnsurePromise = null;
    });
  }

  await betterAuthAccountColumnsEnsurePromise;
}

async function signUpEmailWithDriftRecovery(body: { email: string; password: string; name: string }): Promise<any> {
  try {
    const response = await auth.api.signUpEmail({ body } as any);
    const responseErrorMessage = getBetterAuthErrorMessage(response);

    if (!isBetterAuthAccountColumnDriftError(responseErrorMessage)) {
      return response;
    }

    await ensureBetterAuthAccountExpiryColumns();
    return await auth.api.signUpEmail({ body } as any);
  } catch (error: any) {
    if (!isBetterAuthAccountColumnDriftError(error?.message)) {
      throw error;
    }

    await ensureBetterAuthAccountExpiryColumns();
    return await auth.api.signUpEmail({ body } as any);
  }
}

// ─── Validation Schemas ─────────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

const forgotPasswordSchema = z.object({
  email: z.string().regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email address"),
});

const resetPasswordSchema = z.object({
  email: z.string().regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email address"),
  otp: z.string().length(6, "OTP must be 6 digits"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128, "Password too long"),
});

const verifyOtpSchema = z.object({
  email: z.string().regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email address"),
  otp: z.string().length(6, "OTP must be 6 digits"),
});

const updateProfileSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long").optional(),
  image: z.string().regex(/^https?:\/\/.+/, "Invalid image URL").optional(),
});

// ─── User Management Validation Schemas ─────────────────────────────────────────

const createUserSchema = z.object({
  email: z.string().regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128, "Password too long"),
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  role: z.enum(["student", "mentor", "instructor_staff", "dept_admin", "hod", "principal", "college_admin"], {
    message: "Invalid role",
  }),
  phone: z.string().optional(),
  departmentId: z.string().nullable().optional(), // Optional for HOD creation without immediate department assignment
  collegeId: z.string().nullable().optional(),
});

const bulkUsersSchema = z.object({
  users: z.array(createUserSchema).min(1, "At least one user is required").max(100, "Maximum 100 users per batch"),
});

const updateUserSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long").optional(),
  phone: z.string().optional(),
  image: z.string().regex(/^https?:\/\/.+/, "Invalid image URL").optional(),
  role: z.enum(["student", "mentor", "instructor_staff", "dept_admin", "hod", "principal"]).optional(),
  departmentId: z.string().nullable().optional(),
});

const assignRoleSchema = z.object({
  role: z.enum(["student", "mentor", "instructor_staff", "dept_admin", "hod", "principal"], {
    message: "Invalid role",
  }),
});

const assignDepartmentSchema = z.object({
  departmentId: z.string().nullable(),
});

// ─── Department Validation Schemas ──────────────────────────────────────────────

const createDepartmentSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  code: z.string().min(2, "Code must be at least 2 characters").max(10, "Code too long"),
  collegeId: z.string().optional(),
  description: z.string().optional(),
  hodId: z.string().nullable().optional(), // Optional: HOD can be assigned later
});

const updateDepartmentSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long").optional(),
  code: z.string().min(2, "Code must be at least 2 characters").max(10, "Code too long").optional(),
  description: z.string().optional(),
  hodId: z.string().nullable().optional(), // Can be null to unassign HOD
});

// ─── Batch Validation Schemas ───────────────────────────────────────────────────

const createBatchSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  code: z.string().min(2, "Code must be at least 2 characters").max(20, "Code too long"),
  year: z.number().int("Year must be an integer").min(1, "Year must be at least 1").max(4, "Year must be at most 4"),
  semester: z.number().int("Semester must be an integer").min(1, "Semester must be at least 1").max(8, "Semester must be at most 8").optional(),
  departmentId: z.string().min(1, "Department ID is required"),
  mentorId: z.string().optional(),
});

const updateBatchSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long").optional(),
  code: z.string().min(2, "Code must be at least 2 characters").max(20, "Code too long").optional(),
  year: z.number().int("Year must be an integer").min(1, "Year must be at least 1").max(4, "Year must be at most 4").optional(),
  semester: z.number().int("Semester must be an integer").min(1, "Semester must be at least 1").max(8, "Semester must be at most 8").optional(),
  mentorId: z.string().optional(),
});

const assignStudentsToBatchSchema = z.object({
  studentIds: z.array(z.string()).min(1, "At least one student ID is required").max(100, "Maximum 100 students per batch"),
});

const removeStudentsFromBatchSchema = z.object({
  studentIds: z.array(z.string()).min(1, "At least one student ID is required"),
});

const assignMentorToBatchSchema = z.object({
  mentorId: z.string().min(1, "Mentor ID is required"),
});

const assignMentorToStudentsSchema = z.object({
  mentorId: z.string().min(1, "Mentor ID is required"),
  studentIds: z.array(z.string().min(1, "Student ID is required")).min(1, "At least one student ID is required"),
});

// ─── Student Management Validation Schemas ──────────────────────────────────────

const createStudentSchema = z.object({
  email: z.string().regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128, "Password too long"),
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  phone: z.string().optional(),
  collegeId: z.string().optional(),
  departmentId: z.string().optional(),
  batchId: z.string().optional(),
});

const bulkStudentsSchema = z.object({
  students: z.array(createStudentSchema).min(1, "At least one student is required").max(100, "Maximum 100 students per batch"),
});

const updateStudentSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long").optional(),
  phone: z.string().optional(),
  departmentId: z.string().nullable().optional(),
  batchId: z.string().nullable().optional(),
});

const mentorStudentsQuerySchema = z.object({
  page: z
    .preprocess((val) => (val === undefined ? undefined : Number(val)), z.number().int().min(1).optional()),
  limit: z
    .preprocess((val) => (val === undefined ? undefined : Number(val)), z.number().int().min(1).max(100).optional()),
});

// ─── Helper Functions ───────────────────────────────────────────────────────────

/**
 * Validate permissions for user update operations
 */
function validateUserUpdatePermissions(
  currentUser: any,
  targetUser: any,
  updateData: any
): { allowed: boolean; error?: string } {
  if (currentUser.role === "hod" || currentUser.role === "dept_admin") {
    // Check department access
    if (targetUser.departmentId !== currentUser.departmentId) {
      return { allowed: false, error: "You can only update users in your own department" };
    }

    // Check target role restrictions
    const restrictedRoles = new Set(["principal", "college_admin", "hod"]);
    if (restrictedRoles.has(targetUser.role)) {
      return { allowed: false, error: "You do not have permission to update this user" };
    }

    // Check role assignment restrictions
    if (updateData.role && restrictedRoles.has(updateData.role)) {
      return { allowed: false, error: `You do not have permission to assign role: ${updateData.role}` };
    }

    // Check department change restrictions
    if (updateData.departmentId !== undefined && updateData.departmentId !== targetUser.departmentId) {
      return { allowed: false, error: "You do not have permission to change user's department" };
    }
  }

  return { allowed: true };
}

/**
 * Validate department and batch for student creation
 */
async function validateStudentDepartmentAndBatch(
  departmentId: string | undefined,
  batchId: string | undefined
): Promise<{ valid: boolean; error?: string }> {
  if (departmentId) {
    const department = await prisma.department.findUnique({
      where: { id: departmentId },
    });

    if (!department) {
      return { valid: false, error: "Department not found" };
    }
  }

  if (batchId) {
    const batch = await prisma.batch.findUnique({
      where: { id: batchId },
      include: { department: true },
    });

    if (!batch) {
      return { valid: false, error: "Batch not found" };
    }

    if (departmentId && batch.departmentId !== departmentId) {
      return { valid: false, error: "Batch does not belong to the specified department" };
    }
  }

  return { valid: true };
}

/**
 * Check department permissions for bulk student creation
 */
function checkBulkDepartmentPermissions(
  students: any[],
  currentUser: any
): { valid: boolean; error?: string } {
  if (["hod", "dept_admin"].includes(currentUser.role)) {
    if (!currentUser.departmentId) {
      return { valid: false, error: "User must have a department assigned" };
    }

    const invalidStudents = students.filter(
      (student) => student.departmentId && student.departmentId !== currentUser.departmentId
    );

    if (invalidStudents.length > 0) {
      return { valid: false, error: "You can only create students in your own department" };
    }
  }

  return { valid: true };
}

/**
 * Verify departments exist for bulk creation
 */
async function verifyDepartments(
  students: any[]
): Promise<{ valid: boolean; error?: string }> {
  const departmentIds = [...new Set(students.map((s) => s.departmentId).filter(Boolean))];
  if (departmentIds.length > 0) {
    const departments = await prisma.department.findMany({
      where: { id: { in: departmentIds as string[] } },
    });

    if (departments.length !== departmentIds.length) {
      return { valid: false, error: "One or more departments not found" };
    }
  }

  return { valid: true };
}

/**
 * Verify batches exist and belong to correct departments
 */
async function verifyBatches(
  students: any[]
): Promise<{ valid: boolean; error?: string }> {
  const batchIds = [...new Set(students.map((s) => s.batchId).filter(Boolean))];
  if (batchIds.length === 0) {
    return { valid: true };
  }

  const batches = await prisma.batch.findMany({
    where: { id: { in: batchIds as string[] } },
    include: { department: true },
  });

  if (batches.length !== batchIds.length) {
    return { valid: false, error: "One or more batches not found" };
  }

  // Verify batch-department consistency
  for (const student of students) {
    if (student.batchId && student.departmentId) {
      const batch = batches.find((b: any) => b.id === student.batchId);
      if (batch && batch.departmentId !== student.departmentId) {
        return {
          valid: false,
          error: `Batch ${batch.name} does not belong to the specified department`,
        };
      }
    }
  }

  return { valid: true };
}

/**
 * Verify departments and batches exist for bulk creation
 */
async function verifyDepartmentsAndBatches(
  students: any[]
): Promise<{ valid: boolean; error?: string }> {
  // Verify departments
  const deptCheck = await verifyDepartments(students);
  if (!deptCheck.valid) {
    return deptCheck;
  }

  // Verify batches
  return await verifyBatches(students);
}

/**
 * Check for duplicate and existing emails
 */
async function checkDuplicateAndExistingEmails(
  students: any[]
): Promise<{ valid: boolean; error?: string; details?: any }> {
  const emails = students.map((s) => s.email);
  
  // Check for duplicates in request
  const duplicateEmails = emails.filter((email, index) => emails.indexOf(email) !== index);
  if (duplicateEmails.length > 0) {
    return {
      valid: false,
      error: "Duplicate emails found in request",
      details: [...new Set(duplicateEmails)],
    };
  }

  // Check existing users in database
  const existingUsers = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { email: true },
  });

  if (existingUsers.length > 0) {
    return {
      valid: false,
      error: "One or more users already exist",
      details: existingUsers.map((u: any) => u.email),
    };
  }

  return { valid: true };
}

/**
 * Validate bulk student data before creation
 */
async function validateBulkStudentData(
  students: any[],
  currentUser: any
): Promise<{ valid: boolean; error?: string; details?: any }> {
  // Check permissions
  const permissionCheck = checkBulkDepartmentPermissions(students, currentUser);
  if (!permissionCheck.valid) {
    return permissionCheck;
  }

  // Verify departments and batches exist
  const deptBatchCheck = await verifyDepartmentsAndBatches(students);
  if (!deptBatchCheck.valid) {
    return deptBatchCheck;
  }

  // Check emails
  return await checkDuplicateAndExistingEmails(students);
}

/**
 * Create a single student account
 */
async function createSingleStudentAccount(
  studentData: any,
  currentUser: any
): Promise<{ success: boolean; student?: any; error?: string }> {
  try {
    if (
      currentUser.role !== "super_admin" &&
      currentUser.collegeId &&
      studentData.collegeId &&
      currentUser.collegeId !== studentData.collegeId
    ) {
      return {
        success: false,
        error: "You can only create students for your own college",
      };
    }

    const resolvedCollegeId =
      currentUser.role === "super_admin"
        ? studentData.collegeId || null
        : studentData.collegeId || currentUser.collegeId || null;

    if (!resolvedCollegeId) {
      return {
        success: false,
        error: "collegeId is required to create student",
      };
    }

    // Create student using Better Auth
    const signUpResult = await signUpEmailWithDriftRecovery({
      body: {
        email: studentData.email,
        password: studentData.password,
        name: studentData.name,
      },
    } as any);

    const signUpError = (signUpResult as any)?.error;
    const createdUserId = (signUpResult as any)?.user?.id as string | undefined;
    if (!signUpResult || signUpError) {
      return { success: false, error: "Failed to create account" };
    }

    let targetUserId = createdUserId;
    if (!targetUserId) {
      const createdUser = await prisma.user.findUnique({
        where: { email: String(studentData.email).trim().toLowerCase() },
        select: { id: true },
      });
      targetUserId = createdUser?.id;
    }

    if (!targetUserId) {
      return { success: false, error: "Student account was created but could not be finalized" };
    }

    const passwordHash = await hashPassword(studentData.password);

    // Determine departmentId
    const departmentId = studentData.departmentId || 
      (["hod", "dept_admin"].includes(currentUser.role) ? currentUser.departmentId : null);

    // Update the user with additional fields
    const student = await prisma.user.update({
      where: { id: targetUserId },
      data: {
        passwordHash,
        role: "student",
        emailVerified: true,
        phone: studentData.phone || null,
        collegeId: resolvedCollegeId,
        departmentId,
        batchId: studentData.batchId || null,
      },
      include: {
        department: true,
        batch: true,
      },
    });

    return { success: true, student };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to create student" };
  }
}

function getRequestedCollegeId(req: AuthRequest): string | undefined {
  const queryCollegeId =
    typeof req.query?.collegeId === "string" ? req.query.collegeId : undefined;
  const bodyCollegeId =
    req.body && typeof req.body === "object" && !Array.isArray(req.body)
      ? (req.body as Record<string, unknown>).collegeId
      : undefined;

  return typeof bodyCollegeId === "string" ? bodyCollegeId : queryCollegeId;
}

async function getResourceCollegeId(pathname: string): Promise<string | null | undefined> {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return undefined;

  if ((segments[0] === "users" || segments[0] === "students") && segments[1] && segments[1] !== "bulk") {
    const user = await prisma.user.findUnique({
      where: { id: segments[1] },
      select: { collegeId: true },
    });
    return user?.collegeId ?? null;
  }

  if (segments[0] === "departments" && segments[1]) {
    const department = await prisma.department.findUnique({
      where: { id: segments[1] },
      select: { collegeId: true },
    });
    return department?.collegeId ?? null;
  }

  if (segments[0] === "batches" && segments[1]) {
    const batch = await prisma.batch.findUnique({
      where: { id: segments[1] },
      select: {
        department: {
          select: {
            collegeId: true,
          },
        },
      },
    });
    return batch?.department?.collegeId ?? null;
  }

  if (segments[0] === "tests" && segments[1]) {
    const test = await prisma.test.findUnique({
      where: { id: segments[1] },
      select: {
        department: {
          select: {
            collegeId: true,
          },
        },
        batch: {
          select: {
            department: {
              select: {
                collegeId: true,
              },
            },
          },
        },
      },
    });
    return test?.department?.collegeId || test?.batch?.department?.collegeId || null;
  }

  if (segments[0] === "report" && segments[1] && segments[2]) {
    if (segments[1] === "student") {
      const student = await prisma.user.findUnique({
        where: { id: segments[2] },
        select: { collegeId: true },
      });
      return student?.collegeId ?? null;
    }

    if (segments[1] === "batch") {
      const batch = await prisma.batch.findUnique({
        where: { id: segments[2] },
        select: {
          department: {
            select: {
              collegeId: true,
            },
          },
        },
      });
      return batch?.department?.collegeId ?? null;
    }

    if (segments[1] === "test") {
      const test = await prisma.test.findUnique({
        where: { id: segments[2] },
        select: {
          department: {
            select: {
              collegeId: true,
            },
          },
          batch: {
            select: {
              department: {
                select: {
                  collegeId: true,
                },
              },
            },
          },
        },
      });
      return test?.department?.collegeId || test?.batch?.department?.collegeId || null;
    }

    if (segments[1] === "department") {
      const department = await prisma.department.findUnique({
        where: { id: segments[2] },
        select: { collegeId: true },
      });
      return department?.collegeId ?? null;
    }
  }

  return undefined;
}

async function enforceCollegeScope(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (req.path.startsWith("/auth/")) {
      next();
      return;
    }

    const requestedCollegeId = getRequestedCollegeId(req);
    const userCollegeId = req.user?.collegeId || undefined;

    if (requestedCollegeId && userCollegeId && requestedCollegeId !== userCollegeId) {
      res.status(403).json({
        error: "You can only access data for your own college",
      });
      return;
    }

    const effectiveCollegeId = requestedCollegeId || userCollegeId;
    if (!effectiveCollegeId) {
      res.status(400).json({
        error: "collegeId is required",
      });
      return;
    }

    if (req.user) {
      req.user.collegeId = effectiveCollegeId;
    }

    if (typeof req.query === "object" && req.query !== null && !("collegeId" in req.query)) {
      (req.query as Record<string, unknown>).collegeId = effectiveCollegeId;
    }

    if (
      req.body &&
      typeof req.body === "object" &&
      !Array.isArray(req.body) &&
      (req.body as Record<string, unknown>).collegeId === undefined
    ) {
      (req.body as Record<string, unknown>).collegeId = effectiveCollegeId;
    }

    if (req.body && typeof req.body === "object" && !Array.isArray(req.body)) {
      const payload = req.body as Record<string, unknown>;

      if (typeof payload.departmentId === "string") {
        const department = await prisma.department.findUnique({
          where: { id: payload.departmentId },
          select: { collegeId: true },
        });

        if (!department || department.collegeId !== effectiveCollegeId) {
          res.status(403).json({
            error: "departmentId does not belong to the requested college",
          });
          return;
        }
      }

      if (typeof payload.batchId === "string") {
        const batch = await prisma.batch.findUnique({
          where: { id: payload.batchId },
          select: {
            department: {
              select: {
                collegeId: true,
              },
            },
          },
        });

        if (!batch || batch.department.collegeId !== effectiveCollegeId) {
          res.status(403).json({
            error: "batchId does not belong to the requested college",
          });
          return;
        }
      }
    }

    const resourceCollegeId = await getResourceCollegeId(req.path);
    if (resourceCollegeId && resourceCollegeId !== effectiveCollegeId) {
      res.status(403).json({
        error: "Resource belongs to a different college",
      });
      return;
    }

    const originalJson = res.json.bind(res);
    res.json = ((body: any) => {
      if (body && typeof body === "object" && !Array.isArray(body)) {
        if (body.collegeId === undefined) {
          body.collegeId = effectiveCollegeId;
        }
        if (body.user && typeof body.user === "object" && body.user.collegeId === undefined) {
          body.user.collegeId = effectiveCollegeId;
        }
      }
      return originalJson(body);
    }) as Response["json"];

    next();
  } catch (error) {
    console.error("[college-admin/college-scope] Error:", error);
    res.status(500).json({
      error: "Failed to enforce college scope",
    });
  }
}

// ─── Authentication Endpoints ───────────────────────────────────────────────────

/**
 * @openapi
 * /api/college-admin/auth/login:
 *   post:
 *     tags: [College Admin - Auth]
 *     summary: College admin login
 *     description: Authenticates a college-admin portal user through Better Auth.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: citadmin@codeethnics.com
 *               password:
 *                 type: string
 *                 example: CitAdmin@123
 *     responses:
 *       "200":
 *         description: Login successful
 *       "400":
 *         description: Validation failed
 *       "401":
 *         description: Invalid credentials
 *       "403":
 *         description: Role not allowed for college-admin portal
 *
 * /api/college-admin/auth/logout:
 *   post:
 *     tags: [College Admin - Auth]
 *     summary: College admin logout
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       "200":
 *         description: Logout successful
 *       "401":
 *         description: Not authenticated
 *
 * /api/college-admin/auth/refresh-token:
 *   post:
 *     tags: [College Admin - Auth]
 *     summary: Refresh current college-admin session
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       "200":
 *         description: Session refreshed
 *       "401":
 *         description: Session missing or expired
 *
 * /api/college-admin/auth/forgot-password:
 *   post:
 *     tags: [College Admin - Auth]
 *     summary: Request college-admin password reset OTP
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: superadmin@codeethnics.com
 *     responses:
 *       "200":
 *         description: Password reset request accepted
 *       "403":
 *         description: User role not allowed for this portal
 *
 * /api/college-admin/auth/verify-otp:
 *   post:
 *     tags: [College Admin - Auth]
 *     summary: Verify password reset OTP for college-admin
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, otp]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: superadmin@codeethnics.com
 *               otp:
 *                 type: string
 *                 description: OTP sent to email
 *                 example: "123456"
 *     responses:
 *       "200":
 *         description: OTP is valid
 *       "400":
 *         description: Invalid or expired OTP
 *       "403":
 *         description: User role not allowed for this portal
 *
 * /api/college-admin/auth/reset-password:
 *   put:
 *     tags: [College Admin - Auth]
 *     summary: Reset college-admin password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, otp, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: superadmin@codeethnics.com
 *               otp:
 *                 type: string
 *                 description: OTP sent to email
 *                 example: "123456"
 *               password:
 *                 type: string
 *                 example: NewPass@123
 *     responses:
 *       "200":
 *         description: Password reset successful
 *       "400":
 *         description: Validation failed or user not allowed
 *
 * /api/college-admin/profile:
 *   get:
 *     tags: [College Admin - Auth]
 *     summary: Get authenticated college-admin profile
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       "200":
 *         description: Profile returned
 *       "401":
 *         description: Not authenticated
 *   put:
 *     tags: [College Admin - Auth]
 *     summary: Update authenticated college-admin profile
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: College Super Admin
 *               image:
 *                 type: string
 *                 format: uri
 *                 example: https://cdn.example.com/avatar.png
 *             additionalProperties: false
 *     responses:
 *       "200":
 *         description: Profile updated
 *       "400":
 *         description: Validation failed
 *
 * /api/college-admin/dashboard:
 *   get:
 *     tags: [College Admin - Performance]
 *     summary: Get role-based college-admin dashboard data
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *         description: Optional role view override for privileged users.
 *     responses:
 *       "200":
 *         description: Dashboard payload returned
 *       "403":
 *         description: Forbidden for requested role view
 *
 * /api/college-admin/users:
 *   get:
 *     tags: [College Admin - Students]
 *     summary: List users with filters
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [student, mentor, instructor_staff, dept_admin, hod, principal, college_admin]
 *         description: Filter by role
 *       - in: query
 *         name: departmentId
 *         schema:
 *           type: string
 *         description: Filter by department
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name or email
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number (1-based)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Page size
 *     responses:
 *       "200":
 *         description: Users list returned
 *   post:
 *     tags: [College Admin - Students]
 *     summary: Create a user
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, name, role]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: principal1@college.edu
 *               password:
 *                 type: string
 *                 example: StrongPass@123
 *               name:
 *                 type: string
 *                 example: Principal User
 *               role:
 *                 type: string
 *                 enum: [student, mentor, instructor_staff, dept_admin, hod, principal, college_admin]
 *                 example: principal
 *               phone:
 *                 type: string
 *                 example: "+1-555-123-4567"
 *               departmentId:
 *                 type: string
 *                 example: dept_123
 *               collegeId:
 *                 type: string
 *                 nullable: true
 *                 example: college_123
 *             additionalProperties: false
 *     responses:
 *       "201":
 *         description: User created
 *       "400":
 *         description: Validation or creation failure
 *
 * /api/college-admin/users/bulk:
 *   post:
 *     tags: [College Admin - Students]
 *     summary: Create users in bulk
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [users]
 *             properties:
 *               users:
 *                 type: array
 *                 minItems: 1
 *                 maxItems: 100
 *                 items:
 *                   type: object
 *                   required: [email, password, name, role]
 *                   properties:
 *                     email:
 *                       type: string
 *                       format: email
 *                       example: mentor1@college.edu
 *                     password:
 *                       type: string
 *                       example: StrongPass@123
 *                     name:
 *                       type: string
 *                       example: Mentor User
 *                     role:
 *                       type: string
 *                       enum: [student, mentor, instructor_staff, dept_admin, hod, principal, college_admin]
 *                       example: mentor
 *                     phone:
 *                       type: string
 *                       example: "+1-555-987-6543"
 *                     departmentId:
 *                       type: string
 *                       example: dept_123
 *                     collegeId:
 *                       type: string
 *                       nullable: true
 *                       example: college_123
 *                   additionalProperties: false
 *             additionalProperties: false
 *     responses:
 *       "201":
 *         description: Bulk create processed
 *
 * /api/college-admin/users/{userId}:
 *   get:
 *     tags: [College Admin - Students]
 *     summary: Get user by id
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       "200":
 *         description: User returned
 *       "404":
 *         description: User not found
 *   put:
 *     tags: [College Admin - Students]
 *     summary: Update user by id
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Updated Name
 *               phone:
 *                 type: string
 *                 example: "+1-555-000-1111"
 *               image:
 *                 type: string
 *                 format: uri
 *                 example: https://cdn.example.com/avatar.png
 *               role:
 *                 type: string
 *                 enum: [student, mentor, instructor_staff, dept_admin, hod, principal]
 *                 example: mentor
 *               departmentId:
 *                 type: string
 *                 nullable: true
 *                 example: dept_456
 *             additionalProperties: false
 *     responses:
 *       "200":
 *         description: User updated
 *   delete:
 *     tags: [College Admin - Students]
 *     summary: Delete user by id
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       "200":
 *         description: User deleted
 *
 * /api/college-admin/users/{userId}/assign-role:
 *   put:
 *     tags: [College Admin - Students]
 *     summary: Assign role to user
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role]
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [student, mentor, instructor_staff, dept_admin, hod, principal]
 *                 example: mentor
 *             additionalProperties: false
 *     responses:
 *       "200":
 *         description: Role assigned
 *       "400":
 *         description: Validation failed
 *
 * /api/college-admin/users/{userId}/assign-department:
 *   put:
 *     tags: [College Admin - Students]
 *     summary: Assign department to user
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [departmentId]
 *             properties:
 *               departmentId:
 *                 type: string
 *                 nullable: true
 *                 example: dept_123
 *             additionalProperties: false
 *     responses:
 *       "200":
 *         description: Department assigned
 *       "400":
 *         description: Validation failed
 *
 * /api/college-admin/departments:
 *   get:
 *     tags: [College Admin - Departments]
 *     summary: List departments
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       "200":
 *         description: Departments returned
 *   post:
 *     tags: [College Admin - Departments]
 *     summary: Create department
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, code]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Computer Science
 *               code:
 *                 type: string
 *                 example: CSE
 *               description:
 *                 type: string
 *                 example: CS department description
 *               hodId:
 *                 type: string
 *                 example: user_hod_123
 *             additionalProperties: false
 *     responses:
 *       "201":
 *         description: Department created
 *
 * /api/college-admin/departments/{deptId}:
 *   get:
 *     tags: [College Admin - Departments]
 *     summary: Get department by id
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: deptId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       "200":
 *         description: Department returned
 *       "404":
 *         description: Department not found
 *   put:
 *     tags: [College Admin - Departments]
 *     summary: Update department by id
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: deptId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Updated Department Name
 *               code:
 *                 type: string
 *                 example: CSE-NEW
 *               description:
 *                 type: string
 *                 example: Updated description
 *               hodId:
 *                 type: string
 *                 nullable: true
 *                 example: user_hod_123
 *             additionalProperties: false
 *     responses:
 *       "200":
 *         description: Department updated
 *   delete:
 *     tags: [College Admin - Departments]
 *     summary: Delete department by id
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: deptId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       "200":
 *         description: Department deleted
 *
 * /api/college-admin/batches:
 *   post:
 *     tags: [College Admin - Batches]
 *     summary: Create batch
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, code, year, departmentId]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Batch 2024
 *               code:
 *                 type: string
 *                 example: B24
 *               year:
 *                 type: integer
 *                 example: 2
 *               semester:
 *                 type: integer
 *                 example: 3
 *               departmentId:
 *                 type: string
 *                 example: dept_123
 *               mentorId:
 *                 type: string
 *                 example: user_mentor_123
 *             additionalProperties: false
 *     responses:
 *       "201":
 *         description: Batch created
 *   get:
 *     tags: [College Admin - Batches]
 *     summary: List batches
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: departmentId
 *         schema:
 *           type: string
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *       - in: query
 *         name: semester
 *         schema:
 *           type: integer
 *       - in: query
 *         name: mentorId
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       "200":
 *         description: Batches returned
 *
 * /api/college-admin/batches/{batchId}:
 *   get:
 *     tags: [College Admin - Batches]
 *     summary: Get batch by id
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: batchId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       "200":
 *         description: Batch returned
 *   put:
 *     tags: [College Admin - Batches]
 *     summary: Update batch by id
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: batchId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Updated Batch Name
 *               code:
 *                 type: string
 *                 example: B24-NEW
 *               year:
 *                 type: integer
 *                 example: 3
 *               semester:
 *                 type: integer
 *                 example: 5
 *               mentorId:
 *                 type: string
 *                 example: user_mentor_123
 *             additionalProperties: false
 *   delete:
 *     tags: [College Admin - Batches]
 *     summary: Delete batch by id
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: batchId
 *         required: true
 *         schema:
 *           type: string
 *
 * /api/college-admin/students:
 *   post:
 *     tags: [College Admin - Students]
 *     summary: Create a student
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, name]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: student1@college.edu
 *               password:
 *                 type: string
 *                 example: StrongPass@123
 *               name:
 *                 type: string
 *                 example: Student User
 *               phone:
 *                 type: string
 *                 example: "+1-555-222-3333"
 *               departmentId:
 *                 type: string
 *                 example: dept_123
 *               batchId:
 *                 type: string
 *                 example: batch_123
 *             additionalProperties: false
 *   get:
 *     tags: [College Admin - Students]
 *     summary: List students
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: departmentId
 *         schema:
 *           type: string
 *       - in: query
 *         name: batchId
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *
 * /api/college-admin/students/bulk:
 *   post:
 *     tags: [College Admin - Students]
 *     summary: Bulk create students
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [students]
 *             properties:
 *               students:
 *                 type: array
 *                 minItems: 1
 *                 maxItems: 100
 *                 items:
 *                   type: object
 *                   required: [email, password, name]
 *                   properties:
 *                     email:
 *                       type: string
 *                       format: email
 *                       example: student1@college.edu
 *                     password:
 *                       type: string
 *                       example: StrongPass@123
 *                     name:
 *                       type: string
 *                       example: Student User
 *                     phone:
 *                       type: string
 *                       example: "+1-555-222-3333"
 *                     departmentId:
 *                       type: string
 *                       example: dept_123
 *                     batchId:
 *                       type: string
 *                       example: batch_123
 *                   additionalProperties: false
 *             additionalProperties: false
 *
 * /api/college-admin/students/{studentId}:
 *   get:
 *     tags: [College Admin - Students]
 *     summary: Get student by id
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema:
 *           type: string
 *   put:
 *     tags: [College Admin - Students]
 *     summary: Update student by id
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Updated Student Name
 *               phone:
 *                 type: string
 *                 example: "+1-555-999-8888"
 *               departmentId:
 *                 type: string
 *                 nullable: true
 *                 example: dept_456
 *               batchId:
 *                 type: string
 *                 nullable: true
 *                 example: batch_456
 *             additionalProperties: false
 *   delete:
 *     tags: [College Admin - Students]
 *     summary: Delete student by id
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema:
 *           type: string
 *
 * /api/college-admin/tests:
 *   post:
 *     tags: [College Admin - Tests]
 *     summary: Create a test
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title:
 *                 type: string
 *                 example: Midterm Assessment
 *               description:
 *                 type: string
 *                 example: Covers first 5 chapters
 *               instructions:
 *                 type: string
 *                 example: Read all questions carefully
 *               durationMinutes:
 *                 type: integer
 *                 example: 90
 *               maxAttempts:
 *                 type: integer
 *                 example: 1
 *               passingMarks:
 *                 type: integer
 *                 example: 40
 *               scheduledStartTime:
 *                 type: string
 *                 format: date-time
 *                 example: 2024-08-01T10:00:00Z
 *               scheduledEndTime:
 *                 type: string
 *                 format: date-time
 *                 example: 2024-08-01T12:00:00Z
 *               departmentId:
 *                 type: string
 *                 example: dept_123
 *               batchId:
 *                 type: string
 *                 example: batch_123
 *             additionalProperties: false
 *   get:
 *     tags: [College Admin - Tests]
 *     summary: List tests
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, scheduledStartTime, title]
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, scheduled, active, completed, archived]
 *       - in: query
 *         name: departmentId
 *         schema:
 *           type: string
 *       - in: query
 *         name: batchId
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: timeFilter
 *         schema:
 *           type: string
 *           enum: [upcoming, active, past, all]
 *
 * /api/college-admin/tests/{testId}:
 *   get:
 *     tags: [College Admin - Tests]
 *     summary: Get test by id
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: testId
 *         required: true
 *         schema:
 *           type: string
 *   put:
 *     tags: [College Admin - Tests]
 *     summary: Update test by id
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: testId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 example: Updated Test Title
 *               description:
 *                 type: string
 *                 example: Updated description
 *               instructions:
 *                 type: string
 *                 example: Updated instructions
 *               status:
 *                 type: string
 *                 enum: [draft, scheduled, active, completed, archived]
 *               durationMinutes:
 *                 type: integer
 *                 example: 120
 *               maxAttempts:
 *                 type: integer
 *                 example: 2
 *               totalMarks:
 *                 type: integer
 *                 example: 100
 *               passingMarks:
 *                 type: integer
 *                 example: 50
 *               scheduledStartTime:
 *                 type: string
 *                 format: date-time
 *                 example: 2024-08-01T10:00:00Z
 *               scheduledEndTime:
 *                 type: string
 *                 format: date-time
 *                 example: 2024-08-01T12:00:00Z
 *               departmentId:
 *                 type: string
 *                 example: dept_123
 *               batchId:
 *                 type: string
 *                 example: batch_123
 *             additionalProperties: false
 *   delete:
 *     tags: [College Admin - Tests]
 *     summary: Delete test by id
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: testId
 *         required: true
 *         schema:
 *           type: string
 *
 * /api/college-admin/tests/{testId}/questions:
 *   post:
 *     tags: [College Admin - Tests]
 *     summary: Add question to a test
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: testId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type, content, marks]
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [multiple_choice, true_false, short_answer, long_answer, coding]
 *               content:
 *                 type: string
 *                 example: What is 2 + 2?
 *               marks:
 *                 type: integer
 *                 example: 5
 *               options:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["1", "2", "3", "4"]
 *               correctAnswer:
 *                 type: string
 *                 example: 4
 *               explanation:
 *                 type: string
 *                 example: Basic addition
 *               orderIndex:
 *                 type: integer
 *                 example: 1
 *             additionalProperties: false
 *   get:
 *     tags: [College Admin - Tests]
 *     summary: List test questions
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: testId
 *         required: true
 *         schema:
 *           type: string
 *
 * /api/college-admin/tests/{testId}/status:
 *   get:
 *     tags: [College Admin - Tests, College Admin - Performance]
 *     summary: Get real-time test status
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: testId
 *         required: true
 *         schema:
 *           type: string
 *
 * /api/college-admin/report/student/{studentId}:
 *   get:
 *     tags: [College Admin - Reports, College Admin - Performance]
 *     summary: Get student performance report
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema:
 *           type: string
 *
 * /api/college-admin/report/student/{studentId}/skillset:
 *   get:
 *     tags: [College Admin - Reports, College Admin - Performance]
 *     summary: Get student skillset summary
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema:
 *           type: string
 *
 * /api/college-admin/report/batch/{batchId}:
 *   get:
 *     tags: [College Admin - Reports, College Admin - Performance]
 *     summary: Get batch performance report
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: batchId
 *         required: true
 *         schema:
 *           type: string
 *
 * /api/college-admin/report/batch/{batchId}/leaderboard:
 *   get:
 *     tags: [College Admin - Reports, College Admin - Performance]
 *     summary: Get batch leaderboard
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: batchId
 *         required: true
 *         schema:
 *           type: string
 *
 * /api/college-admin/report/test/{testId}/analysis:
 *   get:
 *     tags: [College Admin - Reports, College Admin - Performance]
 *     summary: Get test analysis report
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: testId
 *         required: true
 *         schema:
 *           type: string
 *
 * /api/college-admin/report/department/{departmentId}:
 *   get:
 *     tags: [College Admin - Reports, College Admin - Performance]
 *     summary: Get department performance report
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: departmentId
 *         required: true
 *         schema:
 *           type: string
 *
 * /api/college-admin/avatar:
 *   post:
 *     tags: [College Admin - Auth]
 *     summary: Upload college admin avatar
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       "200":
 *         description: Avatar uploaded successfully
 *
 * /api/college-admin/batches/{batchId}/students:
 *   post:
 *     tags: [College Admin - Batches]
 *     summary: Assign students to batch
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: batchId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [studentIds]
 *             properties:
 *               studentIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       "200":
 *         description: Students assigned
 *   delete:
 *     tags: [College Admin - Batches]
 *     summary: Remove students from batch
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: batchId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [studentIds]
 *             properties:
 *               studentIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       "200":
 *         description: Students removed
 *
 * /api/college-admin/batches/{batchId}/mentor:
 *   put:
 *     tags: [College Admin - Batches]
 *     summary: Assign mentor to batch
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: batchId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [mentorId]
 *             properties:
 *               mentorId:
 *                 type: string
 *     responses:
 *       "200":
 *         description: Mentor assigned
 *   delete:
 *     tags: [College Admin - Batches]
 *     summary: Remove mentor from batch
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: batchId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       "200":
 *         description: Mentor removed
 *
 * /api/college-admin/batches/{batchId}/stats:
 *   get:
 *     tags: [College Admin - Batches]
 *     summary: Get batch statistics
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: batchId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       "200":
 *         description: Batch statistics retrieved
 *
 * /api/college-admin/mentors/{mentorId}/students:
 *   get:
 *     tags: [College Admin - Students]
 *     summary: Get students assigned to a mentor
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: mentorId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       "200":
 *         description: Mentor students retrieved
 *
 * /api/college-admin/students/assign-mentor:
 *   put:
 *     tags: [College Admin - Students]
 *     summary: Assign mentor to specific students
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [mentorId, studentIds]
 *             properties:
 *               mentorId:
 *                 type: string
 *               studentIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       "200":
 *         description: Mentor assigned successfully
 *
 * /api/college-admin/tests/{testId}/questions/{questionId}:
 *   put:
 *     tags: [College Admin - Tests]
 *     summary: Update test question
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: testId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: questionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *               marks:
 *                 type: integer
 *               options:
 *                 type: array
 *                 items:
 *                   type: string
 *               correctAnswer:
 *                 type: string
 *               explanation:
 *                 type: string
 *               orderIndex:
 *                 type: integer
 *     responses:
 *       "200":
 *         description: Question updated
 *   delete:
 *     tags: [College Admin - Tests]
 *     summary: Delete test question
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: testId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: questionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       "200":
 *         description: Question deleted
 *
 * /api/college-admin/tests/{testId}/questions/reorder:
 *   put:
 *     tags: [College Admin - Tests]
 *     summary: Reorder test questions
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: testId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [questionIds]
 *             properties:
 *               questionIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       "200":
 *         description: Questions reordered
 *
 * /api/college-admin/tests/{testId}/assign-batch:
 *   post:
 *     tags: [College Admin - Tests]
 *     summary: Assign test to batch
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: testId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [batchId]
 *             properties:
 *               batchId:
 *                 type: string
 *     responses:
 *       "200":
 *         description: Test assigned to batch
 *
 * /api/college-admin/tests/{testId}/evaluations:
 *   get:
 *     tags: [College Admin - Tests]
 *     summary: Get test evaluations
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: testId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       "200":
 *         description: Evaluations retrieved
 *
 * /api/college-admin/tests/{testId}/evaluations/{evalId}:
 *   put:
 *     tags: [College Admin - Tests]
 *     summary: Update test evaluation
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: testId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: evalId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               marks:
 *                 type: number
 *               feedback:
 *                 type: string
 *     responses:
 *       "200":
 *         description: Evaluation updated
 *   delete:
 *     tags: [College Admin - Tests]
 *     summary: Delete test evaluation
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: testId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: evalId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       "200":
 *         description: Evaluation deleted
 *
 * /api/college-admin/tests/{testId}/publish:
 *   put:
 *     tags: [College Admin - Tests]
 *     summary: Publish a test
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: testId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       "200":
 *         description: Test published successfully
 */

/**
 * POST /api/college-admin/auth/login
 * College admin login with direct password verification
 */
router.post("/auth/login", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const validation = loginSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: "Validation failed",
        details: validation.error.issues,
      });
      return;
    }

    const { email, password } = validation.data;

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        emailVerified: true,
        image: true,
        collegeId: true,
        passwordHash: true,
      },
    });

    if (!user) {
      res.status(401).json({
        error: "Authentication failed",
        message: "Invalid email or password",
      });
      return;
    }

    // Check if user has college admin portal access
    const allowedRoles = ["product_admin", "college_admin", "principal", "hod", "mentor", "dept_admin"];
    if (!allowedRoles.includes(user.role)) {
      res.status(403).json({
        error: "Access denied",
        message: "This portal is only accessible to product admins, college administrators, principals, HODs, mentors, and department admins",
      });
      return;
    }

    // Verify password - check if passwordHash exists and is bcrypt hash
    let passwordValid = false;
    if (user.passwordHash) {
      try {
        passwordValid = await bcrypt.compare(password, user.passwordHash);
      } catch (err) {
        // If bcrypt fails, password hash is invalid
        passwordValid = false;
      }
    }

    if (!passwordValid) {
      res.status(401).json({
        error: "Authentication failed",
        message: "Invalid email or password",
      });
      return;
    }

    // Create a session
    const sessionId = crypto.randomUUID();
    const sessionToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Store session in database
    await prisma.session.create({
      data: {
        id: sessionId,
        token: sessionToken,
        userId: user.id,
        expiresAt,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      },
    });

    // Set session cookie
    res.cookie("better-auth.session_token", sessionToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const { accessToken, refreshToken } = await issueTokens({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      emailVerified: user.emailVerified,
    });
    setCollegeAdminJwtCookies(res, accessToken, refreshToken);

    res.json({
      success: true,
      message: "Login successful",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerified: user.emailVerified,
        image: user.image,
        collegeId: user.collegeId,
      },
      token: accessToken,
      accessToken,
      refreshToken,
      sessionToken,
    });
  } catch (error) {
    console.error("[college-admin/auth/login] Error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "An error occurred during login",
    });
  }
});

/**
 * POST /api/college-admin/auth/logout
 * College admin logout (proxies to Better Auth)
 */
router.post("/auth/logout", requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
    if (refreshToken) {
      try {
        const payload = verifyRefreshToken(refreshToken);
        await appPrisma.refreshToken.deleteMany({ where: { jti: payload.jti } });
      } catch {
        // Ignore invalid refresh token and continue logout cleanup.
      }
    }

    clearCollegeAdminJwtCookies(res);

    await auth.api.signOut({
      headers: req.headers as Record<string, string>,
    });

    res.json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    console.error("[college-admin/auth/logout] Error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "An error occurred during logout",
    });
  }
});

/**
 * POST /api/college-admin/auth/refresh-token
 * Refresh JWT token pair using refresh token rotation.
 */
router.post("/auth/refresh-token", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;

    // Get current session
    const session = await auth.api.getSession({
      headers: req.headers as Record<string, string>,
    });

    if (session?.session) {
      res.json({
        success: true,
        message: "Token refreshed successfully",
        session: {
          token: session.session.token,
          expiresAt: session.session.expiresAt,
        },
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          emailVerified: user.emailVerified,
          image: user.image,
          collegeId: user.collegeId,
        },
      });
    } else {
    const incomingRefreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE] || req.body?.refreshToken;
    if (!incomingRefreshToken) {
      res.status(401).json({
        error: "No refresh token",
        message: "Please login again",
      });
      return;
    }

    const payload = verifyRefreshToken(incomingRefreshToken);

    const stored = await appPrisma.refreshToken.findUnique({ where: { jti: payload.jti } });
    if (!stored || stored.expiresAt < new Date()) {
      clearCollegeAdminJwtCookies(res);
      res.status(401).json({
        error: "Refresh token expired or revoked",
        message: "Please login again",
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        emailVerified: true,
        image: true,
      },
    });

    if (!user) {
      clearCollegeAdminJwtCookies(res);
      res.status(401).json({
        error: "User not found",
        message: "Please login again",
      });
      return;
    }

    const allowedRoles = ["super_admin", "college_admin", "principal", "hod", "mentor", "dept_admin"];
    if (!allowedRoles.includes(user.role)) {
      clearCollegeAdminJwtCookies(res);
      res.status(403).json({
        error: "Access denied",
        message: "This portal is only accessible to college super admins, college administrators, principals, HODs, and mentors",
      });
      return;
    }

    await appPrisma.refreshToken.deleteMany({ where: { jti: payload.jti } });
    const { accessToken, refreshToken } = await issueTokens({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      emailVerified: user.emailVerified,
    });
    setCollegeAdminJwtCookies(res, accessToken, refreshToken);

    res.json({
      success: true,
      message: "Token refreshed successfully",
      token: accessToken,
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerified: user.emailVerified,
        image: user.image,
      },
    });
  } catch (error) {
    clearCollegeAdminJwtCookies(res);
    console.error("[college-admin/auth/refresh-token] Error:", error);
    res.status(401).json({
      error: "Invalid refresh token",
      message: "An error occurred while refreshing token",
    });
  }
});

/**
 * POST /api/college-admin/auth/forgot-password
 * Request password reset OTP
 */
router.post("/auth/forgot-password", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const validation = forgotPasswordSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: "Validation failed",
        details: validation.error.issues,
      });
      return;
    }

    const { email } = validation.data;
    console.log(`[college-admin/auth/forgot-password] Processing password reset request for: ${email}`);

    // Check if user exists and is college_admin
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Don't reveal if email exists
      console.log(`[college-admin/auth/forgot-password] User not found: ${email}`);
      res.json({
        success: true,
        message: "If a college admin account exists with this email, a password reset code has been sent",
      });
      return;
    }

    const allowedRoles = ["product_admin", "college_admin", "principal", "hod", "mentor", "dept_admin"];
    if (!allowedRoles.includes(user.role)) {
      console.log(`[college-admin/auth/forgot-password] User role not allowed: ${user.role}`);
      res.status(403).json({
        error: "Access denied",
        message: "This portal is only accessible to college super admins, college administrators, principals, HODs, and mentors",
      });
      return;
    }

    console.log(`[college-admin/auth/forgot-password] User found. Generating OTP for: ${email}`);

    // Generate OTP and send via Mailtrap credentials
    try {
      const otp = await generateAndStoreOTP(email, "forget-password");
      console.log(`[college-admin/auth/forgot-password] OTP generated: ${otp} for ${email}`);

      await sendOTPEmail(email, otp, "forget-password");
      console.log(`[college-admin/auth/forgot-password] OTP email sent successfully to ${email}`);

      res.json({
        success: true,
        message: "Password reset code has been sent to your email",
      });
    } catch (emailError: any) {
      console.error(`[college-admin/auth/forgot-password] Email sending failed for ${email}:`, emailError.message);
      console.error("Full error:", emailError);
      
      // Return error instead of success
      res.status(500).json({
        error: "Email error",
        message: "Failed to send reset code to email. Please try again later.",
        details: emailError.message,
      });
    }
  } catch (error: any) {
    console.error("[college-admin/auth/forgot-password] Error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "An error occurred while processing your request",
    });
  }
});

/**
 * POST /api/college-admin/auth/verify-otp
 * Verify password reset OTP (does not consume the OTP)
 */
router.post("/auth/verify-otp", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const validation = verifyOtpSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: "Validation failed",
        details: validation.error.issues,
      });
      return;
    }

    const { email, otp } = validation.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(400).json({
        error: "Invalid or expired OTP",
        message: "Please request a new password reset code",
      });
      return;
    }

    const allowedRoles = ["super_admin", "college_admin", "principal", "hod", "mentor", "dept_admin"];
    if (!allowedRoles.includes(user.role)) {
      res.status(403).json({
        error: "Access denied",
        message: "This portal is only accessible to college super admins, college administrators, principals, HODs, and mentors",
      });
      return;
    }

    const verification = await validateOTP(email, "forget-password", otp);
    if (!verification.valid) {
      res.status(400).json({
        error: verification.reason || "Invalid or expired OTP",
        message: "Please request a new password reset code",
      });
      return;
    }

    res.json({
      success: true,
      message: "OTP is valid",
    });
  } catch (error) {
    console.error("[college-admin/auth/verify-otp] Error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "An error occurred while verifying OTP",
    });
  }
});

/**
 * PUT /api/college-admin/auth/reset-password
 * Reset password
 */
router.put("/auth/reset-password", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const validation = resetPasswordSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: "Validation failed",
        details: validation.error.issues,
      });
      return;
    }

    const { password, email, otp } = validation.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(400).json({
        error: "Invalid or expired OTP",
        message: "Please request a new password reset code",
      });
      return;
    }

    const allowedRoles = ["super_admin", "college_admin", "principal", "hod", "mentor", "dept_admin"];
    if (!allowedRoles.includes(user.role)) {
      res.status(403).json({
        error: "Access denied",
        message: "This portal is only accessible to college super admins, college administrators, principals, HODs, and mentors",
      });
      return;
    }

    const otpVerification = await verifyOTP(email, "forget-password", otp);
    if (!otpVerification.valid) {
      res.status(400).json({
        error: otpVerification.reason || "Invalid or expired OTP",
        message: "Please request a new password reset code",
      });
      return;
    }

    const passwordHash = await hashPassword(password);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });
    if (prisma.refreshToken?.deleteMany) {
      await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
    }

    res.json({
      success: true,
      message: "Password has been reset successfully",
    });
  } catch (error) {
    console.error("[college-admin/auth/reset-password] Error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "An error occurred while resetting password",
    });
  }
});

router.use(requireAuth, enforceCollegeScope);

// ─── Profile Endpoints ──────────────────────────────────────────────────────────

/**
 * GET /api/college-admin/profile
 * Get college admin profile
 */
router.get(
  "/profile",
  requireAuth,
  requireRole("product_admin", "college_admin", "principal", "hod", "mentor", "dept_admin"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const user = req.user!;

      // Fetch complete user details from database
      const userDetails = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          emailVerified: true,
          image: true,
          collegeId: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!userDetails) {
        res.status(404).json({
          error: "User not found",
        });
        return;
      }

      res.json({
        success: true,
        profile: userDetails,
      });
    } catch (error) {
      console.error("[college-admin/profile] Error:", error);
      res.status(500).json({
        error: "Internal server error",
        message: "An error occurred while fetching profile",
      });
    }
  }
);

/**
 * PUT /api/college-admin/profile
 * Update college admin profile
 */
router.put(
  "/profile",
  requireAuth,
  requireRole("product_admin", "college_admin", "principal", "hod", "mentor", "dept_admin"),
  parseAvatarUpload,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const user = req.user!;

      const validation = updateProfileSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          error: "Validation failed",
          details: validation.error.issues,
        });
        return;
      }

      let { name, image } = validation.data;

      if (req.file) {
        const uploadedAvatar = await uploadAvatarToS3({
          fileBuffer: req.file.buffer,
          mimeType: req.file.mimetype,
          userId: user.id,
          scope: "college-admin",
        });
        image = uploadedAvatar.url;
      }

      // Build update object with only provided fields
      const updateData: { name?: string; image?: string } = {};
      if (name !== undefined) updateData.name = name;
      if (image !== undefined) updateData.image = image;

      // Update user profile
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: updateData,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          emailVerified: true,
          image: true,
          collegeId: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      res.json({
        success: true,
        message: "Profile updated successfully",
        profile: updatedUser,
      });
    } catch (error) {
      console.error("[college-admin/profile] Error:", error);
      res.status(500).json({
        error: "Internal server error",
        message: "An error occurred while updating profile",
      });
    }
  }
);

/**
 * POST /api/college-admin/avatar
 * Upload and set profile avatar
 */
router.post(
  "/avatar",
  requireAuth,
  requireRole("product_admin", "college_admin", "principal", "hod", "mentor", "dept_admin"),
  parseAvatarUpload,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const user = req.user;

      if (!user?.id) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      if (!req.file) {
        res.status(400).json({ error: "Avatar file is required (field name: avatar)" });
        return;
      }

      const uploadedAvatar = await uploadAvatarToS3({
        fileBuffer: req.file.buffer,
        mimeType: req.file.mimetype,
        userId: user.id,
        scope: "college-admin",
      });

      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: { image: uploadedAvatar.url },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          emailVerified: true,
          image: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      res.status(200).json({
        success: true,
        message: "Avatar uploaded successfully",
        avatarUrl: uploadedAvatar.url,
        profile: updatedUser,
      });
    } catch (error: any) {
      console.error("[college-admin/avatar] Error:", error);
      res.status(500).json({
        error: error?.message || "Failed to upload avatar",
      });
    }
  }
);

// ─── Dashboard ──────────────────────────────────────────────────────────────────

/**
 * GET /api/college-admin/dashboard
 * College admin dashboard with role-based sections
 * Supports ?role= query parameter for dynamic role-based data
 */
router.get(
  "/dashboard",
  requireAuth,
  requireRole("product_admin", "college_admin", "principal", "hod", "mentor", "dept_admin"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const user = req.user!;
    const { role: queryRole } = req.query;
    const validRoles = ["product_admin", "college_admin", "principal", "hod", "dept_admin", "mentor"];
    
    // Determine which role to use for dashboard data
    // If ?role= is provided and valid, use it; otherwise use user's actual role
    let effectiveRole = user.role;
    
    if (typeof queryRole === "string") {
      const normalizedQueryRole = queryRole.replace(/-/g, "_");
      
      // Verify the query role is valid
      if (validRoles.includes(normalizedQueryRole)) {
        // Security check: Only product_admin/college_admin/principal can view other role dashboards
        if (user.role === "product_admin" || user.role === "college_admin" || user.role === "principal") {
          effectiveRole = normalizedQueryRole;
        } else if (normalizedQueryRole === user.role) {
          // Users can always view their own role dashboard
          effectiveRole = normalizedQueryRole;
        } else {
          res.status(403).json({
            error: "You do not have permission to view dashboard for role: " + normalizedQueryRole,
          });
          return;
        }
      } else {
        res.status(400).json({
          error: "Invalid role parameter. Must be one of: " + validRoles.join(", "),
        });
        return;
      }
    }
    
    // Define role-based dashboard sections
    const getDashboardSections = (role: string) => {
      const allSections = [
        { 
          name: "Department Management", 
          status: "active", 
          endpoint: "/api/college-admin/departments",
          roles: ["product_admin", "college_admin", "principal"],
          description: "Manage departments, assign HODs"
        },
        { 
          name: "Batch Management", 
          status: "active", 
          endpoint: "/api/college-admin/batches",
          roles: ["product_admin", "college_admin", "principal", "hod", "dept_admin"],
          description: "Create and manage student batches"
        },
        { 
          name: "User Management", 
          status: "active", 
          endpoint: "/api/college-admin/users",
          roles: ["product_admin", "college_admin", "principal", "dept_admin"],
          description: "Create and manage users (Principal, HOD, Mentors, Students)"
        },
        { 
          name: "Student Management", 
          status: "active", 
          endpoint: "/api/college-admin/students",
          roles: ["product_admin", "college_admin", "principal", "hod", "dept_admin", "mentor"],
          description: "Manage student records, bulk operations"
        },
        {
          name: "Mentor Management",
          status: "active",
          endpoint: "/api/college-admin/users?role=mentor&departmentId=" + (user.departmentId || ""),
          roles: ["hod"],
          description: "Create and manage mentors in your department",
          requireDepartment: true
        },
        { 
          name: "Test Management", 
          status: "active", 
          endpoint: "/api/college-admin/tests",
          roles: ["product_admin", "college_admin", "principal", "hod", "dept_admin"],
          description: "Create, schedule and manage tests"
        },
        { 
          name: "My Department", 
          status: "active", 
          endpoint: `/api/college-admin/departments/${user.departmentId}`,
          roles: ["dept_admin"],
          description: "View and manage your department",
          requireDepartment: true
        },
        { 
          name: "Department Users", 
          status: "active", 
          endpoint: "/api/college-admin/users?departmentId=" + (user.departmentId || ""),
          roles: ["dept_admin"],
          description: "View users in your department",
          requireDepartment: true
        },
        { 
          name: "Department Tests", 
          status: "active", 
          endpoint: "/api/college-admin/tests?departmentId=" + (user.departmentId || ""),
          roles: [ "dept_admin"],
          description: "View tests in your department",
          requireDepartment: true
        },
        { 
          name: "Active Tests", 
          status: "active", 
          endpoint: "/api/college-admin/tests?timeFilter=active",
          roles: ["product_admin", "college_admin", "principal", "dept_admin"],
          description: "View currently active tests"
        },
        { 
          name: "Upcoming Tests", 
          status: "active", 
          endpoint: "/api/college-admin/tests?timeFilter=upcoming",
          roles: ["product_admin", "college_admin", "principal", "dept_admin"],
          description: "View scheduled upcoming tests"
        },
        {
          name: "Performance",
          status: "active",
          endpoint: "/api/college-admin/report",
          roles: ["product_admin", "dept_admin"],
          description: "View student and batch performance insights"
        },
    
        { 
          name: "Performance Analytics", 
          status: "active", 
          endpoint: "/api/college-admin/analytics",
          roles: ["product_admin", "college_admin","principal", "hod", "mentor"],
          description: "View performance metrics and analytics"
        },
      ];

      // Filter sections based on role and department requirement
      const roleSections = allSections.filter(section => {
        const hasRoleAccess = section.roles.includes(role);
        const hasDepartmentAccess = !section.requireDepartment || (section.requireDepartment && user.departmentId);
        return hasRoleAccess && hasDepartmentAccess;
      }).map(({ roles, requireDepartment, ...section }) => section);

      // HOD dashboard should only expose the requested four management sections.
      if (role === "hod") {
        const hodAllowedSections = new Set([
          "Batch Management",
          "Student Management",
          "Test Management",
          "Mentor Management",
          "Performance Analytics",
        ]);
        return roleSections.filter((section) => hodAllowedSections.has(section.name));
      }

      // Mentor dashboard should only expose view-only student management and performance.
      if (role === "mentor") {
        const mentorAllowedSections = new Set([
          "Student Management",
          "Performance Analytics",
        ]);

        return roleSections
          .filter((section) => mentorAllowedSections.has(section.name))
          .map((section) => {
            if (section.name === "Student Management") {
              return {
                ...section,
                description: "View-only access to student records in your department",
                access: "view_only",
              };
            }

            return section;
          });
      }

      // Principal dashboard should hide the last two test summary cards
      // and expose remaining sections as view-only.
      if (role === "principal") {
        const principalHiddenSections = new Set([
          "Active Tests",
          "Upcoming Tests",
        ]);

        return roleSections
          .filter((section) => !principalHiddenSections.has(section.name))
          .map((section) => ({
            ...section,
            description: `View-only access. ${section.description}`,
            access: "view_only",
          }));
      }

      // Super admin dashboard should hide the last two test summary cards
      // and expose remaining sections with CRUD access.
      if (role === "product_admin") {
        const superAdminHiddenSections = new Set([
          "Active Tests",
          "Upcoming Tests",
        ]);

        return roleSections
          .filter((section) => !superAdminHiddenSections.has(section.name))
          .map((section) => ({
            ...section,
            description: `CRUD access. ${section.description}`,
            access: "crud",
          }));
      }

      return roleSections;
    };

    // Get role-specific greeting and statistics
    const getRoleTitle = (role: string) => {
      const roleTitles: Record<string, string> = {
        product_admin: "Super Administrator",
        college_admin: "College Administrator",
        principal: "Principal",
        hod: "Head of Department",
        dept_admin: "Department Administrator",
        mentor: "Mentor",
      };
      return roleTitles[role] || "College Admin";
    };

    // Fetch role-specific statistics
    const getStatistics = async (role: string) => {
      const stats: any = {};

      const safeTestCount = async (where?: any) => {
        try {
          return await prisma.test.count({ where });
        } catch (err: any) {
          if (err?.code === "P2021") {
            console.warn("[dashboard] Test table missing, returning 0 count");
            return 0;
          }
          throw err;
        }
      };

      try {
        if (role === "product_admin" || role === "college_admin" || role === "principal") {
          const nowForCollegeTotals = new Date();
          const [totalDepartmentsCollege, totalBatchesCollege, totalStudentsCollege, totalTestsCollege, totalActiveTestsCollege] = await Promise.all([
            prisma.department.count(),
            prisma.batch.count(),
            prisma.user.count({ where: { role: "student" } }),
            safeTestCount(),
            safeTestCount({
              scheduledStartTime: { lte: nowForCollegeTotals },
              scheduledEndTime: { gte: nowForCollegeTotals },
              status: { notIn: ["archived"] },
            }),
          ]);

          stats.totalDepartments = totalDepartmentsCollege;
          stats.totalBatches = totalBatchesCollege;
          stats.totalStudents = totalStudentsCollege;
          stats.totalTests = totalTestsCollege;
          stats.activeTests = totalActiveTestsCollege;
          stats.collegeTotals = {
            totalDepartments: totalDepartmentsCollege,
            totalBatches: totalBatchesCollege,
            totalStudents: totalStudentsCollege,
            totalTests: totalTestsCollege,
            activeTests: totalActiveTestsCollege,
          };
          stats.totalDepartmentsCollege = totalDepartmentsCollege;
          stats.totalBatchesCollege = totalBatchesCollege;
          stats.totalStudentsCollege = totalStudentsCollege;
          stats.totalTestsCollege = totalTestsCollege;
          stats.activeTestsCollege = totalActiveTestsCollege;
          stats.scope = "institution";
        } else if ((role === "hod" || role === "dept_admin") && user.departmentId) {
          // Department-specific statistics
          const [totalBatches, totalStudents, totalTests, totalMentors] = await Promise.all([
            prisma.batch.count({ where: { departmentId: user.departmentId } }),
            prisma.user.count({ where: { role: "student", departmentId: user.departmentId } }),
            safeTestCount({ departmentId: user.departmentId }),
            prisma.user.count({ where: { role: "mentor", departmentId: user.departmentId } }),
          ]);

          stats.totalBatches = totalBatches;
          stats.totalStudents = totalStudents;
          stats.totalTests = totalTests;
          stats.totalMentors = totalMentors;
          stats.scope = "department";
          stats.departmentId = user.departmentId;
        } else if (role === "mentor" && user.departmentId) {
          // Mentor-specific statistics
          const [myStudents, departmentTests] = await Promise.all([
            prisma.user.count({ 
              where: { 
                role: "student", 
                departmentId: user.departmentId,
                // In future: add mentorId filter when batch-mentor relation is established
              } 
            }),
            safeTestCount({ departmentId: user.departmentId }),
          ]);

          stats.myStudents = myStudents;
          stats.departmentTests = departmentTests;
          stats.scope = "mentor";
          stats.departmentId = user.departmentId;
        }

        // Active tests (common for all roles)
        const nowForActiveTests = new Date();
        const activeTestsCount = await safeTestCount({
          where: {
            scheduledStartTime: { lte: nowForActiveTests },
            scheduledEndTime: { gte: nowForActiveTests },
            status: { notIn: ["archived"] },
            ...(role !== "product_admin" && role !== "college_admin" && role !== "principal" && user.departmentId
              ? { departmentId: user.departmentId }
              : {}),
          },
        });
        stats.activeTests = activeTestsCount;

      } catch (error) {
        console.error("[dashboard] Error fetching statistics:", error);
        // Return partial stats on error
      }

      return stats;
    };

    const [statistics, metrics] = await Promise.all([
      getStatistics(effectiveRole),
      dashboardService.getDashboardMetrics(
        user.id,
        effectiveRole,
        user.departmentId || undefined
      ),
    ]);

    res.json({
      panel: "college-admin",
      message: `Welcome back, ${user.name}!`,
      totalStudents: metrics.totalStudents,
      averageScore: metrics.averageScore,
      activeTests: metrics.activeTests,
      passRate: metrics.passRate,
      studentsTrend: metrics.studentsTrend,
      performanceTrend: metrics.performanceTrend,
      testsTrend: metrics.testsTrend,
      passRateTrend: metrics.passRateTrend,
      performanceMetrics: metrics,
      dashboard: {
        title: `${getRoleTitle(effectiveRole)} Dashboard`,
        role: effectiveRole,
        userActualRole: user.role,
        sections: getDashboardSections(effectiveRole),
        statistics,
      },
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerified: user.emailVerified,
        image: user.image,
        collegeId: user.collegeId,
        departmentId: user.departmentId,
      },
    });
  }
);

// ─── User Management Endpoints ──────────────────────────────────────────────────

/**
 * POST /api/college-admin/users
 * Create a new user
 */
router.post(
  "/users",
  requireAuth,
  requireRole("product_admin", "college_admin", "principal", "hod", "dept_admin"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const currentUser = req.user!;
      const validation = createUserSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          error: "Validation failed",
          details: validation.error.issues,
        });
        return;
      }

      const data = validation.data;

      let resolvedCollegeId: string | null = null;
      if (currentUser.role === "super_admin") {
        resolvedCollegeId = data.collegeId || null;
      } else {
        if (
          currentUser.collegeId &&
          data.collegeId &&
          currentUser.collegeId !== data.collegeId
        ) {
          res.status(403).json({
            error: "You can only create users for your own college",
          });
          return;
        }
        resolvedCollegeId = data.collegeId || currentUser.collegeId || null;
      }

      if (!resolvedCollegeId) {
        res.status(400).json({
          error: "collegeId is required to create users",
        });
        return;
      }

      // Role-based restrictions
      if (currentUser.role === "hod" || currentUser.role === "dept_admin") {
        // HOD/Dept Admin can only create users in their department
        if (!currentUser.departmentId) {
          res.status(403).json({
            error: "You must be assigned to a department to create users",
          });
          return;
        }

        if (data.departmentId && data.departmentId !== currentUser.departmentId) {
          res.status(403).json({
            error: "You can only create users in your own department",
          });
          return;
        }

        // Force department assignment
        data.departmentId = currentUser.departmentId;

        // HOD/Dept Admin cannot create Principal, College Admin, or HOD roles
        const restrictedRoles = ["principal", "college_admin", "hod"];
        if (restrictedRoles.includes(data.role)) {
          res.status(403).json({
            error: `You do not have permission to create users with role: ${data.role}`,
          });
          return;
        }
      }

      // Create user via Better Auth
      const newUser = await signUpEmailWithDriftRecovery({
        email: data.email,
        password: data.password,
        name: data.name,
      });

      // Check if Better Auth returned an error response
      const signUpError = (newUser as any)?.error;
      if (!newUser?.user || signUpError) {
        const errorMessage = signUpError?.message || "Failed to create user";
        console.error("[college-admin/users/create] Better Auth error:", newUser);
        res.status(400).json({ error: errorMessage });
        return;
      }

      const passwordHash = await hashPassword(data.password);

      // Update user with additional fields
      const updatedUser = await prisma.user.update({
        where: { id: (newUser as any).user.id },
        data: {
          passwordHash,
          role: data.role as Role,
          phone: data.phone,
          collegeId: resolvedCollegeId,
          departmentId: data.departmentId,
          emailVerified: true,
        },
        include: {
          department: true,
        },
      });

      res.status(201).json({
        success: true,
        message: "User created successfully",
        user: updatedUser,
      });
    } catch (error: any) {
      console.error("[college-admin/users/create] Error:", error);
      res.status(400).json({
        error: error.message || "Failed to create user",
      });
    }
  }
);

/**
 * POST /api/college-admin/users/bulk
 * Create multiple users in bulk
 */
router.post(
  "/users/bulk",
  requireAuth,
  requireRole("product_admin", "college_admin", "principal"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const currentUser = req.user!;
      const validation = bulkUsersSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          error: "Validation failed",
          details: validation.error.issues,
        });
        return;
      }

      const { users } = validation.data;
      const results = {
        success: [] as any[],
        failed: [] as any[],
      };

      for (const userData of users) {
        try {
          // Create user via Better Auth
          const newUser = await signUpEmailWithDriftRecovery({
            email: userData.email,
            password: userData.password,
            name: userData.name,
          });

          if (newUser?.user && !(newUser as any)?.error) {
            const passwordHash = await hashPassword(userData.password);

            const resolvedCollegeId =
              currentUser.role === "super_admin"
                ? userData.collegeId || null
                : userData.collegeId || currentUser.collegeId || null;

            if (
              currentUser.role !== "super_admin" &&
              currentUser.collegeId &&
              userData.collegeId &&
              currentUser.collegeId !== userData.collegeId
            ) {
              results.failed.push({
                email: userData.email,
                error: "You can only create users for your own college",
              });
              continue;
            }

            if (!resolvedCollegeId) {
              results.failed.push({
                email: userData.email,
                error: "collegeId is required to create users",
              });
              continue;
            }

            // Update user with additional fields
            const updatedUser = await prisma.user.update({
              where: { id: (newUser as any).user.id },
              data: {
                passwordHash,
                role: userData.role as Role,
                phone: userData.phone,
                collegeId: resolvedCollegeId,
                departmentId: userData.departmentId,
                emailVerified: true,
              },
              include: {
                department: true,
              },
            });

            results.success.push({
              email: userData.email,
              user: updatedUser,
            });
          } else {
            results.failed.push({
              email: userData.email,
              error: (newUser as any).error?.message || "Failed to create user",
            });
          }
        } catch (error: any) {
          results.failed.push({
            email: userData.email,
            error: error.message || "Unknown error",
          });
        }
      }

      res.status(201).json({
        success: true,
        message: `Created ${results.success.length} users, ${results.failed.length} failed`,
        results,
      });
    } catch (error: any) {
      console.error("[college-admin/users/bulk] Error:", error);
      res.status(500).json({
        error: "Failed to process bulk user creation",
        message: error.message,
      });
    }
  }
);

/**
 * GET /api/college-admin/users
 * Get all users with filters
 */
router.get(
  "/users",
  requireAuth,
  requireRole("product_admin", "college_admin", "principal", "hod", "dept_admin", "mentor"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const currentUser = req.user!;
      const { role, departmentId, search, page, limit } = req.query;

      // HOD, Dept Admin, and Mentor can only view users in their department
      let filterDepartmentId = departmentId as string | undefined;
      if ((currentUser.role === "hod" || currentUser.role === "dept_admin" || currentUser.role === "mentor") && currentUser.departmentId) {
        filterDepartmentId = currentUser.departmentId;
      }

      const result = await UserService.getAllUsers({
        role: role as Role | undefined,
        collegeId: currentUser.collegeId || undefined,
        departmentId: filterDepartmentId,
        search: search as string | undefined,
        page: page ? Number.parseInt(page as string) : undefined,
        limit: limit ? Number.parseInt(limit as string) : undefined,
      });

      let departmentStats: { totalStudents: number; totalMentors: number } | undefined;
      let mentorStats: { totalStudents: number } | undefined;
      if (currentUser.role === "hod") {
        if (!currentUser.departmentId) {
          res.status(403).json({
            error: "User must have a department assigned",
          });
          return;
        }

        const [totalStudentsDept, totalMentorsDept] = await Promise.all([
          prisma.user.count({ where: { role: "student", departmentId: currentUser.departmentId } }),
          prisma.user.count({ where: { role: "mentor", departmentId: currentUser.departmentId } }),
        ]);

        departmentStats = {
          totalStudents: totalStudentsDept,
          totalMentors: totalMentorsDept,
        };
      } else if (currentUser.role === "mentor") {
        const totalStudentsForMentor = await prisma.user.count({
          where: {
            role: "student",
            batch: { mentorId: currentUser.id },
          },
        });

        mentorStats = {
          totalStudents: totalStudentsForMentor,
        };
      }

      res.json({
        success: true,
        ...result,
        ...(departmentStats ? { departmentStats } : {}),
        ...(mentorStats ? { mentorStats } : {}),
      });
    } catch (error: any) {
      console.error("[college-admin/users/list] Error:", error);
      res.status(500).json({
        error: "Failed to fetch users",
        message: error.message,
      });
    }
  }
);

/**
 * GET /api/college-admin/users/:userId
 * Get user by ID
 */
router.get(
  "/users/:userId",
  requireAuth,
  requireRole("product_admin", "college_admin", "principal", "hod", "dept_admin"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.params.userId as string;

      const user = await UserService.getUserById(
        userId,
        req.user?.collegeId || undefined
      );

      if (!user) {
        res.status(404).json({
          error: "User not found",
        });
        return;
      }

      res.json({
        success: true,
        user,
      });
    } catch (error: any) {
      console.error("[college-admin/users/get] Error:", error);
      res.status(500).json({
        error: "Failed to fetch user",
        message: error.message,
      });
    }
  }
);

/**
 * PUT /api/college-admin/users/:userId
 * Update user
 */
router.put(
  "/users/:userId",
  requireAuth,
  requireRole("product_admin", "college_admin", "principalcor", "hod", "dept_admin"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const currentUser = req.user!;
      const userId = req.params.userId as string;
      const validation = updateUserSchema.safeParse(req.body);

      if (!validation.success) {
        res.status(400).json({
          error: "Validation failed",
          details: validation.error.issues,
        });
        return;
      }

      // Get the user being updated to check permissions
      const targetUser = await UserService.getUserById(
        userId,
        req.user?.collegeId || undefined
      );
      if (!targetUser) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      // Validate permissions using helper
      const permissionCheck = validateUserUpdatePermissions(currentUser, targetUser, validation.data);
      if (!permissionCheck.allowed) {
        res.status(403).json({ error: permissionCheck.error });
        return;
      }

      const user = await UserService.updateUser(userId, validation.data);

      res.json({
        success: true,
        message: "User updated successfully",
        user,
      });
    } catch (error: any) {
      console.error("[college-admin/users/update] Error:", error);
      res.status(error.message === "User not found" ? 404 : 500).json({
        error: error.message || "Failed to update user",
      });
    }
  }
);

/**
 * DELETE /api/college-admin/users/:userId
 * Delete user
 */
router.delete(
  "/users/:userId",
  requireAuth,
  requireRole("product_admin", "college_admin", "principal", "hod", "dept_admin"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const currentUser = req.user!;
      const userId = req.params.userId as string;

      // Get the user being deleted to check permissions
      const targetUser = await UserService.getUserById(
        userId,
        req.user?.collegeId || undefined
      );
      if (!targetUser) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      // Role-based restrictions
      if (currentUser.role === "hod" || currentUser.role === "dept_admin") {
        // Can only delete users in their department
        if (targetUser.departmentId !== currentUser.departmentId) {
          res.status(403).json({
            error: "You can only delete users in your own department",
          });
          return;
        }

        // Cannot delete privileged roles
        const restrictedRoles = ["principal", "college_admin", "hod", "dept_admin"];
        if (restrictedRoles.includes(targetUser.role)) {
          res.status(403).json({
            error: "You do not have permission to delete this user",
          });
          return;
        }
      }

      await UserService.deleteUser(userId);

      res.json({
        success: true,
        message: "User deleted successfully",
      });
    } catch (error: any) {
      console.error("[college-admin/users/delete] Error:", error);
      res.status(error.message.includes("not found") ? 404 : 400).json({
        error: error.message || "Failed to delete user",
      });
    }
  }
);

/**
 * PUT /api/college-admin/users/:userId/assign-role
 * Assign role to user
 */
router.put(
  "/users/:userId/assign-role",
  requireAuth,
  requireRole("product_admin", "college_admin", "principal"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.params.userId as string;
      const validation = assignRoleSchema.safeParse(req.body);

      if (!validation.success) {
        res.status(400).json({
          error: "Validation failed",
          details: validation.error.issues,
        });
        return;
      }

      const user = await UserService.assignRole(userId, validation.data.role as Role);

      res.json({
        success: true,
        message: "Role assigned successfully",
        user,
      });
    } catch (error: any) {
      console.error("[college-admin/users/assign-role] Error:", error);
      res.status(500).json({
        error: error.message || "Failed to assign role",
      });
    }
  }
);

/**
 * PUT /api/college-admin/users/:userId/assign-department
 * Assign department to user
 */
router.put(
  "/users/:userId/assign-department",
  requireAuth,
  requireRole("product_admin", "college_admin", "principal", "hod"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.params.userId as string;
      const validation = assignDepartmentSchema.safeParse(req.body);

      if (!validation.success) {
        res.status(400).json({
          error: "Validation failed",
          details: validation.error.issues,
        });
        return;
      }

      const user = await UserService.assignDepartment(userId, validation.data.departmentId);

      res.json({
        success: true,
        message: "Department assigned successfully",
        user,
      });
    } catch (error: any) {
      console.error("[college-admin/users/assign-department] Error:", error);
      res.status(error.message.includes("not found") ? 404 : 500).json({
        error: error.message || "Failed to assign department",
      });
    }
  }
);

// ─── Department Management Endpoints ────────────────────────────────────────────

/**
 * POST /api/college-admin/departments
 * Create a new department
 */
router.post(
  "/departments",
  requireAuth,
  requireRole("product_admin", "college_admin", "principal"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const validation = createDepartmentSchema.safeParse(req.body);

      if (!validation.success) {
        res.status(400).json({
          error: "Validation failed",
          details: validation.error.issues,
        });
        return;
      }

      const payload = validation.data;
      const effectiveCollegeId =
        req.user?.role === "super_admin"
          ? payload.collegeId || req.user?.collegeId
          : req.user?.collegeId;

      if (!effectiveCollegeId) {
        res.status(400).json({
          error: "collegeId is required to create a department",
        });
        return;
      }

      const { collegeId: _ignoredCollegeId, ...departmentData } = payload;
      const department = await DepartmentService.createDepartment({
        ...departmentData,
        collegeId: effectiveCollegeId,
      });

      res.status(201).json({
        success: true,
        message: "Department created successfully",
        department,
      });
    } catch (error: any) {
      console.error("[college-admin/departments/create] Error:", error);
      res.status(400).json({
        error: error.message || "Failed to create department",
      });
    }
  }
);

/**
 * GET /api/college-admin/departments
 * Get all departments
 */
router.get(
  "/departments",
  requireAuth,
  requireRole("product_admin", "college_admin", "principal", "hod", "dept_admin", "mentor"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const currentUser = req.user!;
      const { search, page, limit } = req.query;

      // HOD, Dept Admin, and Mentor can only view their own department
      if ((currentUser.role === "hod" || currentUser.role === "dept_admin" || currentUser.role === "mentor") && currentUser.departmentId) {
        const department = await DepartmentService.getDepartmentById(
          currentUser.departmentId,
          currentUser.collegeId || undefined
        );
        
        if (!department) {
          res.status(404).json({
            error: "Department not found",
          });
          return;
        }

        res.json({
          success: true,
          departments: [department],
          pagination: {
            page: 1,
            limit: 1,
            total: 1,
            totalPages: 1,
          },
        });
        return;
      }

      // College Admin and Principal can view all departments
      const result = await DepartmentService.getAllDepartments({
        collegeId: currentUser.collegeId || undefined,
        search: search as string | undefined,
        page: page ? Number.parseInt(page as string) : undefined,
        limit: limit ? Number.parseInt(limit as string) : undefined,
      });

      res.json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      console.error("[college-admin/departments/list] Error:", error);
      res.status(500).json({
        error: "Failed to fetch departments",
        message: error.message,
      });
    }
  }
);

/**
 * GET /api/college-admin/departments/:deptId
 * Get department by ID
 */
router.get(
  "/departments/:deptId",
  requireAuth,
  requireRole("product_admin", "college_admin", "principal", "hod", "dept_admin", "mentor"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const currentUser = req.user!;
      const deptId = req.params.deptId as string;

      // HOD, Dept Admin, and Mentor can only view their own department
      if ((currentUser.role === "hod" || currentUser.role === "dept_admin" || currentUser.role === "mentor") && currentUser.departmentId) {
        if (deptId !== currentUser.departmentId) {
          res.status(403).json({
            error: "You can only view your own department",
          });
          return;
        }
      }

      const department = await DepartmentService.getDepartmentById(
        deptId,
        currentUser.collegeId || undefined
      );

      if (!department) {
        res.status(404).json({
          error: "Department not found",
        });
        return;
      }

      res.json({
        success: true,
        department,
      });
    } catch (error: any) {
      console.error("[college-admin/departments/get] Error:", error);
      res.status(500).json({
        error: "Failed to fetch department",
        message: error.message,
      });
    }
  }
);

/**
 * PUT /api/college-admin/departments/:deptId
 * Update department
 */
router.put(
  "/departments/:deptId",
  requireAuth,
  requireRole("product_admin", "college_admin", "principal"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const deptId = req.params.deptId as string;
      const validation = updateDepartmentSchema.safeParse(req.body);

      if (!validation.success) {
        res.status(400).json({
          error: "Validation failed",
          details: validation.error.issues,
        });
        return;
      }

      const department = await DepartmentService.updateDepartment(deptId, validation.data);

      res.json({
        success: true,
        message: "Department updated successfully",
        department,
      });
    } catch (error: any) {
      console.error("[college-admin/departments/update] Error:", error);
      res.status(error.message.includes("not found") ? 404 : 400).json({
        error: error.message || "Failed to update department",
      });
    }
  }
);

/**
 * DELETE /api/college-admin/departments/:deptId
 * Delete department
 */
router.delete(
  "/departments/:deptId",
  requireAuth,
  requireRole("product_admin", "college_admin", "principal"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const deptId = req.params.deptId as string;

      await DepartmentService.deleteDepartment(deptId);

      res.json({
        success: true,
        message: "Department deleted successfully",
      });
    } catch (error: any) {
      console.error("[college-admin/departments/delete] Error:", error);
      res.status(error.message.includes("not found") ? 404 : 400).json({
        error: error.message || "Failed to delete department",
      });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// BATCH MANAGEMENT ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/college-admin/batches
 * Create a new batch
 * Access: college_admin, principal, hod (only for their department)
 */
router.post(
  "/batches",
  requireAuth,
  requireRole("product_admin", "college_admin", "principal", "hod"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const currentUser = req.user!;

      const validation = createBatchSchema.safeParse(req.body);

      if (!validation.success) {
        res.status(400).json({
          error: "Validation failed",
          details: validation.error.issues,
        });
        return;
      }

      // HOD can only create batches in their department
      if (currentUser.role === "hod") {
        if (!currentUser.departmentId) {
          res.status(403).json({
            error: "HOD must have a department assigned",
          });
          return;
        }

        if (validation.data.departmentId !== currentUser.departmentId) {
          res.status(403).json({
            error: "HOD can only create batches in their own department",
          });
          return;
        }
      }

      const batch = await BatchService.createBatch(validation.data);

      res.status(201).json({
        success: true,
        message: "Batch created successfully",
        batch,
      });
    } catch (error: any) {
      console.error("[college-admin/batches/create] Error:", error);
      res.status(400).json({
        error: error.message || "Failed to create batch",
      });
    }
  }
);

/**
 * GET /api/college-admin/batches
 * Get all batches with optional filtering
 * Access: college_admin, principal, hod (only their department), dept_admin (only their department), mentor (only their department)
 */
router.get(
  "/batches",
  requireAuth,
  requireRole("product_admin", "college_admin", "principal", "hod", "dept_admin", "mentor"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const currentUser = req.user!;
      const { departmentId, year, semester, mentorId, page, limit } = req.query;

      let filters: any = {
        collegeId: currentUser.collegeId || undefined,
        departmentId: departmentId as string | undefined,
        year: year ? Number.parseInt(year as string) : undefined,
        semester: semester ? Number.parseInt(semester as string) : undefined,
        mentorId: mentorId as string | undefined,
        page: page ? Number.parseInt(page as string) : undefined,
        limit: limit ? Number.parseInt(limit as string) : undefined,
      };

      // HOD, Dept Admin, and Mentor can only view batches in their department
      if (["hod", "dept_admin", "mentor"].includes(currentUser.role)) {
        if (!currentUser.departmentId) {
          res.status(403).json({
            error: "User must have a department assigned",
          });
          return;
        }
        filters.departmentId = currentUser.departmentId;
      }

      const result = await BatchService.getAllBatches(filters);

      res.json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      console.error("[college-admin/batches/list] Error:", error);
      res.status(500).json({
        error: "Failed to fetch batches",
        message: error.message,
      });
    }
  }
);

/**
 * GET /api/college-admin/batches/:batchId
 * Get batch details by ID
 * Access: college_admin, principal, hod (only their department), dept_admin (only their department), mentor (only their department)
 */
router.get(
  "/batches/:batchId",
  requireAuth,
  requireRole("product_admin", "college_admin", "principal", "hod", "dept_admin", "mentor"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const currentUser = req.user!;
      const batchId = req.params.batchId as string;

      const batch = await BatchService.getBatchById(batchId);

      // HOD, Dept Admin, and Mentor can only view batches in their department
      if (["hod", "dept_admin", "mentor"].includes(currentUser.role)) {
        if (!currentUser.departmentId) {
          res.status(403).json({
            error: "User must have a department assigned",
          });
          return;
        }

        if (batch.departmentId !== currentUser.departmentId) {
          res.status(403).json({
            error: "You can only view batches in your own department",
          });
          return;
        }
      }

      res.json({
        success: true,
        batch,
      });
    } catch (error: any) {
      console.error("[college-admin/batches/get] Error:", error);
      res.status(error.message.includes("not found") ? 404 : 500).json({
        error: error.message || "Failed to fetch batch",
      });
    }
  }
);

/**
 * PUT /api/college-admin/batches/:batchId
 * Update batch details
 * Access: college_admin, principal, hod (only their department)
 */
router.put(
  "/batches/:batchId",
  requireAuth,
  requireRole("product_admin", "college_admin", "principal", "hod"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const currentUser = req.user!;
      const batchId = req.params.batchId as string;

      const validation = updateBatchSchema.safeParse(req.body);

      if (!validation.success) {
        res.status(400).json({
          error: "Validation failed",
          details: validation.error.issues,
        });
        return;
      }

      // Check if batch exists and HOD has permission
      if (currentUser.role === "hod") {
        if (!currentUser.departmentId) {
          res.status(403).json({
            error: "HOD must have a department assigned",
          });
          return;
        }

        const batch = await BatchService.getBatchById(batchId);
        if (batch.departmentId !== currentUser.departmentId) {
          res.status(403).json({
            error: "HOD can only update batches in their own department",
          });
          return;
        }
      }

      const updatedBatch = await BatchService.updateBatch(batchId, validation.data);

      res.json({
        success: true,
        message: "Batch updated successfully",
        batch: updatedBatch,
      });
    } catch (error: any) {
      console.error("[college-admin/batches/update] Error:", error);
      res.status(error.message.includes("not found") ? 404 : 400).json({
        error: error.message || "Failed to update batch",
      });
    }
  }
);

/**
 * DELETE /api/college-admin/batches/:batchId
 * Delete a batch (only if no students assigned)
 * Access: college_admin, principal, hod (only their department)
 */
router.delete(
  "/batches/:batchId",
  requireAuth,
  requireRole("product_admin", "college_admin", "principal", "hod"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const currentUser = req.user!;
      const batchId = req.params.batchId as string;

      // Check if batch exists and HOD has permission
      if (currentUser.role === "hod") {
        if (!currentUser.departmentId) {
          res.status(403).json({
            error: "HOD must have a department assigned",
          });
          return;
        }

        const batch = await BatchService.getBatchById(batchId);
        if (batch.departmentId !== currentUser.departmentId) {
          res.status(403).json({
            error: "HOD can only delete batches in their own department",
          });
          return;
        }
      }

      await BatchService.deleteBatch(batchId);

      res.json({
        success: true,
        message: "Batch deleted successfully",
      });
    } catch (error: any) {
      console.error("[college-admin/batches/delete] Error:", error);
      res.status(error.message.includes("not found") ? 404 : 400).json({
        error: error.message || "Failed to delete batch",
      });
    }
  }
);

/**
 * POST /api/college-admin/batches/:batchId/students
 * Assign students to a batch
 * Access: college_admin, principal, hod (only their department), dept_admin (only their department)
 */
router.post(
  "/batches/:batchId/students",
  requireAuth,
  requireRole("product_admin", "college_admin", "principal", "hod", "dept_admin"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const currentUser = req.user!;
      const batchId = req.params.batchId as string;

      const validation = assignStudentsToBatchSchema.safeParse(req.body);

      if (!validation.success) {
        res.status(400).json({
          error: "Validation failed",
          details: validation.error.issues,
        });
        return;
      }

      // Check if batch exists and user has permission
      if (["hod", "dept_admin"].includes(currentUser.role)) {
        if (!currentUser.departmentId) {
          res.status(403).json({
            error: "User must have a department assigned",
          });
          return;
        }

        const batch = await BatchService.getBatchById(batchId);
        if (batch.departmentId !== currentUser.departmentId) {
          res.status(403).json({
            error: "You can only assign students to batches in your own department",
          });
          return;
        }
      }

      const updatedBatch = await BatchService.assignStudentsToBatch(batchId, validation.data);

      res.json({
        success: true,
        message: "Students assigned to batch successfully",
        batch: updatedBatch,
      });
    } catch (error: any) {
      console.error("[college-admin/batches/assign-students] Error:", error);
      res.status(error.message.includes("not found") ? 404 : 400).json({
        error: error.message || "Failed to assign students to batch",
      });
    }
  }
);

/**
 * DELETE /api/college-admin/batches/:batchId/students
 * Remove students from a batch
 * Access: college_admin, principal, hod (only their department), dept_admin (only their department)
 */
router.delete(
  "/batches/:batchId/students",
  requireAuth,
  requireRole("product_admin", "college_admin", "principal", "hod", "dept_admin"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const currentUser = req.user!;
      const batchId = req.params.batchId as string;

      const validation = removeStudentsFromBatchSchema.safeParse(req.body);

      if (!validation.success) {
        res.status(400).json({
          error: "Validation failed",
          details: validation.error.issues,
        });
        return;
      }

      // Check if batch exists and user has permission
      if (["hod", "dept_admin"].includes(currentUser.role)) {
        if (!currentUser.departmentId) {
          res.status(403).json({
            error: "User must have a department assigned",
          });
          return;
        }

        const batch = await BatchService.getBatchById(batchId);
        if (batch.departmentId !== currentUser.departmentId) {
          res.status(403).json({
            error: "You can only remove students from batches in your own department",
          });
          return;
        }
      }

      const updatedBatch = await BatchService.removeStudentsFromBatch(batchId, validation.data.studentIds);

      res.json({
        success: true,
        message: "Students removed from batch successfully",
        batch: updatedBatch,
      });
    } catch (error: any) {
      console.error("[college-admin/batches/remove-students] Error:", error);
      res.status(error.message.includes("not found") ? 404 : 400).json({
        error: error.message || "Failed to remove students from batch",
      });
    }
  }
);

/**
 * PUT /api/college-admin/batches/:batchId/mentor
 * Assign mentor to a batch
 * Access: college_admin, principal, hod (only their department), dept_admin (only their department)
 */
router.put(
  "/batches/:batchId/mentor",
  requireAuth,
  requireRole("product_admin", "college_admin", "principal", "hod", "dept_admin"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const currentUser = req.user!;
      const batchId = req.params.batchId as string;

      const validation = assignMentorToBatchSchema.safeParse(req.body);

      if (!validation.success) {
        res.status(400).json({
          error: "Validation failed",
          details: validation.error.issues,
        });
        return;
      }

      // Check if batch exists and user has permission
      if (["hod", "dept_admin"].includes(currentUser.role)) {
        if (!currentUser.departmentId) {
          res.status(403).json({
            error: "User must have a department assigned",
          });
          return;
        }

        const batch = await BatchService.getBatchById(batchId);
        if (batch.departmentId !== currentUser.departmentId) {
          res.status(403).json({
            error: "You can only assign mentors to batches in your own department",
          });
          return;
        }
      }

      const updatedBatch = await BatchService.assignMentorToBatch(batchId, validation.data.mentorId);

      res.json({
        success: true,
        message: "Mentor assigned to batch successfully",
        batch: updatedBatch,
      });
    } catch (error: any) {
      console.error("[college-admin/batches/assign-mentor] Error:", error);
      res.status(error.message.includes("not found") ? 404 : 400).json({
        error: error.message || "Failed to assign mentor to batch",
      });
    }
  }
);

/**
 * DELETE /api/college-admin/batches/:batchId/mentor
 * Remove mentor from a batch
 * Access: college_admin, principal, hod (only their department), dept_admin (only their department)
 */
router.delete(
  "/batches/:batchId/mentor",
  requireAuth,
  requireRole("product_admin", "college_admin", "principal", "hod", "dept_admin"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const currentUser = req.user!;
      const batchId = req.params.batchId as string;

      // Check if batch exists and user has permission
      if (["hod", "dept_admin"].includes(currentUser.role)) {
        if (!currentUser.departmentId) {
          res.status(403).json({
            error: "User must have a department assigned",
          });
          return;
        }

        const batch = await BatchService.getBatchById(batchId);
        if (batch.departmentId !== currentUser.departmentId) {
          res.status(403).json({
            error: "You can only remove mentors from batches in your own department",
          });
          return;
        }
      }

      const updatedBatch = await BatchService.removeMentorFromBatch(batchId);

      res.json({
        success: true,
        message: "Mentor removed from batch successfully",
        batch: updatedBatch,
      });
    } catch (error: any) {
      console.error("[college-admin/batches/remove-mentor] Error:", error);
      res.status(error.message.includes("not found") ? 404 : 400).json({
        error: error.message || "Failed to remove mentor from batch",
      });
    }
  }
);

/**
 * GET /api/college-admin/batches/:batchId/stats
 * Get batch statistics
 * Access: college_admin, principal, hod (only their department), dept_admin (only their department), mentor (only their department)
 */
router.get(
  "/batches/:batchId/stats",
  requireAuth,
  requireRole("product_admin", "college_admin", "principal", "hod", "dept_admin", "mentor"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const currentUser = req.user!;
      const batchId = req.params.batchId as string;

      // Check if batch exists and user has permission
      if (["hod", "dept_admin", "mentor"].includes(currentUser.role)) {
        if (!currentUser.departmentId) {
          res.status(403).json({
            error: "User must have a department assigned",
          });
          return;
        }

        const batch = await BatchService.getBatchById(batchId);
        if (batch.departmentId !== currentUser.departmentId) {
          res.status(403).json({
            error: "You can only view statistics for batches in your own department",
          });
          return;
        }
      }

      const stats = await BatchService.getBatchStats(batchId);

      res.json({
        success: true,
        stats,
      });
    } catch (error: any) {
      console.error("[college-admin/batches/stats] Error:", error);
      res.status(error.message.includes("not found") ? 404 : 500).json({
        error: error.message || "Failed to fetch batch statistics",
      });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// STUDENT MANAGEMENT ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/college-admin/mentors/:mentorId/students
 * Get all students assigned to a mentor (via batch mentor assignment)
 * Access: college_admin, principal, hod (own department), dept_admin (own department), mentor (self only)
 */
router.get(
  "/mentors/:mentorId/students",
  requireAuth,
  requireRole("super_admin", "college_admin", "principal", "hod", "dept_admin", "mentor"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const currentUser = req.user!;
      const { mentorId } = req.params;

      const queryValidation = mentorStudentsQuerySchema.safeParse(req.query);
      if (!queryValidation.success) {
        res.status(400).json({
          error: "Validation failed",
          details: queryValidation.error.issues,
        });
        return;
      }

      // Mentors can only view their own mentees
      if (currentUser.role === "mentor" && currentUser.id !== mentorId) {
        res.status(403).json({
          error: "Mentors can only view their own students",
        });
        return;
      }

      const result = await BatchService.getStudentsByMentor(mentorId, queryValidation.data);

      // HOD and Dept Admin can only view mentors in their department
      if (["hod", "dept_admin"].includes(currentUser.role)) {
        if (!currentUser.departmentId) {
          res.status(403).json({
            error: "User must have a department assigned",
          });
          return;
        }

        if (!result.mentor.departmentId) {
          res.status(400).json({
            error: "Mentor must belong to a department",
          });
          return;
        }

        if (result.mentor.departmentId !== currentUser.departmentId) {
          res.status(403).json({
            error: "You can only view mentors in your own department",
          });
          return;
        }
      }

      res.json({
        success: true,
        mentor: result.mentor,
        students: result.students,
        pagination: result.pagination,
      });
    } catch (error: any) {
      console.error("[college-admin/mentors/students] Error:", error);
      res.status(error.message.includes("not found") ? 404 : 400).json({
        error: error.message || "Failed to fetch students for mentor",
      });
    }
  }
);

/**
 * PUT /api/college-admin/students/assign-mentor
 * Assign a mentor to students (all students must belong to the same batch)
 * Access: college_admin, principal, hod (own department), dept_admin (own department)
 */
router.put(
  "/students/assign-mentor",
  requireAuth,
  requireRole("super_admin", "college_admin", "principal", "hod", "dept_admin"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const currentUser = req.user!;

      const validation = assignMentorToStudentsSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          error: "Validation failed",
          details: validation.error.issues,
        });
        return;
      }

      const { mentorId, studentIds } = validation.data;

      // Fetch students to verify existence and batch consistency
      const students = await prisma.user.findMany({
        where: {
          id: { in: studentIds },
          role: "student",
        },
        select: { id: true, batchId: true, departmentId: true },
      });

      if (students.length !== studentIds.length) {
        res.status(404).json({
          error: "One or more students not found",
        });
        return;
      }

      // All students must belong to a batch to inherit mentor
      if (students.some((s) => !s.batchId)) {
        res.status(400).json({
          error: "All students must belong to a batch before assigning a mentor",
        });
        return;
      }

      const batchIds = [...new Set(students.map((s) => s.batchId))];
      if (batchIds.length !== 1) {
        res.status(400).json({
          error: "All students must be in the same batch to assign a mentor",
        });
        return;
      }

      const batchId = batchIds[0]!;

      // HOD/Dept Admin scope restriction
      if (["hod", "dept_admin"].includes(currentUser.role)) {
        if (!currentUser.departmentId) {
          res.status(403).json({ error: "User must have a department assigned" });
          return;
        }

        const batch = await prisma.batch.findUnique({
          where: { id: batchId },
          select: { departmentId: true },
        });

        if (!batch) {
          res.status(404).json({ error: "Batch not found" });
          return;
        }

        if (batch.departmentId !== currentUser.departmentId) {
          res.status(403).json({
            error: "You can only assign mentors to students in your own department",
          });
          return;
        }
      }

      const updatedBatch = await BatchService.assignMentorToBatch(batchId, mentorId);

      res.json({
        success: true,
        message: "Mentor assigned to students successfully",
        batch: updatedBatch,
      });
    } catch (error: any) {
      console.error("[college-admin/students/assign-mentor] Error:", error);
      res.status(error.message?.includes("not found") ? 404 : 400).json({
        error: error.message || "Failed to assign mentor to students",
      });
    }
  }
);

/**
 * POST /api/college-admin/students
 * Create a new student
 * Access: college_admin, principal, hod (only their department), dept_admin (only their department)
 */

router.post(
  "/students",
  requireAuth,
  requireRole("product_admin", "college_admin", "principal", "hod", "dept_admin"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const currentUser = req.user!;
      console.log(req.body);
      const validation = createStudentSchema.safeParse(req.body);
      console.log(validation);
      if (!validation.success) {
        res.status(400).json({
          error: "Validation failed",
          details: validation.error.issues,
        });
        return;
      }

      const { email, password, name, phone, collegeId, departmentId, batchId } = validation.data;

      const resolvedCollegeId =
        currentUser.role === "super_admin"
          ? collegeId || null
          : collegeId || currentUser.collegeId || null;

      if (
        currentUser.role !== "super_admin" &&
        currentUser.collegeId &&
        collegeId &&
        currentUser.collegeId !== collegeId
      ) {
        res.status(403).json({
          error: "You can only create students for your own college",
        });
        return;
      }

      if (!resolvedCollegeId) {
        res.status(400).json({
          error: "collegeId is required to create student",
        });
        return;
      }

      // HOD and Dept Admin can only create students in their department
      if (["hod", "dept_admin"].includes(currentUser.role)) {
        if (!currentUser.departmentId) {
          res.status(403).json({
            error: "User must have a department assigned",
          });
          return;
        }

        if (departmentId && departmentId !== currentUser.departmentId) {
          res.status(403).json({
            error: "You can only create students in your own department",
          });
          return;
        }
      }

      // Validate department and batch using helper
      const deptBatchValidation = await validateStudentDepartmentAndBatch(departmentId, batchId);
      if (!deptBatchValidation.valid) {
        res.status(400).json({ error: deptBatchValidation.error });
        return;
      }

      // Check if user with email already exists
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        res.status(400).json({
          error: "User with this email already exists",
        });
        return;
      }

      // Create student using Better Auth
      const signUpResult = await signUpEmailWithDriftRecovery({
        email,
        password,
        name,
      });

      const signUpError = (signUpResult as any)?.error;
      const createdUserId = (signUpResult as any)?.user?.id as string | undefined;
      if (!signUpResult || signUpError) {
        res.status(500).json({
          error: "Failed to create student account",
        });
        return;
      }

      let targetUserId = createdUserId;
      if (!targetUserId) {
        const createdUser = await prisma.user.findUnique({
          where: { email: email.trim().toLowerCase() },
          select: { id: true },
        });
        targetUserId = createdUser?.id;
      }

      if (!targetUserId) {
        res.status(500).json({
          error: "Student account was created but could not be finalized",
        });
        return;
      }

      const passwordHash = await hashPassword(password);

      // Update the user with additional fields
      const student = await prisma.user.update({
        where: { id: targetUserId },
        data: {
          passwordHash,
          role: "student",
          emailVerified: true,
          phone: phone || null,
          collegeId: resolvedCollegeId,
          departmentId: departmentId || (["hod", "dept_admin"].includes(currentUser.role) ? currentUser.departmentId : null),
          batchId: batchId || null,
        },
        include: {
          department: true,
          batch: true,
        },
      });

      res.status(201).json({
        success: true,
        message: "Student created successfully",
        student,
      });
    } catch (error: any) {
      console.error("[college-admin/students/create] Error:", error);
      res.status(400).json({
        error: error.message || "Failed to create student",
      });
    }
  }
);

/**
 * POST /api/college-admin/students/bulk
 * Create multiple students in bulk
 * Access: college_admin, principal, hod (only their department), dept_admin (only their department)
 */
router.post(
  "/students/bulk",
  requireAuth,
  requireRole("product_admin", "college_admin", "principal", "hod", "dept_admin"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const currentUser = req.user!;

      const validation = bulkStudentsSchema.safeParse(req.body);

      if (!validation.success) {
        res.status(400).json({
          error: "Validation failed",
          details: validation.error.issues,
        });
        return;
      }

      const { students } = validation.data;

      // Validate all student data using helper
      const bulkValidation = await validateBulkStudentData(students, currentUser);
      if (!bulkValidation.valid) {
        const response: any = { error: bulkValidation.error };
        if (bulkValidation.details) {
          response.details = bulkValidation.details;
        }
        res.status(bulkValidation.error?.includes("permission") ? 403 : 400).json(response);
        return;
      }

      const createdStudents: any[] = [];
      const errors: any[] = [];

      // Create students one by one using helper
      for (const studentData of students) {
        const result = await createSingleStudentAccount(studentData, currentUser);
        
        if (result.success && result.student) {
          createdStudents.push(result.student);
        } else {
          errors.push({
            email: studentData.email,
            error: result.error || "Failed to create student",
          });
        }
      }

      if (createdStudents.length === 0) {
        res.status(500).json({
          error: "Failed to create any students",
          errors,
        });
        return;
      }

      res.status(201).json({
        success: true,
        message: `${createdStudents.length} student(s) created successfully`,
        students: createdStudents,
        ...(errors.length > 0 && { errors }),
      });
    } catch (error: any) {
      console.error("[college-admin/students/bulk-create] Error:", error);
      res.status(400).json({
        error: error.message || "Failed to create students",
      });
    }
  }
);

/**
 * GET /api/college-admin/students
 * Get all students with optional filtering
 * Access: college_admin, principal, hod (only their department), dept_admin (only their department), mentor (only their department)
 */
router.get(
  "/students",
  requireAuth,
  requireRole("product_admin", "college_admin", "principal", "hod", "dept_admin", "mentor"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const currentUser = req.user!;
      const { departmentId, batchId, search, page, limit } = req.query;

      let filters: any = {
        role: "student",
        collegeId: currentUser.collegeId || undefined,
        departmentId: departmentId as string | undefined,
        batchId: batchId as string | undefined,
        search: search as string | undefined,
        page: page ? Number.parseInt(page as string) : undefined,
        limit: limit ? Number.parseInt(limit as string) : undefined,
      };

      // HOD, Dept Admin, and Mentor can only view students in their department
      if (["hod", "dept_admin", "mentor"].includes(currentUser.role)) {
        if (!currentUser.departmentId) {
          res.status(403).json({
            error: "User must have a department assigned",
          });
          return;
        }
        filters.departmentId = currentUser.departmentId;
      }

      const result = await UserService.getAllUsers(filters);

      let departmentStats: { totalStudents: number; totalMentors: number } | undefined;

      // For HOD, include department-level student/mentor counts
      if (currentUser.role === "hod" && currentUser.departmentId) {
        const [totalStudentsDept, totalMentorsDept] = await Promise.all([
          prisma.user.count({ where: { role: "student", departmentId: currentUser.departmentId } }),
          prisma.user.count({ where: { role: "mentor", departmentId: currentUser.departmentId } }),
        ]);

        departmentStats = {
          totalStudents: totalStudentsDept,
          totalMentors: totalMentorsDept,
        };
      }

      res.json({
        success: true,
        students: result.users,
        pagination: result.pagination,
        ...(departmentStats ? { departmentStats } : {}),
      });
    } catch (error: any) {
      console.error("[college-admin/students/list] Error:", error);
      res.status(500).json({
        error: "Failed to fetch students",
        message: error.message,
      });
    }
  }
);

/**
 * GET /api/college-admin/students/:studentId
 * Get student details by ID
 * Access: college_admin, principal, hod (only their department), dept_admin (only their department), mentor (only their department)
 */
router.get(
  "/students/:studentId",
  requireAuth,
  requireRole("product_admin", "college_admin", "principal", "hod", "dept_admin", "mentor"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const currentUser = req.user!;
      const studentId = req.params.studentId as string;

      const student = await UserService.getUserById(
        studentId,
        req.user?.collegeId || undefined
      );

      if (!student) {
        res.status(404).json({
          error: "Student not found",
        });
        return;
      }

      // Verify student role
      if (student.role !== "student") {
        res.status(400).json({
          error: "User is not a student",
        });
        return;
      }

      // HOD, Dept Admin, and Mentor can only view students in their department
      if (["hod", "dept_admin", "mentor"].includes(currentUser.role)) {
        if (!currentUser.departmentId) {
          res.status(403).json({
            error: "User must have a department assigned",
          });
          return;
        }

        if (student.departmentId !== currentUser.departmentId) {
          res.status(403).json({
            error: "You can only view students in your own department",
          });
          return;
        }
      }

      res.json({
        success: true,
        student,
      });
    } catch (error: any) {
      console.error("[college-admin/students/get] Error:", error);
      res.status(error.message.includes("not found") ? 404 : 500).json({
        error: error.message || "Failed to fetch student",
      });
    }
  }
);

/**
 * PUT /api/college-admin/students/:studentId
 * Update student information
 * Access: college_admin, principal, hod (only their department), dept_admin (only their department)
 */
router.put(
  "/students/:studentId",
  requireAuth,
  requireRole("product_admin", "college_admin", "principal", "hod", "dept_admin"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const currentUser = req.user!;
      const studentId = req.params.studentId as string;

      const validation = updateStudentSchema.safeParse(req.body);

      if (!validation.success) {
        res.status(400).json({
          error: "Validation failed",
          details: validation.error.issues,
        });
        return;
      }

      // Verify student exists and is a student
      const existingStudent = await UserService.getUserById(
        studentId,
        req.user?.collegeId || undefined
      );
      
      if (!existingStudent) {
        res.status(404).json({
          error: "Student not found",
        });
        return;
      }

      if (existingStudent.role !== "student") {
        res.status(400).json({
          error: "User is not a student",
        });
        return;
      }

      // HOD and Dept Admin can only update students in their department
      if (["hod", "dept_admin"].includes(currentUser.role)) {
        if (!currentUser.departmentId) {
          res.status(403).json({
            error: "User must have a department assigned",
          });
          return;
        }

        if (existingStudent.departmentId !== currentUser.departmentId) {
          res.status(403).json({
            error: "You can only update students in your own department",
          });
          return;
        }

        // HOD and Dept Admin cannot move students to different departments
        if (validation.data.departmentId && validation.data.departmentId !== currentUser.departmentId) {
          res.status(403).json({
            error: "You cannot move students to a different department",
          });
          return;
        }
      }

      const updatedStudent = await UserService.updateUser(studentId, validation.data);

      res.json({
        success: true,
        message: "Student updated successfully",
        student: updatedStudent,
      });
    } catch (error: any) {
      console.error("[college-admin/students/update] Error:", error);
      res.status(error.message.includes("not found") ? 404 : 400).json({
        error: error.message || "Failed to update student",
      });
    }
  }
);

/**
 * DELETE /api/college-admin/students/:studentId
 * Delete a student account
 * Access: college_admin, principal, hod (only their department)
 */
router.delete(
  "/students/:studentId",
  requireAuth,
  requireRole("product_admin", "college_admin", "principal", "hod"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const currentUser = req.user!;
      const studentId = req.params.studentId as string;

      // Verify student exists and is a student
      const existingStudent = await UserService.getUserById(
        studentId,
        req.user?.collegeId || undefined
      );
      
      if (!existingStudent) {
        res.status(404).json({
          error: "Student not found",
        });
        return;
      }

      if (existingStudent.role !== "student") {
        res.status(400).json({
          error: "User is not a student",
        });
        return;
      }

      // HOD can only delete students in their department
      if (currentUser.role === "hod") {
        if (!currentUser.departmentId) {
          res.status(403).json({
            error: "HOD must have a department assigned",
          });
          return;
        }

        if (existingStudent.departmentId !== currentUser.departmentId) {
          res.status(403).json({
            error: "HOD can only delete students in their own department",
          });
          return;
        }
      }

      await UserService.deleteUser(studentId);

      res.json({
        success: true,
        message: "Student deleted successfully",
      });
    } catch (error: any) {
      console.error("[college-admin/students/delete] Error:", error);
      res.status(error.message.includes("not found") ? 404 : 400).json({
        error: error.message || "Failed to delete student",
      });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// ║ TEST MANAGEMENT ENDPOINTS                                                    ║
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Test Validation Schemas ────────────────────────────────────────────────────

// Accepts ISO datetime strings, but gracefully treats null/empty as undefined so drafts can omit scheduling.
const optionalDateString = z.preprocess(
  (val) => (val === null || val === "" ? undefined : val),
  z.string().refine((parsed) => !isNaN(Date.parse(parsed)), { message: "Invalid datetime" }).optional()
);

// Converts null/empty strings to undefined so optional string IDs don't reject null from frontend.
const optionalStringId = z.preprocess(
  (val) => (val === null || val === "" ? undefined : val),
  z.string().optional()
);

const createTestSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title too long"),
  description: z.string().max(1000).optional(),
  instructions: z.string().max(2000).optional(),
  durationMinutes: z.number().int().min(1).max(600).optional(),
  maxAttempts: z.number().int().min(1).max(10).optional(),
  maximumMarks: z.number().int().min(0).optional(),
  passingMarks: z.number().int().min(0).optional(),
  scheduledStartTime: optionalDateString,
  scheduledEndTime: optionalDateString,
  departmentId: optionalStringId,
  batchId: optionalStringId,
});

const updateTestSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  instructions: z.string().max(2000).optional(),
  status: z.enum(["draft", "scheduled", "active", "completed", "archived"]).optional(),
  durationMinutes: z.number().int().min(1).max(600).optional(),
  maxAttempts: z.number().int().min(1).max(10).optional(),
  totalMarks: z.number().int().min(0).optional(),
  passingMarks: z.number().int().min(0).optional(),
  scheduledStartTime: optionalDateString,
  scheduledEndTime: optionalDateString,
  departmentId: optionalStringId,
  batchId: optionalStringId,
});

const createQuestionSchema = z.object({
  type: z.enum(["multiple_choice", "true_false", "short_answer", "long_answer", "coding"]),
  content: z.string().min(1, "Question content is required"),
  marks: z.number().int().min(1).max(100),
  options: z.array(z.string()).min(2).max(10).optional(),
  correctAnswer: z.string().optional(),
  explanation: z.string().max(500).optional(),
  orderIndex: z.number().int().min(0).optional(),
});

const updateQuestionSchema = z.object({
  type: z.enum(["multiple_choice", "true_false", "short_answer", "long_answer", "coding"]).optional(),
  content: z.string().min(1).optional(),
  marks: z.number().int().min(1).max(100).optional(),
  options: z.array(z.string()).min(2).max(10).optional(),
  correctAnswer: z.string().optional(),
  explanation: z.string().max(500).optional(),
  orderIndex: z.number().int().min(0).optional(),
});

const reorderQuestionsSchema = z.object({
  questionIds: z.array(z.string()).min(1),
});

const LIST_TESTS_ALLOWED_SORT_BY = new Set([
  "createdAt",
  "updatedAt",
  "title",
  "status",
  "scheduledStartTime",
  "scheduledEndTime",
  "totalMarks",
]);

const LIST_TESTS_ALLOWED_TIME_FILTERS = new Set(["upcoming", "active", "past", "all"]);

type ParsedListTestsQuery = {
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: "asc" | "desc";
  status?: TestStatus;
  departmentId?: string;
  batchId?: string;
  search?: string;
  timeFilter?: "upcoming" | "active" | "past" | "all";
};

type TimeFilter = NonNullable<ParsedListTestsQuery["timeFilter"]>;

function getQueryStringValue(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value) && value.length > 0 && typeof value[0] === "string") {
    return value[0];
  }

  return undefined;
}

function isTestStatus(value: string): value is TestStatus {
  return Object.values(TestStatus).includes(value as TestStatus);
}

function isTimeFilter(value: string): value is TimeFilter {
  return LIST_TESTS_ALLOWED_TIME_FILTERS.has(value);
}

function parseListTestsQuery(query: AuthRequest["query"]): { data?: ParsedListTestsQuery; error?: string } {
  const pageRaw = getQueryStringValue(query.page) ?? "1";
  const limitRaw = getQueryStringValue(query.limit) ?? "20";
  const sortByRaw = getQueryStringValue(query.sortBy) ?? "createdAt";
  const sortOrderRaw = getQueryStringValue(query.sortOrder) ?? "desc";
  const statusRaw = getQueryStringValue(query.status);
  const departmentId = getQueryStringValue(query.departmentId);
  const batchId = getQueryStringValue(query.batchId);
  const search = getQueryStringValue(query.search);
  const timeFilterRaw = getQueryStringValue(query.timeFilter);

  const page = Number.parseInt(pageRaw, 10);
  const limit = Number.parseInt(limitRaw, 10);

  if (Number.isNaN(page) || page < 1) {
    return { error: "Invalid page value. Must be an integer >= 1" };
  }

  if (Number.isNaN(limit) || limit < 1 || limit > 100) {
    return { error: "Invalid limit value. Must be an integer between 1 and 100" };
  }

  if (!LIST_TESTS_ALLOWED_SORT_BY.has(sortByRaw)) {
    return {
      error: `Invalid sortBy value. Allowed values: ${Array.from(LIST_TESTS_ALLOWED_SORT_BY).join(", ")}`,
    };
  }

  if (sortOrderRaw !== "asc" && sortOrderRaw !== "desc") {
    return { error: "Invalid sortOrder value. Allowed values: asc, desc" };
  }

  if (statusRaw && !isTestStatus(statusRaw)) {
    return {
      error: `Invalid status value. Allowed values: ${Object.values(TestStatus).join(", ")}`,
    };
  }

  if (timeFilterRaw && !isTimeFilter(timeFilterRaw)) {
    return { error: "Invalid timeFilter value. Allowed values: upcoming, active, past, all" };
  }

  return {
    data: {
      page,
      limit,
      sortBy: sortByRaw,
      sortOrder: sortOrderRaw as "asc" | "desc",
      status: statusRaw as TestStatus | undefined,
      departmentId,
      batchId,
      search,
      timeFilter: timeFilterRaw as TimeFilter | undefined,
    },
  };
}

// ─── Test CRUD Endpoints ────────────────────────────────────────────────────────

/**
 * POST /api/college-admin/tests
 * Create a new test
 */
router.post(
  "/tests",
  requireAuth,
  requireRole("product_admin", "college_admin", "principal", "hod", "dept_admin", "mentor"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const validation = createTestSchema.safeParse(req.body);

      if (!validation.success) {
        res.status(400).json({
          error: "Validation failed",
          details: validation.error.issues,
        });
        return;
      }

      const data = validation.data;

      // Convert date strings to Date objects
      const testData = {
        ...data,
        scheduledStartTime: data.scheduledStartTime ? new Date(data.scheduledStartTime) : undefined,
        scheduledEndTime: data.scheduledEndTime ? new Date(data.scheduledEndTime) : undefined,
        createdById: user.id,
      };

      // If user is HOD/dept_admin and no department specified, use their department
      if ((user.role === "hod" || user.role === "dept_admin") && !testData.departmentId) {
        if (!user.departmentId) {
          res.status(400).json({
            error: "Department is required for your role",
          });
          return;
        }
        testData.departmentId = user.departmentId;
      }

      const test = await TestService.createTest(testData);

      res.status(201).json({
        success: true,
        message: "Test created successfully",
        test,
      });
    } catch (error: any) {
      console.error("[college-admin/tests/create] Error:", error);
      res.status(400).json({
        error: error.message || "Failed to create test",
      });
    }
  }
);

/**
 * GET /api/college-admin/tests
 * Get all tests with pagination and filters
 */
router.get(
  "/tests",
  requireAuth,
  requireRole("product_admin", "college_admin", "principal", "hod", "dept_admin", "mentor"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const parsedQuery = parseListTestsQuery(req.query);
      if (!parsedQuery.data) {
        res.status(400).json({ error: parsedQuery.error ?? "Invalid query parameters" });
        return;
      }

      const {
        page,
        limit,
        sortBy,
        sortOrder,
        status,
        departmentId,
        batchId,
        search,
        timeFilter,
      } = parsedQuery.data;

      const filters: any = {};

      filters.collegeId = user.collegeId || undefined;

      // Apply role-based filters
      if ((user.role === "hod" || user.role === "dept_admin" || user.role === "mentor") && user.departmentId) {
        filters.departmentId = user.departmentId;
      }

      // Override with query params if product_admin/college_admin/principal
      if (user.role === "product_admin" || user.role === "college_admin" || user.role === "principal") {
        if (departmentId) filters.departmentId = departmentId;
        if (batchId) filters.batchId = batchId;
      }

      if (status) filters.status = status;
      if (search) filters.search = search;
      if (timeFilter) filters.timeFilter = timeFilter;

      const result = await TestService.getTests(filters, {
        page,
        limit,
        sortBy,
        sortOrder,
      });

      res.json(result);
    } catch (error: any) {
      console.error("[college-admin/tests/list] Error:", error);
      res.status(500).json({
        error: error.message || "Failed to fetch tests",
      });
    }
  }
);

/**
 * GET /api/college-admin/tests/:testId
 * Get test by ID
 */
router.get(
  "/tests/:testId",
  requireAuth,
  requireRole("product_admin", "college_admin", "principal", "hod", "dept_admin", "mentor"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const testId = req.params.testId as string;
      const user = req.user!;

      const test = await TestService.getTestById(testId);

      // Check access permissions
      if (user.role !== "product_admin" && user.role !== "college_admin" && user.role !== "principal") {
        if (user.role === "hod" || user.role === "dept_admin" || user.role === "mentor") {
          if (test.departmentId !== user.departmentId) {
            res.status(403).json({
              error: "You can only view tests in your department",
            });
            return;
          }
        }
      }

      res.json({ test });
    } catch (error: any) {
      console.error("[college-admin/tests/get] Error:", error);
      res.status(error.message.includes("not found") ? 404 : 500).json({
        error: error.message || "Failed to fetch test",
      });
    }
  }
);

/**
 * PUT /api/college-admin/tests/:testId
 * Update test
 */
router.put(
  "/tests/:testId",
  requireAuth,
  requireRole("product_admin", "college_admin", "principal", "hod", "dept_admin", "mentor"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const testId = req.params.testId as string;
      const user = req.user!;

      const validation = updateTestSchema.safeParse(req.body);

      if (!validation.success) {
        res.status(400).json({
          error: "Validation failed",
          details: validation.error.issues,
        });
        return;
      }

      // Check if user has permission to edit this test
      const existingTest = await TestService.getTestById(testId);

      if (user.role !== "product_admin" && user.role !== "college_admin" && user.role !== "principal") {
        if (existingTest.createdById !== user.id) {
          if (user.role === "hod" || user.role === "dept_admin") {
            if (existingTest.departmentId !== user.departmentId) {
              res.status(403).json({
                error: "You can only edit tests in your department",
              });
              return;
            }
          } else {
            res.status(403).json({
              error: "You can only edit tests you created",
            });
            return;
          }
        }
      }

      const data = validation.data;
      const testData = {
        ...data,
        scheduledStartTime: data.scheduledStartTime ? new Date(data.scheduledStartTime) : undefined,
        scheduledEndTime: data.scheduledEndTime ? new Date(data.scheduledEndTime) : undefined,
      };

      const test = await TestService.updateTest(testId, testData);

      res.json({
        success: true,
        message: "Test updated successfully",
        test,
      });
    } catch (error: any) {
      console.error("[college-admin/tests/update] Error:", error);
      res.status(error.message.includes("not found") ? 404 : 400).json({
        error: error.message || "Failed to update test",
      });
    }
  }
);

/**
 * DELETE /api/college-admin/tests/:testId
 * Delete test
 */
router.delete(
  "/tests/:testId",
  requireAuth,
  requireRole("product_admin", "college_admin", "principal", "hod", "dept_admin"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const testId = req.params.testId as string;
      const user = req.user!;

      // Check if user has permission to delete this test
      const existingTest = await TestService.getTestById(testId);

      if (user.role !== "product_admin" && user.role !== "college_admin" && user.role !== "principal") {
        if (existingTest.createdById !== user.id) {
          if (user.role === "hod" || user.role === "dept_admin") {
            if (existingTest.departmentId !== user.departmentId) {
              res.status(403).json({
                error: "You can only delete tests in your department",
              });
              return;
            }
          } else {
            res.status(403).json({
              error: "You can only delete tests you created",
            });
            return;
          }
        }
      }

      const result = await TestService.deleteTest(testId);

      res.json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      console.error("[college-admin/tests/delete] Error:", error);
      res.status(error.message.includes("not found") ? 404 : 400).json({
        error: error.message || "Failed to delete test",
      });
    }
  }
);

// ─── Question Management Endpoints ──────────────────────────────────────────────

/**
 * POST /api/college-admin/tests/:testId/questions
 * Add question to test
 */
router.post(
  "/tests/:testId/questions",
  requireAuth,
  requireRole("product_admin", "college_admin", "principal", "hod", "dept_admin", "mentor"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const testId = req.params.testId as string;
      const user = req.user!;

      const validation = createQuestionSchema.safeParse(req.body);

      if (!validation.success) {
        res.status(400).json({
          error: "Validation failed",
          details: validation.error.issues,
        });
        return;
      }

      // Check if user has permission to add questions
      const test = await TestService.getTestById(testId);

      if (user.role !== "product_admin" && user.role !== "college_admin" && user.role !== "principal") {
        if (test.createdById !== user.id) {
          if (user.role === "hod" || user.role === "dept_admin") {
            if (test.departmentId !== user.departmentId) {
              res.status(403).json({
                error: "You can only add questions to tests in your department",
              });
              return;
            }
          } else {
            res.status(403).json({
              error: "You can only add questions to tests you created",
            });
            return;
          }
        }
      }

      const data = validation.data;
      const question = await TestService.addQuestion(testId, data);

      res.status(201).json({
        success: true,
        message: "Question added successfully",
        question,
      });
    } catch (error: any) {
      console.error("[college-admin/tests/questions/create] Error:", error);
      res.status(error.message.includes("not found") ? 404 : 400).json({
        error: error.message || "Failed to add question",
      });
    }
  }
);

/**
 * GET /api/college-admin/tests/:testId/questions
 * Get all questions for a test
 */
router.get(
  "/tests/:testId/questions",
  requireAuth,
  requireRole("product_admin", "college_admin", "principal", "hod", "dept_admin", "mentor"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const testId = req.params.testId as string;
      const user = req.user!;

      // Check access permissions
      const test = await TestService.getTestById(testId);

      if (user.role !== "product_admin" && user.role !== "college_admin" && user.role !== "principal") {
        if (user.role === "hod" || user.role === "dept_admin" || user.role === "mentor") {
          if (test.departmentId !== user.departmentId) {
            res.status(403).json({
              error: "You can only view questions for tests in your department",
            });
            return;
          }
        }
      }

      const questions = await TestService.getTestQuestions(testId);

      res.json({ questions });
    } catch (error: any) {
      console.error("[college-admin/tests/questions/list] Error:", error);
      res.status(error.message.includes("not found") ? 404 : 500).json({
        error: error.message || "Failed to fetch questions",
      });
    }
  }
);

/**
 * PUT /api/college-admin/tests/:testId/questions/:questionId
 * Update question
 */
router.put(
  "/tests/:testId/questions/:questionId",
  requireAuth,
  requireRole("product_admin", "college_admin", "principal", "hod", "dept_admin", "mentor"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const testId = req.params.testId as string;
      const questionId = req.params.questionId as string;
      const user = req.user!;

      const validation = updateQuestionSchema.safeParse(req.body);

      if (!validation.success) {
        res.status(400).json({
          error: "Validation failed",
          details: validation.error.issues,
        });
        return;
      }

      // Check if user has permission to edit questions
      const test = await TestService.getTestById(testId);

      if (user.role !== "product_admin" && user.role !== "college_admin" && user.role !== "principal") {
        if (test.createdById !== user.id) {
          if (user.role === "hod" || user.role === "dept_admin") {
            if (test.departmentId !== user.departmentId) {
              res.status(403).json({
                error: "You can only edit questions in tests in your department",
              });
              return;
            }
          } else {
            res.status(403).json({
              error: "You can only edit questions in tests you created",
            });
            return;
          }
        }
      }

      const data = validation.data;
      const question = await TestService.updateQuestion(questionId, data);

      res.json({
        success: true,
        message: "Question updated successfully",
        question,
      });
    } catch (error: any) {
      console.error("[college-admin/tests/questions/update] Error:", error);
      res.status(error.message.includes("not found") ? 404 : 400).json({
        error: error.message || "Failed to update question",
      });
    }
  }
);

/**
 * DELETE /api/college-admin/tests/:testId/questions/:questionId
 * Delete question
 */
router.delete(
  "/tests/:testId/questions/:questionId",
  requireAuth,
  requireRole("product_admin", "college_admin", "principal", "hod", "dept_admin", "mentor"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const testId = req.params.testId as string;
      const questionId = req.params.questionId as string;
      const user = req.user!;

      // Check if user has permission to delete questions
      const test = await TestService.getTestById(testId);

      if (user.role !== "product_admin" && user.role !== "college_admin" && user.role !== "principal") {
        if (test.createdById !== user.id) {
          if (user.role === "hod" || user.role === "dept_admin") {
            if (test.departmentId !== user.departmentId) {
              res.status(403).json({
                error: "You can only delete questions from tests in your department",
              });
              return;
            }
          } else {
            res.status(403).json({
              error: "You can only delete questions from tests you created",
            });
            return;
          }
        }
      }

      const result = await TestService.deleteQuestion(questionId);

      res.json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      console.error("[college-admin/tests/questions/delete] Error:", error);
      res.status(error.message.includes("not found") ? 404 : 400).json({
        error: error.message || "Failed to delete question",
      });
    }
  }
);

/**
 * PUT /api/college-admin/tests/:testId/questions/reorder
 * Reorder questions
 */
router.put(
  "/tests/:testId/questions/reorder",
  requireAuth,
  requireRole("product_admin", "college_admin", "principal", "hod", "dept_admin", "mentor"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const testId = req.params.testId as string;
      const user = req.user!;

      const validation = reorderQuestionsSchema.safeParse(req.body);

      if (!validation.success) {
        res.status(400).json({
          error: "Validation failed",
          details: validation.error.issues,
        });
        return;
      }

      // Check if user has permission to reorder questions
      const test = await TestService.getTestById(testId);

      if (user.role !== "product_admin" && user.role !== "college_admin" && user.role !== "principal") {
        if (test.createdById !== user.id) {
          if (user.role === "hod" || user.role === "dept_admin") {
            if (test.departmentId !== user.departmentId) {
              res.status(403).json({
                error: "You can only reorder questions in tests in your department",
              });
              return;
            }
          } else {
            res.status(403).json({
              error: "You can only reorder questions in tests you created",
            });
            return;
          }
        }
      }

      const { questionIds } = validation.data;
      const result = await TestService.reorderQuestions(testId, questionIds);

      res.json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      console.error("[college-admin/tests/questions/reorder] Error:", error);
      res.status(error.message.includes("not found") ? 404 : 400).json({
        error: error.message || "Failed to reorder questions",
      });
    }
  }
);

// ─── Test Status Endpoint ──────────────────────────────────────────────────────

/**
 * GET /api/college-admin/tests/:testId/status
 * Get test status with real-time calculation
 */
router.get(
  "/tests/:testId/status",
  requireAuth,
  requireRole("product_admin", "college_admin", "principal", "hod", "dept_admin", "mentor"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const testId = req.params.testId as string;
      const user = req.user!;

      // Check access permissions
      const test = await TestService.getTestById(testId);

      if (user.role !== "product_admin" && user.role !== "college_admin" && user.role !== "principal") {
        if (user.role === "hod" || user.role === "dept_admin" || user.role === "mentor") {
          if (test.departmentId !== user.departmentId) {
            res.status(403).json({
              error: "You can only view status for tests in your department",
            });
            return;
          }
        }
      }

      const status = await TestService.getTestStatus(testId);

      res.json({ status });
    } catch (error: any) {
      console.error("[college-admin/tests/status] Error:", error);
      res.status(error.message.includes("not found") ? 404 : 500).json({
        error: error.message || "Failed to fetch test status",
      });
    }
  }
);

// ─── Assign Test to Batch ──────────────────────────────────────────────────────

/**
 * POST /api/college-admin/tests/:testId/assign-batch
 * Assign a test to a batch
 */
router.post(
  "/tests/:testId/assign-batch",
  requireAuth,
  requireRole("product_admin", "college_admin", "principal", "hod", "dept_admin", "mentor"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const testId = req.params.testId as string;
      const user = req.user!;

      // Validate request body
      const assignBatchSchema = z.object({
        batchId: z.string().min(1, "Batch ID is required"),
      });

      const { batchId } = assignBatchSchema.parse(req.body);

      // Check access permissions for the test
      const test = await TestService.getTestById(testId);

      if (user.role !== "product_admin" && user.role !== "college_admin" && user.role !== "principal") {
        if (user.role === "hod" || user.role === "dept_admin" || user.role === "mentor") {
          if (test.departmentId !== user.departmentId) {
            res.status(403).json({
              error: "You can only assign batches to tests in your department",
            });
            return;
          }
        }
      }

      // Assign test to batch
      const updatedTest = await TestService.assignTestToBatch(testId, batchId);

      res.json({
        success: true,
        test: updatedTest,
        message: "Test assigned to batch successfully",
      });
    } catch (error: any) {
      console.error("[college-admin/tests/assign-batch] Error:", error);

      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: "Validation error",
          details: error.issues,
        });
        return;
      }

      let statusCode = 500;
      if (error.message.includes("not found")) {
        statusCode = 404;
      } else if (error.message.includes("same department")) {
        statusCode = 400;
      }

      res.status(statusCode).json({
        error: error.message || "Failed to assign test to batch",
      });
    }
  }
);

// ─── Reports & Analytics Endpoints ──────────────────────────────────────────────

/**
 * GET /api/college-admin/report/student/:studentId
 * Get performance report for a single student
 */
router.get(
  "/report/student/:studentId",
  requireAuth,
  requireRole("product_admin", "college_admin", "principal", "hod", "dept_admin", "mentor"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const studentId = req.params.studentId as string;
      const user = req.user!;

      // Check permissions
      const student = await prisma.user.findUnique({
        where: { id: studentId },
        select: { departmentId: true, role: true },
      });

      if (!student) {
        res.status(404).json({ error: "Student not found" });
        return;
      }

      // Verify user has access to this student's data
      if (user.role !== "product_admin" && user.role !== "college_admin" && user.role !== "principal") {
        if (user.role === "hod" || user.role === "dept_admin") {
          if (student.departmentId !== user.departmentId) {
            res.status(403).json({ error: "You can only view students from your department" });
            return;
          }
        } else if (user.role === "mentor") {
          // Mentors can view students in their department
          if (student.departmentId !== user.departmentId) {
            res.status(403).json({ error: "You can only view students from your department" });
            return;
          }
        }
      }

      const performance = await reportService.getStudentPerformance(studentId);

      res.json({
        success: true,
        data: performance,
      });
    } catch (error: any) {
      console.error("[college-admin/report/student] Error:", error);
      res.status(error.message.includes("not found") ? 404 : 400).json({
        error: error.message || "Failed to fetch student performance",
      });
    }
  }
);

/**
 * GET /api/college-admin/report/batch/:batchId
 * Get batch-wise performance statistics
 */
router.get(
  "/report/batch/:batchId",
  requireAuth,
  requireRole("product_admin", "college_admin", "principal", "hod", "dept_admin", "mentor"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const batchId = req.params.batchId as string;
      const user = req.user!;

      // Check permissions
      const batch = await prisma.batch.findUnique({
        where: { id: batchId },
        select: { departmentId: true },
      });

      if (!batch) {
        res.status(404).json({ error: "Batch not found" });
        return;
      }

      // Verify user has access to this batch
      if (user.role !== "product_admin" && user.role !== "college_admin" && user.role !== "principal") {
        if (batch.departmentId !== user.departmentId) {
          res.status(403).json({ error: "You can only view batches from your department" });
          return;
        }
      }

      const performance = await reportService.getBatchPerformance(batchId);

      res.json({
        success: true,
        data: performance,
      });
    } catch (error: any) {
      console.error("[college-admin/report/batch] Error:", error);
      res.status(error.message.includes("not found") ? 404 : 400).json({
        error: error.message || "Failed to fetch batch performance",
      });
    }
  }
);

/**
 * GET /api/college-admin/report/batch/:batchId/leaderboard
 * Get leaderboard for a batch
 * Query params: ?limit=50
 */
router.get(
  "/report/batch/:batchId/leaderboard",
  requireAuth,
  requireRole("product_admin", "college_admin", "principal", "hod", "dept_admin", "mentor"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const batchId = req.params.batchId as string;
      const { limit } = req.query;
      const user = req.user!;

      // Check permissions
      const batch = await prisma.batch.findUnique({
        where: { id: batchId },
        select: { departmentId: true },
      });

      if (!batch) {
        res.status(404).json({ error: "Batch not found" });
        return;
      }

      // Verify user has access to this batch
      if (user.role !== "product_admin" && user.role !== "college_admin" && user.role !== "principal") {
        if (batch.departmentId !== user.departmentId) {
          res.status(403).json({ error: "You can only view leaderboards for batches in your department" });
          return;
        }
      }

      const limitNum = limit ? Math.min(Number.parseInt(limit as string, 10) || 50, 100) : 50;
      const leaderboardData = await reportService.getBatchLeaderboard(batchId, limitNum);

      res.json({
        success: true,
        limit: limitNum,
        count: leaderboardData.leaderboard.length,
        leaderboard: leaderboardData.leaderboard,
        data: leaderboardData.leaderboard,
      });
    } catch (error: any) {
      console.error("[college-admin/report/batch/leaderboard] Error:", error);
      res.status(error.message.includes("not found") ? 404 : 400).json({
        error: error.message || "Failed to fetch leaderboard",
      });
    }
  }
);

/**
 * GET /api/college-admin/report/test/:testId/analysis
 * Get detailed analysis of a test (performance, difficulty, question analysis)
 */
router.get(
  "/report/test/:testId/analysis",
  requireAuth,
  requireRole("product_admin", "college_admin", "principal", "hod", "dept_admin", "mentor"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const testId = req.params.testId as string;
      const user = req.user!;

      // Check permissions
      const test = await prisma.test.findUnique({
        where: { id: testId },
        select: { departmentId: true },
      });

      if (!test) {
        res.status(404).json({ error: "Test not found" });
        return;
      }

      // Verify user has access to this test
      if (user.role !== "product_admin" && user.role !== "college_admin" && user.role !== "principal") {
        if (test.departmentId !== user.departmentId) {
          res.status(403).json({ error: "You can only view analysis for tests in your department" });
          return;
        }
      }

      const analysis = await reportService.getTestAnalysis(testId);

      res.json({
        success: true,
        data: analysis,
      });
    } catch (error: any) {
      console.error("[college-admin/report/test/analysis] Error:", error);
      res.status(error.message.includes("not found") ? 404 : 400).json({
        error: error.message || "Failed to fetch test analysis",
      });
    }
  }
);

/**
 * GET /api/college-admin/report/student/:studentId/skillset
 * Get skillset summary for a student (topics covered, proficiency levels)
 */
router.get(
  "/report/student/:studentId/skillset",
  requireAuth,
  requireRole("product_admin", "college_admin", "principal", "hod", "dept_admin", "mentor"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const studentId = req.params.studentId as string;
      const user = req.user!;

      // Check permissions
      const student = await prisma.user.findUnique({
        where: { id: studentId },
        select: { departmentId: true, role: true },
      });

      if (!student) {
        res.status(404).json({ error: "Student not found" });
        return;
      }

      // Verify user has access to this student's data
      if (user.role !== "product_admin" && user.role !== "college_admin" && user.role !== "principal") {
        if (user.role === "hod" || user.role === "dept_admin") {
          if (student.departmentId !== user.departmentId) {
            res.status(403).json({ error: "You can only view students from your department" });
            return;
          }
        } else if (user.role === "mentor") {
          // Mentors can view students in their department
          if (student.departmentId !== user.departmentId) {
            res.status(403).json({ error: "You can only view students from your department" });
            return;
          }
        }
      }

      const skillset = await reportService.getSkillsetSummary(studentId);

      res.json({
        success: true,
        data: skillset,
      });
    } catch (error: any) {
      console.error("[college-admin/report/student/skillset] Error:", error);
      res.status(error.message.includes("not found") ? 404 : 400).json({
        error: error.message || "Failed to fetch skillset summary",
      });
    }
  }
);

/**
 * GET /api/college-admin/report/department/:departmentId
 * Get department-wide performance report
 */
router.get(
  "/report/department/:departmentId",
  requireAuth,
  requireRole("product_admin", "college_admin", "principal", "hod", "dept_admin"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const departmentId = req.params.departmentId as string;
      const user = req.user!;

      // Check permissions
      const department = await prisma.department.findUnique({
        where: { id: departmentId },
        select: { id: true },
      });

      if (!department) {
        res.status(404).json({ error: "Department not found" });
        return;
      }

      // Verify user has access to this department
      if (user.role !== "product_admin" && user.role !== "college_admin" && user.role !== "principal") {
        if (user.role === "hod" || user.role === "dept_admin") {
          if (departmentId !== user.departmentId) {
            res.status(403).json({ error: "You can only view reports for your department" });
            return;
          }
        }
      }

      const performance = await reportService.getDepartmentPerformance(departmentId);

      res.json({
        success: true,
        data: performance,
      });
    } catch (error: any) {
      console.error("[college-admin/report/department] Error:", error);
      res.status(error.message.includes("not found") ? 404 : 400).json({
        error: error.message || "Failed to fetch department performance",
      });
    }
  }
);

/**
 * @openapi
 * /api/college-admin/questions/coding:
 *   get:
 *     tags: [College Admin - Tests]
 *     summary: Retrieve all coding questions
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       "200":
 *         description: List of coding questions
 */
router.get(
  "/questions/coding",
  requireAuth,
  requireRole("product_admin", "college_admin", "principal", "hod", "dept_admin", "mentor"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const skip = (page - 1) * limit;

      const questions = await prisma.question.findMany({
        where: {
          type: { in: ["dsa", "coding"] },
        },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { tags: true },
      });
      
      const total = await prisma.question.count({
        where: {
          type: { in: ["dsa", "coding"] },
        }
      });

      res.json({
        success: true,
        data: questions,
        meta: { total, page, limit }
      });
    } catch (error: any) {
      console.error("[college-admin/questions/coding] Error:", error);
      res.status(500).json({ error: "Failed to retrieve coding questions" });
    }
  }
);

/**
 * @openapi
 * /api/college-admin/questions/mcq:
 *   get:
 *     tags: [College Admin - Tests]
 *     summary: Retrieve all MCQ questions
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       "200":
 *         description: List of MCQ questions
 */
router.get(
  "/questions/mcq",
  requireAuth,
  requireRole("product_admin", "college_admin", "principal", "hod", "dept_admin", "mentor"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const skip = (page - 1) * limit;

      const questions = await prisma.question.findMany({
        where: {
          type: { in: ["mcq", "multiple_choice", "true_false"] },
        },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { tags: true },
      });
      
      const total = await prisma.question.count({
        where: {
          type: { in: ["mcq", "multiple_choice", "true_false"] },
        }
      });

      res.json({
        success: true,
        data: questions,
        meta: { total, page, limit }
      });
    } catch (error: any) {
      console.error("[college-admin/questions/mcq] Error:", error);
      res.status(500).json({ error: "Failed to retrieve MCQ questions" });
    }
  }
);

export default router;




