// ─── Database Seed ────────────────────────────────────────────────────────────
// Creates two sample users for development and testing.
// Run after migration: npx tsx src/seed.ts

import "dotenv/config";
import bcrypt from "bcrypt";
import { prisma } from "../config/prisma.js";

const SALT_ROUNDS = 12;

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

async function seed() {
  console.log("🌱 Seeding database...\n");

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
  }

  console.log("\n✅ Seed complete.");
}

seed()
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
