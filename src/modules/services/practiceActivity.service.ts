import { prisma } from "../../config/prisma.js";

function getDateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

export async function recordPracticeActivity(
  userId: string,
  opts: { type: "mcq" | "dsa" | "visit" | "solve" }
) {
  const today = getDateOnly(new Date());

  const existing = await prisma.dailyPracticeActivity.findUnique({
    where: { userId_date: { userId, date: today } as any },
  });

  if (!existing) {
    const data: any = { userId, date: today };
    if (opts.type === "mcq") data.mcqSolved = 1;
    else if (opts.type === "dsa") data.dsaSolved = 1;
    else if (opts.type === "solve") data.problemsSolved = 1;

    return prisma.dailyPracticeActivity.create({ data });
  }

  const updateData: any = {};
  if (opts.type === "mcq") updateData.mcqSolved = { increment: 1 } as any;
  else if (opts.type === "dsa") updateData.dsaSolved = { increment: 1 } as any;
  else if (opts.type === "solve") updateData.problemsSolved = { increment: 1 } as any;

  return prisma.dailyPracticeActivity.update({
    where: { id: existing.id },
    data: updateData,
  });
}

export async function getPracticeActivity(userId: string, date?: Date) {
  const target = date ? getDateOnly(date) : getDateOnly(new Date());
  const row = await prisma.dailyPracticeActivity.findUnique({
    where: { userId_date: { userId, date: target } as any },
  });

  if (!row) {
    return {
      problemsSolved: 0,
      mcqSolved: 0,
      dsaSolved: 0,
      date: target,
    };
  }

  return row;
}

export async function getPracticeActivityRange(userId: string, days = 30) {
  const end = getDateOnly(new Date());
  const start = new Date(end.getTime() - (days - 1) * 86400000);

  const rows = await prisma.dailyPracticeActivity.findMany({
    where: { userId, date: { gte: start, lte: end } },
    orderBy: { date: "asc" },
  });

  return rows;
}

export default {};
