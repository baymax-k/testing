// ─── Show Tables ──────────────────────────────────────────────────────────────
// Lists all tables in the database with their row counts and column names.
// Run: npx tsx src/scripts/show-tables.ts

import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client.js";

const prisma = new PrismaClient();

async function showTables() {
  // Get all user-defined tables in the public schema
  const tables = await prisma.$queryRaw<{ table_name: string }[]>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `;

  if (tables.length === 0) {
    console.log("No tables found in the public schema.");
    return;
  }

  console.log(`\nDatabase: ${process.env.DATABASE_URL?.split("@")[1]?.split("/")[1]?.split("?")[0] ?? "unknown"}`);
  console.log(`Found ${tables.length} tables\n`);
  console.log("─".repeat(72));

  for (const { table_name } of tables) {
    // Row count
    const countResult = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*) AS count FROM "${table_name}"`
    );
    const rowCount = Number(countResult[0].count);

    // Column info
    const columns = await prisma.$queryRaw<{
      column_name: string;
      data_type: string;
      is_nullable: string;
      column_default: string | null;
    }[]>`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ${table_name}
      ORDER BY ordinal_position
    `;

    console.log(`\n📋 ${table_name}  (${rowCount} row${rowCount !== 1 ? "s" : ""})`);

    for (const col of columns) {
      const nullable = col.is_nullable === "YES" ? "nullable" : "not null";
      const defaultVal = col.column_default ? ` | default: ${col.column_default}` : "";
      console.log(`   • ${col.column_name.padEnd(28)} ${col.data_type.padEnd(20)} ${nullable}${defaultVal}`);
    }
  }

  console.log("\n" + "─".repeat(72) + "\n");
}

showTables()
  .catch((err) => {
    console.error("❌ Error:", err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
