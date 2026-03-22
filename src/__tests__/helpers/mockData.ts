/**
 * Mock user data for testing
 */
export const mockUsers = {
  collegeAdmin: {
    id: "test_college_admin_id",
    email: "admin@college.test",
    name: "College Admin",
    role: "college_admin" as const,
    emailVerified: true,
    image: null,
    phone: "+1234567890",
    departmentId: null,
    batchId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  principal: {
    id: "test_principal_id",
    email: "principal@college.test",
    name: "Principal",
    role: "principal" as const,
    emailVerified: true,
    image: null,
    phone: "+1234567891",
    departmentId: null,
    batchId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  hod: {
    id: "test_hod_id",
    email: "hod@college.test",
    name: "HOD",
    role: "hod" as const,
    emailVerified: true,
    image: null,
    phone: "+1234567892",
    departmentId: "dept_test_id",
    batchId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  deptAdmin: {
    id: "test_dept_admin_id",
    email: "deptadmin@college.test",
    name: "Dept Admin",
    role: "dept_admin" as const,
    emailVerified: true,
    image: null,
    phone: "+1234567893",
    departmentId: "dept_test_id",
    batchId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  mentor: {
    id: "test_mentor_id",
    email: "mentor@college.test",
    name: "Mentor",
    role: "mentor" as const,
    emailVerified: true,
    image: null,
    phone: "+1234567894",
    departmentId: "dept_test_id",
    batchId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  student: {
    id: "test_student_id",
    email: "student@college.test",
    name: "Test Student",
    role: "student" as const,
    emailVerified: true,
    image: null,
    phone: "+1234567895",
    departmentId: "dept_test_id",
    batchId: "batch_test_id",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};

/**
 * Mock department data
 */
export const mockDepartment = {
  id: "dept_test_id",
  name: "Computer Science",
  code: "CSE",
  description: "Department of Computer Science",
  hodId: "test_hod_id",
  createdAt: new Date(),
  updatedAt: new Date(),
};

/**
 * Mock batch data
 */
export const mockBatch = {
  id: "batch_test_id",
  name: "2024 Batch A",
  code: "CSE2024A",
  year: 2,
  semester: 3,
  departmentId: "dept_test_id",
  mentorId: "test_mentor_id",
  createdAt: new Date(),
  updatedAt: new Date(),
};

/**
 * Generate a mock session cookie for testing
 */
export function generateMockSessionCookie(userId: string): string {
  return `better-auth.session_token=mock_session_${userId}`;
}

/**
 * Create authenticated request headers
 */
export function createAuthHeaders(user: typeof mockUsers[keyof typeof mockUsers]) {
  return {
    Cookie: generateMockSessionCookie(user.id),
  };
}
