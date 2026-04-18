// ─── Database Seed ────────────────────────────────────────────────────────────
// Creates two sample users for development and testing.
// Run after migration: npx tsx src/seed.ts

import "dotenv/config";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";
const SALT_ROUNDS = 12;
const prisma = new PrismaClient();

const users = [
  {
    email: "admin@codeethnics.com",
    username: "admin",
    name: "Admin User",
    password: "Admin@1234",
    role: "product_admin" as const,
  },
  {
    email: "student@codeethnics.com",
    username: "student",
    name: "Sample Student",
    password: "Student@1234",
    role: "student" as const,
  },
];

type McqOptionPayload = {
  id: string;
  text: string;
};

type McqQuestionPayload = {
  id: string;
  question: string;
  options: McqOptionPayload[];
  correct: string[];
  explanation?: string;
};

type McqSetPayload = {
  id: string;
  type: string;
  title: string;
  difficulty: "easy" | "medium" | "hard";
  tags: string[];
  content?: {
    description?: string;
  };
  interaction_type?: string;
  questions: McqQuestionPayload[];
  passing_score?: number;
};

type SeedMcqQuestion = {
  id: string;
  title: string;
  description: string;
  difficulty: "easy" | "medium" | "hard";
  tags: string[];
  options: string[];
  correctAnswer: number;
  explanation?: string;
};

function toAscii(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .trim();
}

function normalizeTagName(tag: string): string {
  return toAscii(tag).toLowerCase();
}

function resolveCorrectOptionIndex(
  options: McqOptionPayload[],
  correctIds: string[],
  questionLabel: string
): number {
  if (!Array.isArray(correctIds) || correctIds.length === 0) {
    throw new Error(`MCQ ${questionLabel} is missing a correct answer id`);
  }

  const optionIndexById = new Map<string, number>();
  options.forEach((option, index) => {
    optionIndexById.set(toAscii(option.id).toLowerCase(), index);
  });

  const firstCorrect = toAscii(correctIds[0] ?? "").toLowerCase();
  const mappedIndex = firstCorrect ? optionIndexById.get(firstCorrect) : undefined;
  if (typeof mappedIndex === "number") {
    return mappedIndex;
  }

  const numericIndex = Number(firstCorrect);
  if (Number.isInteger(numericIndex) && numericIndex >= 0 && numericIndex < options.length) {
    return numericIndex;
  }

  throw new Error(`MCQ ${questionLabel} has invalid correct option reference: ${correctIds[0]}`);
}

async function loadMcqQuestionsFromJson(): Promise<SeedMcqQuestion[]> {
  const { default: rawMcqData } = await import("../../mcq_questions.json", {
    with: { type: "json" },
  });

  if (!Array.isArray(rawMcqData)) {
    throw new Error("mcq_questions.json must export an array");
  }

  const normalizedQuestions: SeedMcqQuestion[] = [];

  for (const item of rawMcqData as McqSetPayload[]) {
    if (item.type !== "mcq") {
      continue;
    }

    const normalizedTags = Array.from(
      new Set((item.tags ?? []).map(normalizeTagName).filter(Boolean))
    );

    const setQuestions = Array.isArray(item.questions) ? item.questions : [];
    for (const question of setQuestions) {
      const optionTexts = (question.options ?? [])
        .map((option) => toAscii(option.text))
        .filter(Boolean);

      if (optionTexts.length < 2) {
        throw new Error(`MCQ ${item.id}/${question.id} must have at least 2 options`);
      }

      const correctAnswer = resolveCorrectOptionIndex(question.options ?? [], question.correct ?? [], `${item.id}/${question.id}`);
      const description =
        toAscii(question.question ?? "") ||
        toAscii(item.content?.description ?? "") ||
        toAscii(item.title);

      normalizedQuestions.push({
        id: setQuestions.length === 1 ? item.id : `${item.id}-${question.id}`,
        title: toAscii(item.title),
        description,
        difficulty: item.difficulty,
        tags: normalizedTags,
        options: optionTexts,
        correctAnswer,
        explanation: toAscii(question.explanation ?? "") || undefined,
      });
    }
  }

  return normalizedQuestions;
}

