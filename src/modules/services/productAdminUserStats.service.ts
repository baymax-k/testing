import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma.js";

interface BatchStatsNode {
  id: string;
  name: string;
  code: string;
  year: number;
  userCount: number;
}

interface YearStatsNode {
  year: number;
  label: string;
  userCount: number;
  batches: BatchStatsNode[];
}

interface DepartmentStatsNode {
  id: string;
  name: string;
  code: string;
  userCount: number;
  years: YearStatsNode[];
}

interface CollegeStatsNode {
  id: string;
  name: string;
  code: string;
  userCount: number;
  departments: DepartmentStatsNode[];
}

interface UserHierarchySummary {
  totalColleges: number;
  totalDepartments: number;
  totalYears: number;
  totalBatches: number;
  totalUsers: number;
}

export interface ProductAdminUserStatsResponse {
  summary: UserHierarchySummary;
  hierarchy: CollegeStatsNode[];
}

interface GetUserStatsOptions {
  search?: string;
}

interface BatchRecord {
  id: string;
  name: string;
  code: string;
  year: number;
  _count: {
    students: number;
  };
}

interface DepartmentRecord {
  id: string;
  name: string;
  code: string;
  _count: {
    users: number;
  };
  batches: BatchRecord[];
}

interface CollegeRecord {
  id: string;
  name: string;
  code: string;
  _count: {
    users: number;
  };
  departments: DepartmentRecord[];
}

function formatOrdinal(num: number): string {
  const abs = Math.abs(num);
  const mod100 = abs % 100;

  if (mod100 >= 11 && mod100 <= 13) {
    return `${num}th`;
  }

  switch (abs % 10) {
    case 1:
      return `${num}st`;
    case 2:
      return `${num}nd`;
    case 3:
      return `${num}rd`;
    default:
      return `${num}th`;
  }
}

function toYearLabel(year: number): string {
  return `${formatOrdinal(year)} Year`;
}

function includesText(value: string, searchText: string): boolean {
  return value.toLowerCase().includes(searchText);
}

function buildCollegeWhereClause(searchText: string, hasSearch: boolean): Prisma.CollegeWhereInput {
  if (!hasSearch) {
    return {};
  }

  return {
    OR: [
      { name: { contains: searchText, mode: "insensitive" } },
      { code: { contains: searchText, mode: "insensitive" } },
      {
        departments: {
          some: {
            OR: [
              { name: { contains: searchText, mode: "insensitive" } },
              { code: { contains: searchText, mode: "insensitive" } },
              {
                batches: {
                  some: {
                    OR: [
                      { name: { contains: searchText, mode: "insensitive" } },
                      { code: { contains: searchText, mode: "insensitive" } },
                    ],
                  },
                },
              },
            ],
          },
        },
      },
    ],
  };
}

function isCollegeMatch(college: CollegeRecord, searchText: string, hasSearch: boolean): boolean {
  if (!hasSearch) {
    return true;
  }

  return includesText(college.name, searchText) || includesText(college.code, searchText);
}

function isDepartmentMatch(department: DepartmentRecord, searchText: string, hasSearch: boolean): boolean {
  if (!hasSearch) {
    return true;
  }

  return includesText(department.name, searchText) || includesText(department.code, searchText);
}

function shouldIncludeBatch(batch: BatchRecord, searchText: string, hasSearch: boolean): boolean {
  if (!hasSearch) {
    return true;
  }

  const batchYearLabel = toYearLabel(batch.year);
  return (
    includesText(batch.name, searchText) ||
    includesText(batch.code, searchText) ||
    includesText(batchYearLabel, searchText)
  );
}

