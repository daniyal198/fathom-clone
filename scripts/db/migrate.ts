// Apply scripts/db/schema.sql (idempotent). Usage: npx tsx scripts/db/migrate.ts
import fs from "node:fs";
import path from "node:path";
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { sql } = await import("../../src/lib/db");
  const ddl = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  // Split on statement boundaries; the schema has no functions/DO blocks.
  for (const stmt of ddl.split(/;\s*\n/).map((s) => s.replace(/^\s*--.*$/gm, "").trim()).filter(Boolean)) {
    await sql.query(stmt);
  }
  console.log("schema applied");
}
main();
