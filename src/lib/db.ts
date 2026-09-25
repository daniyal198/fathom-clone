import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
if (!url) throw new Error("DATABASE_URL is not set");

// HTTP driver: one round trip per query, no pool to manage on serverless.
export const sql = neon(url);