function mapBatchesToYears(batches: BatchRecord[]): YearStatsNode[] {
  const yearBucket = new Map<number, BatchStatsNode[]>();

  for (const batch of batches) {
    const mappedBatch: BatchStatsNode = {
      id: batch.id,
      name: batch.name,
      code: batch.code,
      year: batch.year,
      userCount: batch._count.students,
    };

    const currentYearBatches = yearBucket.get(batch.year) ?? [];
    currentYearBatches.push(mappedBatch);
    yearBucket.set(batch.year, currentYearBatches);
  }

  return Array.from(yearBucket.entries())
    .sort(([a], [b]) => a - b)
    .map(([year, mappedBatches]) => ({
      year,
      label: toYearLabel(year),
      userCount: mappedBatches.reduce((sum, batch) => sum + batch.userCount, 0),
      batches: mappedBatches,
    }));
}

function mapDepartments(
  departments: DepartmentRecord[],
  searchText: string,
  hasSearch: boolean,
  collegeMatches: boolean
): DepartmentStatsNode[] {
  const mappedDepartments: DepartmentStatsNode[] = [];

  for (const department of departments) {
    const departmentMatches = isDepartmentMatch(department, searchText, hasSearch);
    const includeAllBatches = !hasSearch || collegeMatches || departmentMatches;

    const selectedBatches = includeAllBatches
      ? department.batches
      : department.batches.filter((batch) => shouldIncludeBatch(batch, searchText, hasSearch));

    if (selectedBatches.length === 0 && !includeAllBatches) {
      continue;
    }

    mappedDepartments.push({
      id: department.id,
      name: department.name,
      code: department.code,
      userCount: department._count.users,
      years: mapBatchesToYears(selectedBatches),
    });
  }

  return mappedDepartments;
}

function buildSummary(hierarchy: CollegeStatsNode[]): UserHierarchySummary {
  return hierarchy.reduce(
    (acc, college) => {
      acc.totalColleges += 1;
      acc.totalDepartments += college.departments.length;
      acc.totalYears += college.departments.reduce((sum, department) => sum + department.years.length, 0);
      acc.totalBatches += college.departments.reduce(
        (sum, department) => sum + department.years.reduce((yearSum, yearNode) => yearSum + yearNode.batches.length, 0),
        0
      );
      acc.totalUsers += college.userCount;
      return acc;
    },
    {
      totalColleges: 0,
      totalDepartments: 0,
      totalYears: 0,
      totalBatches: 0,
      totalUsers: 0,
    }
  );
}

export async function getProductAdminUserStats(
  options: GetUserStatsOptions = {}
): Promise<ProductAdminUserStatsResponse> {
  const normalizedSearch = options.search?.trim().toLowerCase() ?? "";
  const hasSearch = normalizedSearch.length > 0;

  const whereClause = buildCollegeWhereClause(normalizedSearch, hasSearch);

  const colleges: CollegeRecord[] = await prisma.college.findMany({
    where: whereClause,
    select: {
      id: true,
      name: true,
      code: true,
      _count: {
        select: {
          users: true,
        },
      },
      departments: {
        select: {
          id: true,
          name: true,
          code: true,
          _count: {
            select: {
              users: true,
            },
          },
          batches: {
            select: {
              id: true,
              name: true,
              code: true,
              year: true,
              _count: {
                select: {
                  students: true,
                },
              },
            },
            orderBy: [{ year: "asc" }, { name: "asc" }],
          },
        },
        orderBy: { name: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  const hierarchy: CollegeStatsNode[] = colleges
    .map((college) => {
      const collegeMatches = isCollegeMatch(college, normalizedSearch, hasSearch);
      const departmentNodes = mapDepartments(college.departments, normalizedSearch, hasSearch, collegeMatches);

      if (!collegeMatches && departmentNodes.length === 0) {
        return null;
      }

      return {
        id: college.id,
        name: college.name,
        code: college.code,
        userCount: college._count.users,
        departments: departmentNodes,
      };
    })
    .filter((college): college is CollegeStatsNode => college !== null);

  const summary = buildSummary(hierarchy);

  return {
    summary,
    hierarchy,
  };
}