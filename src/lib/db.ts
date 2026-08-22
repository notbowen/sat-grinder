import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "@/db/schema";

const databasePath = process.env.DATABASE_PATH ?? path.join(process.cwd(), ".data", "sat-grinder.sqlite");
fs.mkdirSync(path.dirname(databasePath), { recursive: true });

const globalForDb = globalThis as unknown as { satGrinderSqlite?: Database.Database };
export const sqlite = globalForDb.satGrinderSqlite ?? new Database(databasePath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
sqlite.pragma("busy_timeout = 5000");

if (process.env.NODE_ENV !== "production") globalForDb.satGrinderSqlite = sqlite;

export const db = drizzle(sqlite, { schema });
export { databasePath };