const dsaQuestions = [
  {
    id: "dsa-practice-001",
    title: "Two Sum",
    description: "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.\n\nYou may assume that each input would have exactly one solution, and you may not use the same element twice.",
    difficulty: "easy",
    tags: ["arrays", "hashmap"],
    hiddenTestCases: [
      { input: "[2,7,11,15]\n9", output: "[0,1]" },
      { input: "[3,2,4]\n6", output: "[1,2]" },
      { input: "[3,3]\n6", output: "[0,1]" }
    ],
  },
  {
    id: "dsa-practice-002",
    title: "Reverse String",
    description: "Write a function that reverses a string. The input string is given as an array of characters s.\n\nYou must do this by modifying the input array in-place with O(1) extra memory.",
    difficulty: "easy",
    tags: ["strings", "two-pointers"],
    hiddenTestCases: [
      { input: "[\"h\",\"e\",\"l\",\"l\",\"o\"]", output: "[\"o\",\"l\",\"l\",\"e\",\"h\"]" },
      { input: "[\"H\",\"a\",\"n\",\"n\",\"a\",\"h\"]", output: "[\"h\",\"a\",\"n\",\"n\",\"a\",\"H\"]" }
    ],
  },
  {
    id: "dsa-practice-003",
    title: "Maximum Subarray",
    description: "Given an integer array nums, find the subarray with the largest sum, and return its sum.",
    difficulty: "medium",
    tags: ["arrays", "divide-and-conquer", "dynamic-programming"],
    hiddenTestCases: [
      { input: "[-2,1,-3,4,-1,2,1,-5,4]", output: "6" },
      { input: "[1]", output: "1" },
      { input: "[5,4,-1,7,8]", output: "23" }
    ],
  }
];

async function seed() {
  console.log("🌱 Seeding database...\n");

  let adminUserId: string | null = null;

  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, SALT_ROUNDS);

    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { passwordHash, username: u.username, name: u.name, role: u.role, emailVerified: true },
      create: {
        email: u.email,
        username: u.username,
        name: u.name,
        passwordHash,
        role: u.role,
        emailVerified: true,
      },
    });

    console.log(`✓ ${user.role.padEnd(15)} ${user.email}  (password: ${u.password})`);

    if (u.role === "product_admin") {
      adminUserId = user.id;
    }
  }

  if (!adminUserId) {
    throw new Error("Unable to find product_admin user for MCQ seed");
  }

  const mcqQuestions = await loadMcqQuestionsFromJson();

  const uniqueTagNames = Array.from(new Set(mcqQuestions.flatMap((question) => question.tags)));
  for (const tagName of uniqueTagNames) {
    await prisma.tag.upsert({
      where: { name: tagName },
      update: { type: "topic" },
      create: {
        name: tagName,
        type: "topic",
      },
    });
  }

  for (const question of mcqQuestions) {
    const tagConnections = question.tags.map((name) => ({ name }));

    await prisma.question.upsert({
      where: { id: question.id },
      update: {
        type: "mcq",
        title: question.title,
        description: question.description,
        difficulty: question.difficulty,
        createdBy: adminUserId,
        options: question.options,
        correctAnswer: String(question.correctAnswer),
        explanation: question.explanation,
        tags: {
          set: [],
          connect: tagConnections,
        },
      },
      create: {
        id: question.id,
        type: "mcq",
        title: question.title,
        description: question.description,
        difficulty: question.difficulty,
        createdBy: adminUserId,
        options: question.options,
        correctAnswer: String(question.correctAnswer),
        explanation: question.explanation,
        tags: {
          connect: tagConnections,
        },
      },
    });
  }

  console.log(`✓ Seeded ${mcqQuestions.length} MCQ practice questions`);

  for (const question of dsaQuestions) {
    const tagConnections = question.tags.map((name) => ({ name }));
    // Ensure tags exist
    for (const tagName of question.tags) {
      await prisma.tag.upsert({
        where: { name: tagName },
        update: { type: "topic" },
        create: { name: tagName, type: "topic" },
      });
    }

    await prisma.question.upsert({
      where: { id: question.id },
      update: {
        type: "dsa",
        title: question.title,
        description: question.description,
        difficulty: question.difficulty,
        createdBy: adminUserId,
        hiddenTestCases: question.hiddenTestCases,
        tags: {
          set: [],
          connect: tagConnections,
        },
      },
      create: {
        id: question.id,
        type: "dsa",
        title: question.title,
        description: question.description,
        difficulty: question.difficulty,
        createdBy: adminUserId,
        hiddenTestCases: question.hiddenTestCases,
        tags: {
          connect: tagConnections,
        },
      },
    });
  }

  console.log(`✓ Seeded ${dsaQuestions.length} DSA practice questions`);

  // ─── Seed Daily Challenges ──────────────────────────────────────────────────
  const { default: dailyChallengesData } = await import("../data/daily-challenges.json", { with: { type: "json" } });

  const now = new Date();

  for (const entry of dailyChallengesData) {
    const challengeDate = new Date(
      Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + entry.daysFromToday)
    );

    await prisma.dailyChallenge.upsert({
      where: { date: challengeDate },
      update: {
        questionId: entry.questionId,
        createdBy: adminUserId,
      },
      create: {
        questionId: entry.questionId,
        date: challengeDate,
        createdBy: adminUserId,
      },
    });
  }

  console.log(`✓ Seeded ${dailyChallengesData.length} daily challenges`);

  console.log("\n✅ Seed complete.");
}

seed()
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());