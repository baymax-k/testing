// ─── Database Seed ────────────────────────────────────────────────────────────
// Creates two sample users for development and testing.
// Run after migration: npx tsx src/seed.ts

import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";

const prisma = new PrismaClient();

const users = [
  {
    email: "admin@codeethnics.com",
    name: "Admin User",
    role: "product_admin" as const,
  },
  {
    email: "student@codeethnics.com",
    name: "Sample Student",
    role: "student" as const,
  },
];

async function seed() {
  console.log("🌱 Seeding database...\n");

  for (const u of users) {
    try {
      const user = await prisma.user.upsert({
        where: { email: u.email },
        update: { name: u.name, role: u.role, emailVerified: true },
        create: {
          email: u.email,
          name: u.name,
          role: u.role,
          emailVerified: true,
        },
      });

      console.log(`✓ ${user.role.padEnd(15)} ${user.email}`);
    } catch (error) {
      console.error(`✗ Failed to seed ${u.email}:`, (error as Error).message);
    }
  }

  console.log("\n✅ Seed complete.");
}

seed()
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
