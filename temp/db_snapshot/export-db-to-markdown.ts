import "dotenv/config";
import { mkdir, writeFile, appendFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../../src/config/prisma.js";

type TableRef = {
  table_schema: string;
  table_name: string;
};

type ColumnRef = {
  column_name: string;
  data_type: string;
  is_nullable: "YES" | "NO";
  column_default: string | null;
};

type ConstraintRef = {
  constraint_name: string;
  constraint_type: string;
  definition: string;
};

type IndexRef = {
  indexname: string;
  indexdef: string;
};

function quoteIdent(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function toSafeJson(value: unknown): string {
  return JSON.stringify(
    value,
    (_key, val) => {
      if (typeof val === "bigint") return val.toString();
      if (val instanceof Date) return val.toISOString();
      if (val instanceof Uint8Array) return Buffer.from(val).toString("base64");
      if (Buffer.isBuffer(val)) return val.toString("base64");
      return val;
    },
    2
  );
}

function markdownEscape(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, "<br/>");
}

async function main() {
  const outputDir = path.resolve(process.cwd(), "temp", "db_snapshot");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputFile = path.join(outputDir, `db_snapshot_${timestamp}.md`);

  await mkdir(outputDir, { recursive: true });

  await writeFile(
    outputFile,
    `# Database Snapshot\n\nGenerated at: ${new Date().toISOString()}\n\n` +
      `This file includes table schema and table data for every non-system PostgreSQL table.\n\n`
  );

  const tables = await prisma.$queryRaw<TableRef[]>`
    SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE table_type = 'BASE TABLE'
      AND table_schema NOT IN ('pg_catalog', 'information_schema')
    ORDER BY table_schema, table_name;
  `;

  await appendFile(outputFile, `## Summary\n\n- Total tables: **${tables.length}**\n\n`);

  for (const table of tables) {
    const { table_schema: schemaName, table_name: tableName } = table;
    const qualifiedName = `${quoteIdent(schemaName)}.${quoteIdent(tableName)}`;

    const columns = await prisma.$queryRaw<ColumnRef[]>`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = ${schemaName}
        AND table_name = ${tableName}
      ORDER BY ordinal_position;
    `;

    const constraints = await prisma.$queryRaw<ConstraintRef[]>`
      SELECT
        tc.constraint_name,
        tc.constraint_type,
        pg_get_constraintdef(con.oid) AS definition
      FROM information_schema.table_constraints tc
      JOIN pg_namespace ns ON ns.nspname = tc.table_schema
      JOIN pg_class cls ON cls.relname = tc.table_name AND cls.relnamespace = ns.oid
      JOIN pg_constraint con ON con.conname = tc.constraint_name AND con.conrelid = cls.oid
      WHERE tc.table_schema = ${schemaName}
        AND tc.table_name = ${tableName}
      ORDER BY tc.constraint_type, tc.constraint_name;
    `;

    const indexes = await prisma.$queryRaw<IndexRef[]>`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = ${schemaName}
        AND tablename = ${tableName}
      ORDER BY indexname;
    `;

    const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(`SELECT * FROM ${qualifiedName};`);

    await appendFile(outputFile, `## ${schemaName}.${tableName}\n\n`);
    await appendFile(outputFile, `- Row count: **${rows.length}**\n\n`);

    await appendFile(outputFile, `### Schema\n\n`);
    await appendFile(outputFile, `| Column | Type | Nullable | Default |\n|---|---|---|---|\n`);
    for (const column of columns) {
      await appendFile(
        outputFile,
        `| ${markdownEscape(column.column_name)} | ${markdownEscape(column.data_type)} | ${column.is_nullable} | ${markdownEscape(column.column_default ?? "")} |\n`
      );
    }
    await appendFile(outputFile, `\n`);

    await appendFile(outputFile, `### Constraints\n\n`);
    if (constraints.length === 0) {
      await appendFile(outputFile, `- None\n\n`);
    } else {
      for (const c of constraints) {
        await appendFile(
          outputFile,
          `- **${markdownEscape(c.constraint_name)}** (${markdownEscape(c.constraint_type)}): ${markdownEscape(c.definition)}\n`
        );
      }
      await appendFile(outputFile, `\n`);
    }

    await appendFile(outputFile, `### Indexes\n\n`);
    if (indexes.length === 0) {
      await appendFile(outputFile, `- None\n\n`);
    } else {
      for (const idx of indexes) {
        await appendFile(outputFile, `- **${markdownEscape(idx.indexname)}**: ${markdownEscape(idx.indexdef)}\n`);
      }
      await appendFile(outputFile, `\n`);
    }

    await appendFile(outputFile, `### Data\n\n`);
    if (rows.length === 0) {
      await appendFile(outputFile, `No rows.\n\n`);
    } else {
      await appendFile(outputFile, "```json\n");
      await appendFile(outputFile, `${toSafeJson(rows)}\n`);
      await appendFile(outputFile, "```\n\n");
    }
  }

  console.log(`Database snapshot written to: ${outputFile}`);
}

main()
  .catch((error) => {
    console.error("Failed to export database snapshot:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
