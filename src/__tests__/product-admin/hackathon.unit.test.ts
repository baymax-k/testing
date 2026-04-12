import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Response } from "express";

vi.mock("../../config/prisma.js", () => {
  const prisma = {
    college: {
      findUnique: vi.fn(),
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
const {
  createHackathon,
  getHackathons,
  getHackathonById,
  getHackathonStats,
  updateHackathon,
  updateHackathonStatus,
  deleteHackathon,
  updateTeam,
} = await import("../../modules/product-admin/hackathon.controller.js");

function createMockRes(): Response {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as any;
}

describe("Product Admin Hackathon Controller - Unit Tests", () => {
  const now = new Date("2026-01-01T10:00:00.000Z");

  const college = {
    id: "college-1",
    name: "CodeEthnics College",
    code: "CEC",
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
    createdBy: {
      id: "super-1",
      email: "super.admin@example.com",
      name: "Super Admin",
    },
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
    leaderUserId: "super-1",
    projectTitle: null,
    projectDescription: null,
    repositoryUrl: null,
    demoUrl: null,
    score: null,
    ranking: null,
    createdAt: now,
    updatedAt: now,
    leader: {
      id: "super-1",
      email: "super.admin@example.com",
      name: "Super Admin",
    },
    members: [],
    _count: { members: 0 },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(prisma.college.findUnique).mockResolvedValue(college as any);

    vi.mocked(prisma.hackathon.findUnique).mockResolvedValue({
      ...hackathon,
      teams: [hackathonTeam],
      participants: [],
      _count: { teams: 1, participants: 0 },
    } as any);

    vi.mocked(prisma.hackathon.findMany).mockResolvedValue([
      { ...hackathon, _count: { teams: 1, participants: 0 } },
    ] as any);

    vi.mocked(prisma.hackathon.create).mockResolvedValue(hackathon as any);
    vi.mocked(prisma.hackathon.update).mockResolvedValue(hackathon as any);
    vi.mocked(prisma.hackathon.delete).mockResolvedValue(hackathon as any);
    vi.mocked(prisma.hackathon.count).mockResolvedValue(1 as any);

    vi.mocked(prisma.hackathonTeam.findUnique).mockResolvedValue(hackathonTeam as any);
    vi.mocked(prisma.hackathonTeam.update).mockResolvedValue({
      ...hackathonTeam,
      score: 95,
      ranking: 1,
      members: [],
    } as any);
  });

  it("createHackathon creates a new hackathon", async () => {
    const req = {
      user: { userId: "super-1", role: "product_admin" },
      body: {
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
      },
    } as any;
    const res = createMockRes();

    await createHackathon(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("createHackathon accepts date-only strings and normalizes to Date", async () => {
    const req = {
      user: { userId: "super-1", role: "product_admin" },
      body: {
        title: "Date Only Hackathon",
        description: "Description",
        shortDescription: "Short",
        collegeId: "college-1",
        startDate: "2026-05-10",
        endDate: "2026-05-12",
        registrationDeadline: "2026-05-05",
        maxTeams: 100,
        maxTeamSize: 5,
        minTeamSize: 1,
        theme: "AI",
        isPublic: true,
        allowRemoteParticipation: true,
      },
    } as any;
    const res = createMockRes();

    await createHackathon(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const createArg = vi.mocked(prisma.hackathon.create).mock.calls[0]?.[0] as any;
    expect(createArg.data.startDate).toBeInstanceOf(Date);
    expect(createArg.data.endDate).toBeInstanceOf(Date);
    expect(createArg.data.registrationDeadline).toBeInstanceOf(Date);
  });

  it("getHackathons returns filtered hackathons", async () => {
    const req = {
      user: { userId: "super-1", role: "product_admin", collegeId: null },
      query: { page: "1", limit: "20" },
    } as any;
    const res = createMockRes();

    await getHackathons(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("getHackathonById returns details", async () => {
    const req = {
      user: { userId: "super-1", role: "product_admin", collegeId: null },
      params: { hackathonId: "hack-1" },
    } as any;
    const res = createMockRes();

    await getHackathonById(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("getHackathonStats returns computed stats", async () => {
    const req = {
      user: { userId: "super-1", role: "product_admin", collegeId: null },
      params: { hackathonId: "hack-1" },
    } as any;
    const res = createMockRes();

    await getHackathonStats(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("updateHackathon updates fields", async () => {
    const req = {
      user: { userId: "super-1", role: "product_admin" },
      params: { hackathonId: "hack-1" },
      body: { title: "Updated Hackathon" },
    } as any;
    const res = createMockRes();

    await updateHackathon(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("updateHackathonStatus updates status", async () => {
    const req = {
      user: { userId: "super-1", role: "product_admin" },
      params: { hackathonId: "hack-1" },
      body: { status: "registration_open" },
    } as any;
    const res = createMockRes();

    await updateHackathonStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("deleteHackathon removes hackathon", async () => {
    const req = {
      user: { userId: "super-1", role: "product_admin" },
      params: { hackathonId: "hack-1" },
    } as any;
    const res = createMockRes();

    await deleteHackathon(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("updateTeam updates team details", async () => {
    const req = {
      user: { userId: "super-1", role: "product_admin", collegeId: null },
      params: { hackathonId: "hack-1", teamId: "team-1" },
      body: { score: 95, ranking: 1 },
    } as any;
    const res = createMockRes();

    await updateTeam(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });
});
