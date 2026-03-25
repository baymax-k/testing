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

const mcqQuestions = [
  {
    id: "mcq-practice-001",
    title: "JavaScript Event Loop Basics",
    description: "Which queue gets executed before macrotasks in JavaScript runtime?",
    difficulty: "easy",
    tags: ["javascript", "runtime"],
    options: ["Callback queue", "Microtask queue", "Timer queue", "Render queue"],
    correctAnswer: 1,
  },
  {
    id: "mcq-practice-002",
    title: "SQL Aggregate Clause",
    description: "Which clause is used to filter grouped records after aggregation?",
    difficulty: "easy",
    tags: ["sql", "database"],
    options: ["WHERE", "HAVING", "GROUP", "ORDER BY"],
    correctAnswer: 1,
  },
  {
    id: "mcq-practice-003",
    title: "Time Complexity of Binary Search",
    description: "What is the worst-case time complexity of binary search on a sorted array?",
    difficulty: "easy",
    tags: ["dsa", "arrays"],
    options: ["O(1)", "O(log n)", "O(n)", "O(n log n)"],
    correctAnswer: 1,
  },
  {
    id: "mcq-practice-004",
    title: "HTTP Idempotent Method",
    description: "Which HTTP method is idempotent by definition?",
    difficulty: "medium",
    tags: ["backend", "http"],
    options: ["POST", "PATCH", "PUT", "CONNECT"],
    correctAnswer: 2,
  },
  {
    id: "mcq-practice-005",
    title: "Normalization Concept",
    description: "Which normal form eliminates transitive dependency?",
    difficulty: "medium",
    tags: ["sql", "database"],
    options: ["1NF", "2NF", "3NF", "BCNF"],
    correctAnswer: 2,
  },
  {
    id: "mcq-practice-006",
    title: "TypeScript Utility Type",
    description: "Which utility type makes all properties in a type optional?",
    difficulty: "easy",
    tags: ["typescript", "frontend"],
    options: ["Required<T>", "Readonly<T>", "Partial<T>", "Pick<T, K>"],
    correctAnswer: 2,
  },
  {
    id: "mcq-practice-007",
    title: "OOP Principle",
    description: "Which OOP principle allows deriving a new class from an existing class?",
    difficulty: "easy",
    tags: ["oops", "fundamentals"],
    options: ["Encapsulation", "Inheritance", "Polymorphism", "Abstraction"],
    correctAnswer: 1,
  },
  {
    id: "mcq-practice-008",
    title: "Redis Use Case",
    description: "Which is the most common use case for Redis in backend systems?",
    difficulty: "medium",
    tags: ["redis", "backend"],
    options: ["Relational joins", "Long-term cold storage", "Caching hot data", "Compile TypeScript"],
    correctAnswer: 2,
  },
  {
    id: "mcq-practice-009",
    title: "Prisma Migration Command",
    description: "Which Prisma command creates and applies a new migration in development?",
    difficulty: "medium",
    tags: ["prisma", "backend"],
    options: ["prisma generate", "prisma db push", "prisma migrate deploy", "prisma migrate dev"],
    correctAnswer: 3,
  },
  {
    id: "mcq-practice-010",
    title: "Big-O for Hash Map Lookup",
    description: "Average-case time complexity for hash map key lookup is:",
    difficulty: "easy",
    tags: ["dsa", "hashmap"],
    options: ["O(1)", "O(log n)", "O(n)", "O(n^2)"],
    correctAnswer: 0,
  },
  {
    id: "mcq-practice-011",
    title: "Array Insert at End",
    description: "In a dynamic array (amortized), appending an element is usually:",
    difficulty: "easy",
    tags: ["arrays", "dsa"],
    options: ["O(1)", "O(log n)", "O(n)", "O(n^2)"],
    correctAnswer: 0,
  },
  {
    id: "mcq-practice-012",
    title: "Two Pointer Technique",
    description: "Two pointers works best when input is typically:",
    difficulty: "easy",
    tags: ["arrays", "dsa"],
    options: ["Sorted", "Randomized", "Graph", "Tree"],
    correctAnswer: 0,
  },
  {
    id: "mcq-practice-013",
    title: "Prefix Sum Use Case",
    description: "Prefix sums are mainly used to optimize:",
    difficulty: "medium",
    tags: ["arrays", "dsa"],
    options: ["Range sum queries", "Sorting", "Hash collisions", "Tree traversal"],
    correctAnswer: 0,
  },
  {
    id: "mcq-practice-014",
    title: "Kadane's Algorithm",
    description: "Kadane's algorithm solves which problem in O(n)?",
    difficulty: "medium",
    tags: ["arrays", "dsa"],
    options: ["Maximum subarray sum", "Median of stream", "Topological sort", "Shortest path"],
    correctAnswer: 0,
  },
  {
    id: "mcq-practice-015",
    title: "Sliding Window",
    description: "Fixed-size sliding window is useful for:",
    difficulty: "easy",
    tags: ["arrays", "dsa"],
    options: ["Consecutive segment computation", "Tree balancing", "Union-find", "Heap merge"],
    correctAnswer: 0,
  },
  {
    id: "mcq-practice-016",
    title: "Array Index Bounds",
    description: "Valid index range for array of length n is:",
    difficulty: "easy",
    tags: ["arrays", "fundamentals"],
    options: ["1 to n", "0 to n", "0 to n-1", "1 to n-1"],
    correctAnswer: 2,
  },
  {
    id: "mcq-practice-017",
    title: "In-place Reversal",
    description: "Reversing array in-place typically uses:",
    difficulty: "easy",
    tags: ["arrays", "dsa"],
    options: ["Two pointers swap", "Hash map", "Priority queue", "DFS recursion"],
    correctAnswer: 0,
  },
  {
    id: "mcq-practice-018",
    title: "Duplicate Detection",
    description: "Fastest average approach to detect duplicates in an array is:",
    difficulty: "medium",
    tags: ["arrays", "hashmap"],
    options: ["Hash set lookup", "Nested loops", "Binary tree always", "Bubble sort first"],
    correctAnswer: 0,
  },
  {
    id: "mcq-practice-019",
    title: "Rotation by k",
    description: "Array rotation by k can be done in-place using:",
    difficulty: "medium",
    tags: ["arrays", "dsa"],
    options: ["Three reversals", "Only extra array", "Only linked list", "Heapify twice"],
    correctAnswer: 0,
  },
  {
    id: "mcq-practice-020",
    title: "Frequency Count",
    description: "To compute frequency of elements efficiently, preferred structure is:",
    difficulty: "easy",
    tags: ["arrays", "hashmap"],
    options: ["Hash map", "Stack", "Queue", "Trie"],
    correctAnswer: 0,
  },
] as const;

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
        correctAnswer: question.correctAnswer,
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
        correctAnswer: question.correctAnswer,
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